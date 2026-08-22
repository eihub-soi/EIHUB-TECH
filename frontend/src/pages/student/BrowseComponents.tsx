import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockEngine } from "../../services/mockEngine";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { ComponentItem, ComponentCategory } from "../../types";
import { toast } from "sonner";
import {
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
  ShoppingBag,
  Trash2,
  Calendar,
  User,
  ArrowRight,
  FileText,
  Sparkles,
} from "lucide-react";

export const BrowseComponents: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    totalItems,
  } = useCart();

  const [components, setComponents] = useState<ComponentItem[]>(
    mockEngine.getComponents(),
  );
  const [selectedCategory, setSelectedCategory] = useState<
    ComponentCategory | "All"
  >("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categoriesList = [
    "All",
    ...Array.from(new Set(components.map((c) => c.category))),
  ];

  // Checkout Wizard Modal State
  const [showCartCheckoutModal, setShowCartCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);

  // Requirements Form Fields (Start empty so student enters their own data)
  const [purpose, setPurpose] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [projectGuide, setProjectGuide] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredComponents = components.filter((comp) => {
    const matchesCategory =
      selectedCategory === "All" || comp.category === selectedCategory;
    const matchesSearch =
      comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = (comp: ComponentItem) => {
    if (comp.available_stock <= 0) {
      toast.error("Item is currently out of stock.");
      return;
    }
    addToCart(comp, 1);
    toast.success(`Added ${comp.name} to your Requirements Cart!`);
  };

  const handleConfirmCartRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !user) return;

    if (!purpose.trim()) {
      toast.error("Please type your project purpose");
      return;
    }
    if (!fromDate) {
      toast.error("Please select a From Date");
      return;
    }
    if (!toDate) {
      toast.error("Please select a To Date");
      return;
    }
    if (!projectGuide.trim()) {
      toast.error("Please type your project guide name");
      return;
    }
    if (!projectDescription.trim()) {
      toast.error("Please type your project description");
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate days difference
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)),
      );

      let submittedCount = 0;
      cart.forEach((item) => {
        const fullPurpose = `Project Purpose: ${purpose}\nFrom Date: ${fromDate}\nTo Date: ${toDate}\nProject Guide: ${projectGuide}\nDescription: ${projectDescription}`;
        mockEngine.submitBorrowRequest(
          user.id,
          item.component.id,
          item.quantity,
          fullPurpose,
          days,
        );
        submittedCount++;
      });

      toast.success(
        `Submitted borrowing request for ${submittedCount} components to ${projectGuide}!`,
      );
      setComponents(mockEngine.getComponents()); // refresh stock
      clearCart();
      setShowCartCheckoutModal(false);
      navigate("/student/requests");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit cart request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            Browse Lab Components
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Select hardware requirements into your cart and submit project
            borrowing requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-xs"
            />
          </div>

          {/* Floating Cart Trigger Button */}
          <button
            onClick={() => navigate("/student/cart")}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs transition-all hover:scale-105 shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Requirements Cart</span>
            {totalItems > 0 && (
              <span className="w-5 h-5 rounded-full bg-gold-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center animate-pulse">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categoriesList.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-[#60A5FA] text-white shadow-md "
                : "bg-white text-gray-700 hover:text-black hover:bg-white border border-white/5"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of 3D Component Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filteredComponents.map((comp) => {
          const isOutOfStock = comp.available_stock <= 0;
          const cartItem = cart.find((item) => item.component.id === comp.id);

          return (
            <div
              key={comp.id}
              className="group glass-card p-4 border border-[#E5E7EB] hover:border-[#60A5FA] transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Image Showcase Box */}
                <div className="relative h-44 rounded-2xl overflow-hidden bg-white border border-white/5 flex items-center justify-center p-4 group-hover:scale-[1.02] transition-transform">
                  <img
                    src={comp.image_url}
                    alt={comp.name}
                    className="h-full object-contain filter shadow-sm"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white border border-[#E5E7EB] text-black ">
                    {comp.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-black group-hover:text-indigo-900 transition-colors">
                    {comp.name}
                  </h3>
                  <p className="text-[11px] text-gray-700 line-clamp-2 mt-1">
                    {comp.description}
                  </p>
                </div>
              </div>

              {/* Stock status & Add to Cart / Inline Stepper */}
              <div className="pt-4 mt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                <div>
                  {isOutOfStock ? (
                    <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Out of Stock
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Available:{" "}
                      {comp.available_stock}
                    </span>
                  )}
                  <p className="text-[10px] text-black0">{comp.cabinet}</p>
                </div>

                {cartItem ? (
                  <div className="flex items-center bg-white border border-[#60A5FA] rounded-xl overflow-hidden ">
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(comp.id, cartItem.quantity - 1)
                      }
                      className="px-2.5 py-1 text-black hover:text-black hover:bg-white font-extrabold text-xs transition-all"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="px-2 font-extrabold text-indigo-900 text-xs">
                      {cartItem.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(comp.id, cartItem.quantity + 1)
                      }
                      disabled={cartItem.quantity >= comp.available_stock}
                      className="px-2.5 py-1 text-black hover:text-black hover:bg-white font-extrabold text-xs transition-all disabled:opacity-40"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={isOutOfStock}
                    onClick={() => handleAddToCart(comp)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isOutOfStock
                        ? "bg-white text-black0 cursor-not-allowed"
                        : "bg-[#60A5FA] hover:bg-[#60A5FA] text-white hover:scale-105"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
