import React, { useState } from "react";
import { mockEngine } from "../../services/mockEngine";
import { CSVImportModal } from "../../components/inventory/CSVImportModal";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { ComponentItem, ComponentCategory } from "../../types";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  TrendingUp,
  Filter,
  X,
  Boxes,
  Download,
  CheckCircle2,
  UploadCloud,
  AlertCircle,
} from "lucide-react";

export const InventoryManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [components, setComponents] = useState<ComponentItem[]>(
    mockEngine.getComponents(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [locationFilter, setLocationFilter] = useState<string>("All");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingComp, setEditingComp] = useState<ComponentItem | null>(null);
  const [restockComp, setRestockComp] = useState<ComponentItem | null>(null);
  const [restockQty, setRestockQty] = useState(5);

  useEscapeKey(() => setShowAddModal(false), showAddModal);
  useEscapeKey(() => setRestockComp(null), !!restockComp);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "Microcontrollers" as ComponentCategory,
    description: "",
    total_stock: 10,
    cabinet: "Lab A, Cabinet 1",
    shelf: "Shelf 1",
    image_url:
      "https://images.unsplash.com/photo-1608564697071-ddf911d81370?w=400&auto=format&fit=crop&q=80",
    unit_cost: 15.0,
  });

  const filteredComponents = components.filter((c) => {
    const matchesCategory =
      categoryFilter === "All" || c.category === categoryFilter;
    const matchesLocation =
      locationFilter === "All" || c.cabinet.includes(locationFilter);
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.cabinet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesLocation && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setFormData({
      sku: "",
      name: "",
      category: "Microcontrollers",
      description: "",
      total_stock: 1,
      cabinet: "",
      shelf: "",
      image_url:
        "https://images.unsplash.com/photo-1608564697071-ddf911d81370?w=400&auto=format&fit=crop&q=80",
      unit_cost: 0,
    });
    setEditingComp(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (comp: ComponentItem) => {
    setEditingComp(comp);
    setFormData({
      sku: comp.sku,
      name: comp.name,
      category: comp.category,
      description: comp.description,
      total_stock: comp.total_stock,
      cabinet: comp.cabinet,
      shelf: comp.shelf,
      image_url: comp.image_url,
      unit_cost: comp.unit_cost,
    });
    setShowAddModal(true);
  };

  const handleSaveComponent = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingComp) {
        mockEngine.updateComponent(editingComp.id, formData);
        toast.success(`Updated ${formData.name}`);
      } else {
        mockEngine.addComponent(formData);
        toast.success(`Added new component: ${formData.name}`);
      }
      setComponents(mockEngine.getComponents());
      setShowAddModal(false);
    } catch (err: any) {
      toast.error(err.message || "Error saving component");
    }
  };

  const handleDeleteComponent = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name} from inventory?`)) {
      mockEngine.deleteComponent(id);
      toast.success(`Deleted ${name}`);
      setComponents(mockEngine.getComponents());
    }
  };

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockComp) return;
    try {
      mockEngine.restockComponent(
        restockComp.id,
        restockQty,
        user?.id || "usr-faculty-1",
      );
      toast.success(`Restocked ${restockQty} units of ${restockComp.name}`);
      setComponents(mockEngine.getComponents());
      setRestockComp(null);
    } catch (err: any) {
      toast.error(err.message || "Restock failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            Inventory Management
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Manage hardware stock, cabinet shelf allocations, and restock levels
          </p>
        </div>

                <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(user?.role === 'admin' ? '/admin/imports' : '/faculty/imports')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#E5E7EB] hover:bg-gray-50 text-black font-bold text-xs transition-all hover:scale-105"
          >
            <UploadCloud className="w-4 h-4 text-blue-600" /> Import CSV
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Add Component
          </button>
        </div>
      </div>

      {/* Filter Toolbar matching preview UI */}
      <div className="p-4 rounded-3xl glass-card border border-[#E5E7EB] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl glass-input text-xs"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-2xl glass-input text-xs text-black"
        >
          <option value="All">All Categories</option>
          {Array.from(new Set(components.map((c) => c.category))).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="px-3 py-2 rounded-2xl glass-input text-xs text-black"
        >
          <option value="All">All Locations</option>
          <option value="Lab A">Lab A Cabinet</option>
          <option value="Lab B">Lab B Box</option>
        </select>

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-[#E5E7EB] text-xs font-semibold text-black hover:text-black">
          <Filter className="w-3.5 h-3.5" /> Filters
        </button>
      </div>

      {/* Inventory Table matching reference preview UI */}
      <div className="glass-card rounded-3xl border border-[#E5E7EB] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[10px] font-bold uppercase tracking-wider text-gray-700">
                <th className="py-3.5 px-6">Component</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Total Stock</th>
                <th className="py-3.5 px-6">Available</th>
                <th className="py-3.5 px-6">Borrowed</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {filteredComponents.map((comp) => (
                <tr key={comp.id} className="hover:bg-white transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={comp.image_url}
                        alt={comp.name}
                        className="w-9 h-9 rounded-xl object-cover"
                      />
                      <div>
                        <p className="font-bold text-black">{comp.name}</p>
                        <p className="text-[10px] font-mono text-gray-700">
                          {comp.sku}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-black font-medium">
                    {comp.category}
                  </td>
                  <td className="py-4 px-6 font-bold text-black">
                    {comp.total_stock}
                  </td>
                  <td className="py-4 px-6">
                    {comp.available_stock > 0 ? (
                      <span className="font-bold text-emerald-900">
                        {comp.available_stock}
                      </span>
                    ) : (
                      <span className="font-bold text-rose-900">
                        0 (Out of Stock)
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 font-bold text-indigo-900">
                    {comp.borrowed_stock}
                  </td>
                  <td className="py-4 px-6 text-gray-700">
                    {comp.cabinet}, {comp.shelf}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setRestockComp(comp);
                          setRestockQty(5);
                        }}
                        className="p-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-900 hover:text-black border border-emerald-500/30 transition-all"
                        title="Restock Component"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(comp)}
                        className="p-1.5 rounded-xl bg-white hover:bg-[#E6F0FF] text-black hover:text-black transition-all"
                        title="Edit Component"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteComponent(comp.id, comp.name)
                        }
                        className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-900 hover:text-black transition-all"
                        title="Delete Component"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-sm glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-900" /> Restock
              Component ({restockComp.name})
            </h3>

            <form onSubmit={handleConfirmRestock} className="space-y-4 text-xs">
              <div>
                <label className="block text-black font-semibold mb-1">
                  Units to Add to Stock
                </label>
                <input
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-black font-bold"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockComp(null)}
                  className="px-4 py-2 text-gray-700 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-bold"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Component Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-lg glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-900" />{" "}
                {editingComp ? "Edit Component" : "Add New Component"}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-gray-700 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComponent} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-black font-semibold mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-black font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="E.g. Sensors, Microcontrollers"
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Component Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="E.g. Arduino Mega 2560"
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Total Stock
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.total_stock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        total_stock: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Unit Cost (₹ INR)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.unit_cost}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unit_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Cabinet Rack
                  </label>
                  <input
                    type="text"
                    value={formData.cabinet}
                    onChange={(e) =>
                      setFormData({ ...formData, cabinet: e.target.value })
                    }
                    placeholder="Lab A, Cabinet 3"
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  />
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Shelf / Box
                  </label>
                  <input
                    type="text"
                    value={formData.shelf}
                    onChange={(e) =>
                      setFormData({ ...formData, shelf: e.target.value })
                    }
                    placeholder="Shelf 2"
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Image URL
                </label>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) =>
                    setFormData({ ...formData, image_url: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold "
                >
                  {editingComp ? "Update Component" : "Add Component"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <CSVImportModal 
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            // Ideally we should sync with D1 here, but since the rest of the file uses mockEngine:
            mockEngine.syncWithD1().then(() => {
              setComponents(mockEngine.getComponents());
            });
          }}
        />
      )}
    </div>
  );
};
