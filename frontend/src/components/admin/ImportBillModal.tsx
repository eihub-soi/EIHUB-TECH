import React, { useState, useRef } from "react";
import { 
  UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  X, ChevronRight, Check, Image as ImageIcon, Box, Building2, 
  Receipt, DollarSign, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useAuth } from "../../contexts/AuthContext";

interface ImportBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportBillModal: React.FC<ImportBillModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  useEscapeKey(onClose, isOpen);
  const [file, setFile] = useState<File | null>(null);

  if (user?.role === 'faculty' || user?.role === 'admin') return null;
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<"upload" | "processing" | "preview">("upload");
  const [previewData, setPreviewData] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Invalid file type. Please upload a PDF, JPG, PNG, or WEBP.");
      return;
    }

    setFile(selectedFile);
    setStep("processing");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    try {
      const token = localStorage.getItem("ei_hub_auth_token") || "";
      
      const res = await fetch("http://localhost:8000/api/purchases/import/preview", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      
      if (!res.ok) {
        throw new Error("Failed to process bill");
      }
      
      const data = await res.json();
      setPreviewData(data);
      setStep("preview");
    } catch (err) {
      console.error(err);
      toast.error("Failed to extract data from bill. Please try again.");
      setStep("upload");
      setFile(null);
    }
  };

  const handleConfirm = async () => {
    if (!previewData) return;
    setIsConfirming(true);
    try {
      await apiRequest("/api/purchases/import/confirm", {
        method: "POST",
        body: JSON.stringify(previewData)
      });
      toast.success("Bill imported successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to confirm purchase.");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-5xl glass-card border border-white/20 shadow-2xl rounded-3xl overflow-hidden bg-white/95 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import Bill & Invoice</h2>
              <p className="text-xs text-gray-500 font-medium">AI-powered OCR extraction for smart inventory updates</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center min-h-[400px]"
              >
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full max-w-2xl p-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50/50' 
                      : 'border-gray-200 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/30'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png,.webp" 
                    onChange={handleFileChange}
                  />
                  <div className="w-20 h-20 mb-6 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-500">
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Drag & Drop your invoice here</h3>
                  <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                    Upload a high-resolution PDF or image (JPG, PNG, WEBP) of the bill. AI will extract all line items automatically.
                  </p>
                  <button className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md transition-all">
                    Browse Files
                  </button>
                </div>
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center min-h-[400px]"
              >
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                  <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                    <FileText className="w-10 h-10 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Document...</h3>
                <p className="text-sm text-gray-500 text-center max-w-sm animate-pulse">
                  Extracting supplier info, GST details, financial totals, and component line items using AI OCR. This usually takes ~2 seconds.
                </p>
              </motion.div>
            )}

            {step === "preview" && previewData && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Status Alert */}
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold">Extraction Successful ({(previewData.processing_time_ms / 1000).toFixed(2)}s)</p>
                    <p className="text-emerald-700 text-xs">Review the extracted details below before confirming the purchase.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Invoice Details */}
                  <div className="space-y-6">
                    {/* Supplier Info */}
                    <div className="p-5 rounded-3xl bg-gray-50 border border-gray-100 space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" /> Supplier Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Supplier Name</label>
                          <input type="text" value={previewData.supplier?.name || ''} onChange={(e) => setPreviewData({...previewData, supplier: {...previewData.supplier, name: e.target.value}})} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">GSTIN</label>
                          <input type="text" value={previewData.supplier?.gstin || ''} onChange={(e) => setPreviewData({...previewData, supplier: {...previewData.supplier, gstin: e.target.value}})} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Contact Email</label>
                          <input type="text" value={previewData.supplier?.email || ''} onChange={(e) => setPreviewData({...previewData, supplier: {...previewData.supplier, email: e.target.value}})} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Invoice Info */}
                    <div className="p-5 rounded-3xl bg-gray-50 border border-gray-100 space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-indigo-600" /> Invoice Details
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Invoice Number</label>
                          <input type="text" value={previewData.invoice?.invoice_number || ''} onChange={(e) => setPreviewData({...previewData, invoice: {...previewData.invoice, invoice_number: e.target.value}})} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Date</label>
                          <input type="text" value={previewData.invoice?.date || ''} onChange={(e) => setPreviewData({...previewData, invoice: {...previewData.invoice, date: e.target.value}})} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Components & Totals */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Components Table */}
                    <div className="p-5 rounded-3xl bg-gray-50 border border-gray-100 flex flex-col h-[350px]">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4 text-indigo-600" /> Extracted Line Items
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs">{previewData.components?.length || 0} Items</span>
                      </h3>
                      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-md border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 font-bold text-gray-600">Component / Description</th>
                              <th className="px-4 py-3 font-bold text-gray-600 text-center">Qty</th>
                              <th className="px-4 py-3 font-bold text-gray-600 text-right">Unit Price</th>
                              <th className="px-4 py-3 font-bold text-gray-600 text-right">GST</th>
                              <th className="px-4 py-3 font-bold text-gray-600 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {previewData.components?.map((comp: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <input type="text" value={comp.name} onChange={(e) => {
                                    const newComps = [...previewData.components];
                                    newComps[idx].name = e.target.value;
                                    setPreviewData({...previewData, components: newComps});
                                  }} className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-gray-900" />
                                  <div className="text-[10px] text-gray-500 mt-1">HSN: {comp.hsn_code || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input type="number" value={comp.quantity} onChange={(e) => {
                                    const newComps = [...previewData.components];
                                    newComps[idx].quantity = parseInt(e.target.value) || 0;
                                    setPreviewData({...previewData, components: newComps});
                                  }} className="w-16 bg-white border border-gray-200 rounded-md px-2 py-1 text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <input type="number" step="0.01" value={comp.unit_price} onChange={(e) => {
                                    const newComps = [...previewData.components];
                                    newComps[idx].unit_price = parseFloat(e.target.value) || 0;
                                    setPreviewData({...previewData, components: newComps});
                                  }} className="w-20 bg-white border border-gray-200 rounded-md px-2 py-1 text-right focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500">
                                  {comp.gst_rate}%
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                                    comp.status === 'Matched' ? 'bg-emerald-100 text-emerald-700' :
                                    comp.status === 'New' ? 'bg-blue-100 text-blue-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {comp.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Financial Totals */}
                    <div className="p-5 rounded-3xl bg-indigo-600 text-white shadow-lg grid grid-cols-2 md:grid-cols-4 gap-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
                        <DollarSign className="w-32 h-32" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Taxable Value</p>
                        <p className="text-xl font-bold">₹{previewData.financials?.taxable_value.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="relative z-10">
                        <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Total GST</p>
                        <p className="text-xl font-bold">₹{previewData.financials?.total_gst.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="relative z-10">
                        <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Discount</p>
                        <p className="text-xl font-bold text-emerald-300">₹{previewData.financials?.discount.toFixed(2) || '0.00'}</p>
                      </div>
                      <div className="relative z-10 border-l border-indigo-400 pl-4">
                        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Grand Total</p>
                        <p className="text-2xl font-extrabold text-white">₹{previewData.financials?.grand_total.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step === "preview" && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between mt-auto">
            <button 
              onClick={() => {
                setStep("upload");
                setFile(null);
                setPreviewData(null);
              }}
              className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors text-sm"
              disabled={isConfirming}
            >
              Cancel & Re-upload
            </button>
            <button 
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all text-sm disabled:opacity-70"
            >
              {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isConfirming ? "Confirming..." : "Confirm Purchase & Add Stock"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
