import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Save, 
  Plus, 
  Trash2, 
  ChevronRight, 
  Check, 
  AlertTriangle, 
  ArrowRight,
  Database,
  RefreshCw,
  Eye,
  Info,
  DollarSign
} from 'lucide-react';
import { apiRequest, getAuthHeaders } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface InvoiceMetadata {
  supplier_name: string;
  supplier_gst: string;
  invoice_number: string;
  invoice_date: string;
  grand_total: number;
  subtotal: number;
  discount: number;
  gst_tax: number;
  po_number: string;
}

interface ComponentRow {
  id: string;
  item_name: string;
  part_number: string;
  category: string;
  description: string;
  features: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  confidence: 'high' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  status: string;
  is_new: boolean;
  is_existing: boolean;
  existing_id: string | null;
  old_stock: number;
  new_stock: number;
  selected?: boolean;
  possible_match?: {
    id: string;
    name: string;
    similarity: number;
  } | null;
  accepted_as_new?: boolean;
}

export const PurchaseBillImport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.role === 'faculty' || user?.role === 'admin') {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-gray-200 m-6">
        <h2 className="text-xl font-bold text-red-600">Access Denied</h2>
        <p className="text-gray-500 mt-2">The Purchase Bills feature has been disabled for Faculty and Admin.</p>
      </div>
    );
  }

  // Step 1: Upload, Step 2: Processing, Step 3: Editor & Verification, Step 4: Summary, Step 5: Success
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);

  // Editable invoice and component lists
  const [metadata, setMetadata] = useState<InvoiceMetadata>({
    supplier_name: '',
    supplier_gst: '',
    invoice_number: '',
    invoice_date: '',
    grand_total: 0,
    subtotal: 0,
    discount: 0,
    gst_tax: 0,
    po_number: ''
  });
  
  const [lineItems, setLineItems] = useState<ComponentRow[]>([]);
  const [excludedItems, setExcludedItems] = useState<ComponentRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [acknowledgeMismatch, setAcknowledgeMismatch] = useState(false);

  // Checklist for final confirmation step
  const [checklist, setChecklist] = useState({
    details: false,
    components: false,
    stock: false,
    total: false
  });

  const [importSummary, setImportSummary] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVerifyAfterEdit = (index: number, updatedItem: ComponentRow) => {
    const updated = [...lineItems];
    updated[index] = updatedItem;
    setLineItems(updated);
    setTimeout(handleVerify, 100);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (!ext || !['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
        toast.error("Unsupported file format. Please upload a PDF, PNG, or JPG image.");
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error("File exceeds the 20MB size limit.");
        return;
      }

      setFile(selectedFile);
      setFileType(ext === 'pdf' ? 'pdf' : 'image');
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setStep(2);
      await processOCR(selectedFile);
    }
  };

  const processOCR = async (selectedFile: File) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const headers = await getAuthHeaders();
      delete headers['Content-Type'];

      const response = await fetch(`/api/imports/purchase/ocr`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'OCR Failed');
      }

      const result = await response.json();
      
      setMetadata({
        supplier_name: result.metadata.supplier_name || '',
        supplier_gst: result.metadata.supplier_gst || '',
        invoice_number: result.metadata.invoice_number || '',
        invoice_date: result.metadata.invoice_date || '',
        grand_total: result.metadata.grand_total || 0,
        subtotal: result.metadata.subtotal || 0,
        discount: result.metadata.discount || 0,
        gst_tax: result.metadata.gst_tax || 0,
        po_number: result.metadata.po_number || ''
      });

      // Mark all parsed line items selected by default
      const parsedItems = (result.line_items || []).map((item: any) => ({
        ...item,
        selected: true
      }));

      setLineItems(parsedItems);
      setExcludedItems(result.excluded_items || []);
      setWarnings(result.warnings || []);
      setStep(3); // Go to editor
    } catch (err: any) {
      toast.error(`OCR Processing Error: ${err.message}`);
      setStep(1);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMetadataChange = (field: keyof InvoiceMetadata, val: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: field === 'grand_total' || field === 'subtotal' || field === 'gst_tax' || field === 'discount'
        ? parseFloat(val) || 0
        : val
    }));
  };

  const handleCellEdit = (index: number, field: keyof ComponentRow, value: any) => {
    const updated = [...lineItems];
    const row = { ...updated[index] };
    
    if (field === 'quantity') {
      row.quantity = parseInt(value) || 0;
      row.total = row.quantity * row.unit_price;
    } else if (field === 'unit_price') {
      row.unit_price = parseFloat(value) || 0;
      row.total = row.quantity * row.unit_price;
    } else {
      (row as any)[field] = value;
    }
    
    row.new_stock = row.old_stock + row.quantity;
    updated[index] = row;
    setLineItems(updated);
  };

  const addRow = () => {
    const newItem: ComponentRow = {
      id: `manual-item-${Date.now()}`,
      item_name: '',
      part_number: '',
      category: 'Electronics',
      description: 'Imported via Purchase Bill OCR',
      features: '',
      quantity: 1,
      unit: 'pcs',
      unit_price: 0,
      total: 0,
      confidence: 'high',
      errors: [],
      warnings: [],
      status: 'NEW',
      is_new: true,
      is_existing: false,
      existing_id: null,
      old_stock: 0,
      new_stock: 1,
      selected: true
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const deleteRow = (index: number) => {
    const item = lineItems[index];
    setExcludedItems(prev => [...prev, { ...item, selected: false }]);
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const restoreExcludedItem = (index: number) => {
    const item = excludedItems[index];
    setLineItems(prev => [...prev, { ...item, selected: true }]);
    setExcludedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleVerify = async () => {
    try {
      const response = await apiRequest(`/api/imports/purchase/verify`, {
        method: 'POST',
        body: JSON.stringify({
          metadata,
          line_items: lineItems
        })
      });
      setLineItems(response.line_items);
      toast.success("Verification check complete!");
    } catch (error: any) {
      toast.error(`Verification Failed: ${error.message}`);
    }
  };

  const handleConfirmPurchase = async () => {
    setIsConfirming(true);
    try {
      const response = await apiRequest(`/api/imports/purchase/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          metadata: {
            ...metadata,
            duplicates_merged: lineItems.filter(r => r.warnings.some(w => w.includes("Merged"))).length
          },
          line_items: lineItems.filter(r => r.selected)
        })
      });

      setImportSummary(response.metrics);
      setStep(5); // Success step
      toast.success("Purchase bill stock committed safely!");
    } catch (error: any) {
      toast.error(`Commit Failed: ${error.message}`);
      setStep(3);
    } finally {
      setIsConfirming(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setPreviewUrl(null);
    setFileType(null);
    setMetadata({
      supplier_name: '',
      supplier_gst: '',
      invoice_number: '',
      invoice_date: '',
      grand_total: 0,
      subtotal: 0,
      discount: 0,
      gst_tax: 0,
      po_number: ''
    });
    setLineItems([]);
    setExcludedItems([]);
    setWarnings([]);
    setChecklist({
      details: false,
      components: false,
      stock: false,
      total: false
    });
  };

  const renderStepper = () => {
    const steps = [
      { name: "Upload bill", num: 1 },
      { name: "OCR Processing", num: 2 },
      { name: "Verify & Edit", num: 3 },
      { name: "Confirm Summary", num: 4 },
      { name: "Success", num: 5 }
    ];
    return (
      <div className="flex items-center justify-between mb-8 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm overflow-x-auto">
        {steps.map((s, i) => (
          <div key={s.name} className="flex items-center flex-shrink-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm transition-all duration-300 ${
              step > s.num ? 'bg-green-500 border-green-500 text-white' : 
              step === s.num ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-105' : 
              'border-gray-200 text-gray-400 bg-white'
            }`}>
              {step > s.num ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`ml-2 text-xs sm:text-sm font-semibold transition-all duration-300 ${
              step >= s.num ? 'text-gray-900' : 'text-gray-400'
            }`}>{s.name}</span>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 mx-3 sm:mx-4 text-gray-300" />}
          </div>
        ))}
      </div>
    );
  };

  // Validation calculations
  const totalComponentsCost = lineItems.reduce((acc, r) => acc + (r.selected ? r.total : 0), 0);
  const totalCharges = excludedItems.reduce((acc, r) => acc + r.total, 0);
  const calculatedTotal = totalComponentsCost + totalCharges + metadata.gst_tax - metadata.discount;
  const totalMismatch = Math.abs(calculatedTotal - metadata.grand_total) > 5;

  const getCriticalErrorsList = () => {
    const errs: string[] = [];
    const selectedItems = lineItems.filter(r => r.selected);
    
    if (selectedItems.length === 0) {
      errs.push("At least one component must be selected.");
    }
    
    selectedItems.forEach((r, idx) => {
      const rowNum = idx + 1;
      if (!r.item_name || !r.item_name.trim()) {
        errs.push(`Row #${rowNum}: Component name is required.`);
      }
      if (r.quantity <= 0) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Unnamed'}): Quantity must be greater than zero.`);
      }
      if (r.unit_price < 0) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Unnamed'}): Unit price cannot be negative.`);
      }
      if (!r.category || r.category === 'Select Category') {
        errs.push(`Row #${rowNum} (${r.item_name || 'Unnamed'}): Required category selection.`);
      }
      if (r.status && r.status.includes('POSSIBLE MATCH')) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Unnamed'}): Unresolved possible database match.`);
      }
      if (r.errors && r.errors.length > 0) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Unnamed'}): ${r.errors.join(", ")}`);
      }
    });
    
    return errs;
  };
  
  const criticalErrors = getCriticalErrorsList();
  const hasCriticalErrors = criticalErrors.length > 0;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-green-600" />
            OCR Scanned Purchase Bill Ingestion
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Scan scanned invoices or PDF files. Automatic tabular layout extraction, metadata rules, duplicate combining, and component mapping.
          </p>
        </div>
      </div>

      {renderStepper()}

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 flex items-start gap-4">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-blue-900 text-sm sm:text-base">Document Scanning Engine</h4>
              <p className="text-xs sm:text-sm text-blue-700 mt-1">
                Upload scanned images (PNG, JPG, JPEG) or PDF documents. The PIL enhancement pipeline improves readability and sharpening before running Tesseract OCR.
              </p>
            </div>
          </div>

          <div 
            className="border-2 border-dashed border-gray-300 rounded-3xl p-16 text-center hover:bg-blue-50/30 hover:border-blue-500 transition-all duration-300 cursor-pointer bg-white shadow-sm flex flex-col items-center justify-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const selectedFile = e.dataTransfer.files[0];
                const ext = selectedFile.name.split('.').pop()?.toLowerCase();
                if (ext && ['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
                  setFile(selectedFile);
                  setFileType(ext === 'pdf' ? 'pdf' : 'image');
                  setPreviewUrl(URL.createObjectURL(selectedFile));
                  setStep(2);
                  await processOCR(selectedFile);
                } else {
                  toast.error("Unsupported file format.");
                }
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf, .png, .jpg, .jpeg" 
              className="hidden" 
            />
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5 hover:scale-105 transition-all">
              <Upload className="w-10 h-10" />
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2">Drag and drop purchase bill here</h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-6">Supports PDF, PNG, JPG, JPEG (Max 20MB)</p>
            <span className="px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-md text-white bg-blue-600 hover:bg-blue-700 hover:shadow-lg transition-all scale-100 hover:scale-105 active:scale-95">
              Select Invoice File
            </span>
          </div>
        </div>
      )}

      {/* STEP 2: OCR Processing Loader */}
      {step === 2 && (
        <div className="mt-16 flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <Loader2 className="w-14 h-14 text-blue-600 animate-spin mb-6" />
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900">Running OCR Preprocessing...</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-2 text-center px-6">
            Grayscaling, enhancing contrast, resizing, and sharpening to extract clean text. Checking names in components catalog.
          </p>
        </div>
      )}

      {/* STEP 3: Preview, Edit & Table Grid */}
      {step === 3 && (
        <div className="flex flex-col lg:flex-row gap-6 overflow-hidden">
          {/* Left panel: File preview */}
          <div className="lg:w-1/3 bg-gray-100 rounded-3xl border border-gray-200 overflow-hidden min-h-[400px] flex flex-col">
            <div className="bg-gray-50 px-5 py-3.5 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Bill Document</span>
            </div>
            <div className="flex-1 min-h-[450px]">
              {fileType === 'pdf' && previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full border-0" title="PDF Preview" />
              ) : previewUrl ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center p-4 bg-gray-50">
                  <img src={previewUrl} alt="Scanned Invoice" className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
                </div>
              ) : null}
            </div>
          </div>

          {/* Right panel: Metadata Forms & Components Table */}
          <div className="lg:w-2/3 space-y-6">
            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-amber-950 text-sm">OCR Warnings Review</h5>
                  <ul className="text-xs text-amber-700 list-disc list-inside mt-1">
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {totalMismatch && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-red-950 text-sm">Invoice Total Mismatch</h5>
                  <p className="text-xs text-red-700 mt-1">
                    The calculated total of <strong>₹{calculatedTotal.toFixed(2)}</strong> (component totals + taxes - discount) does not match the invoice grand total of <strong>₹{metadata.grand_total.toFixed(2)}</strong> (Difference: <strong>₹{Math.abs(calculatedTotal - metadata.grand_total).toFixed(2)}</strong>).
                  </p>
                  <p className="text-[10px] text-red-500 mt-1 font-semibold">Please correct row details or PO header fields to resolve this mismatch.</p>
                </div>
              </div>
            )}

            {hasCriticalErrors && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-bold text-red-950 text-sm">Required Corrections Before Confirmation</h5>
                  <ul className="text-xs text-red-700 list-disc list-inside mt-1 space-y-1">
                    {criticalErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Metadata Fields Form */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">Invoice Header Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supplier Name</label>
                  <input 
                    type="text" 
                    value={metadata.supplier_name}
                    onChange={e => handleMetadataChange('supplier_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supplier GSTIN</label>
                  <input 
                    type="text" 
                    value={metadata.supplier_gst}
                    onChange={e => handleMetadataChange('supplier_gst', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Invoice Number</label>
                  <input 
                    type="text" 
                    value={metadata.invoice_number}
                    onChange={e => handleMetadataChange('invoice_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Invoice Date</label>
                  <input 
                    type="text" 
                    value={metadata.invoice_date}
                    onChange={e => handleMetadataChange('invoice_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PO Number (Optional)</label>
                  <input 
                    type="text" 
                    value={metadata.po_number}
                    onChange={e => handleMetadataChange('po_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subtotal</label>
                  <input 
                    type="number" 
                    value={metadata.subtotal}
                    onChange={e => handleMetadataChange('subtotal', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GST Tax</label>
                  <input 
                    type="number" 
                    value={metadata.gst_tax}
                    onChange={e => handleMetadataChange('gst_tax', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discount</label>
                  <input 
                    type="number" 
                    value={metadata.discount}
                    onChange={e => handleMetadataChange('discount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Grand Total</label>
                  <input 
                    type="number" 
                    value={metadata.grand_total}
                    onChange={e => handleMetadataChange('grand_total', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-blue-600 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Component Line Items Table Grid */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">Extracted Components</h3>
                <button onClick={addRow} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add Component
                </button>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">Select</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                      <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-28">Category</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-20">Qty</th>
                      <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase w-24">Rate</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-20">Old Stock</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase w-20">New Stock</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Match</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          <input 
                            type="checkbox" 
                            checked={!!item.selected}
                            onChange={() => {
                              const updated = [...lineItems];
                              updated[idx].selected = !updated[idx].selected;
                              setLineItems(updated);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-col min-w-[200px]">
                            <input 
                              type="text" 
                              value={item.item_name}
                              onChange={e => handleCellEdit(idx, 'item_name', e.target.value)}
                              className="w-full px-2.5 py-1 border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white rounded-xl text-sm font-semibold"
                            />
                            {item.errors && item.errors.length > 0 && (
                              <span className="text-[10px] text-red-500 font-bold px-2 mt-0.5">{item.errors.join(", ")}</span>
                            )}
                            {item.warnings && item.warnings.length > 0 && !item.status.includes("POSSIBLE MATCH") && (
                              <span className="text-[10px] text-amber-500 font-bold px-2 mt-0.5">{item.warnings.join(", ")}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <input 
                              type="text" 
                              value={item.category}
                              onChange={e => handleCellEdit(idx, 'category', e.target.value)}
                              className={`w-full px-2 py-1 border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white rounded-xl text-xs font-bold ${
                                item.category === 'Select Category' ? 'text-red-500 italic' : ''
                              }`}
                            />
                            {item.category === 'Select Category' && (
                              <span className="text-[9px] text-red-500 font-extrabold px-2 mt-0.5">⚠ Required</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <input 
                            type="number" 
                            value={item.quantity}
                            onChange={e => handleCellEdit(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white rounded-xl text-sm font-bold text-center font-mono"
                          />
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <input 
                            type="number" 
                            step="0.01"
                            value={item.unit_price}
                            onChange={e => handleCellEdit(idx, 'unit_price', e.target.value)}
                            className="w-full px-2 py-1 border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white rounded-xl text-sm font-mono text-right"
                          />
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap text-xs text-gray-500 font-mono">
                          {item.old_stock}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap text-xs text-blue-600 font-bold font-mono">
                          {item.new_stock}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-center">
                          {(() => {
                            const status = item.status || '';
                            if (status.includes('✓ VERIFIED EXISTING') || status === 'EXISTING') {
                              return <span className="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-green-200">✓ VERIFIED EXISTING</span>;
                            }
                            if (status.includes('✓ VERIFIED NEW') || status === 'NEW') {
                              return <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200">✓ VERIFIED NEW</span>;
                            }
                            if (status.includes('POSSIBLE MATCH')) {
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="bg-amber-50 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">⚠ POSSIBLE MATCH</span>
                                  {item.possible_match && (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[9px] text-gray-500 font-medium">Match: {item.possible_match.name} ({item.possible_match.similarity}%)</span>
                                      <div className="flex gap-1.5 mt-1">
                                        <button 
                                          onClick={() => {
                                            handleCellEdit(idx, 'item_name', item.possible_match!.name);
                                            handleVerifyAfterEdit(idx, { 
                                              ...item, 
                                              item_name: item.possible_match!.name, 
                                              status: '✓ VERIFIED EXISTING', 
                                              is_existing: true, 
                                              is_new: false, 
                                              possible_match: null 
                                            });
                                          }} 
                                          className="px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold rounded shadow-sm transition"
                                        >
                                          Accept Match
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const updated = [...lineItems];
                                            updated[idx] = { ...updated[idx], accepted_as_new: true };
                                            setLineItems(updated);
                                            setTimeout(handleVerify, 100);
                                          }} 
                                          className="px-1.5 py-0.5 bg-gray-500 hover:bg-gray-600 text-white text-[9px] font-bold rounded shadow-sm transition"
                                        >
                                          Treat as New
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            if (status.includes('LOW OCR CONFIDENCE')) {
                              return <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">⚠ LOW OCR CONFIDENCE</span>;
                            }
                            if (status.includes('NEEDS EDIT')) {
                              return <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">⚠ NEEDS EDIT</span>;
                            }
                            if (status.includes('TOTAL MISMATCH')) {
                              return <span className="bg-red-50 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200">✕ TOTAL MISMATCH</span>;
                            }
                            return <span className="bg-red-50 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-200">✕ INVALID</span>;
                          })()}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button onClick={() => deleteRow(idx)} className="text-gray-400 hover:text-red-500 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {lineItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400 font-semibold">
                          All items excluded or empty. Click Add Component above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
                <button onClick={handleVerify} className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-sm transition">
                  Re-Verify Items
                </button>
              </div>
            </div>

            {/* Excluded Non-Component items */}
            {excludedItems.length > 0 && (
              <div className="bg-gray-50 rounded-3xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">Excluded Invoice Lines</h4>
                  <p className="text-xs text-gray-500">Lines identified as non-component expenses (shipping, taxes). You can restore them if needed.</p>
                </div>
                
                <div className="space-y-2">
                  {excludedItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-xs font-semibold">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 truncate font-bold">{item.item_name}</p>
                        <span className="text-[10px] text-gray-400 font-mono">Qty: {item.quantity} | Total: ₹{item.total.toFixed(2)}</span>
                      </div>
                      <button onClick={() => restoreExcludedItem(idx)} className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold rounded-lg transition">
                        Restore as Component
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stepper controls */}
            <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-200">
              <button onClick={resetWizard} className="text-gray-500 hover:text-black font-semibold text-sm">
                Clear
              </button>
              <button 
                onClick={() => setStep(4)} 
                disabled={hasCriticalErrors || lineItems.filter(r => r.selected).length === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow disabled:opacity-50 transition flex items-center gap-1.5"
              >
                Proceed to Confirmation
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Confirmation Checklist & Metrics */}
      {step === 4 && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Checklist Card */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Administrator Verification Checklist</h3>
                <p className="text-xs text-gray-500 mt-0.5">Please check all boxes after verifying OCR details against the original invoice document.</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-100 hover:bg-gray-50 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={checklist.details}
                    onChange={() => setChecklist(prev => ({ ...prev, details: !prev.details }))}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-800">I have verified the invoice details</span>
                    <p className="text-xs text-gray-400 mt-0.5">Supplier Name, Date, Invoice Reference, and GSTIN entries are correct.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-100 hover:bg-gray-50 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={checklist.components}
                    onChange={() => setChecklist(prev => ({ ...prev, components: !prev.components }))}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-800">I have verified the component names and quantities</span>
                    <p className="text-xs text-gray-400 mt-0.5">Component catalog lookup entries map correctly without spelling mistakes.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-100 hover:bg-gray-50 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={checklist.stock}
                    onChange={() => setChecklist(prev => ({ ...prev, stock: !prev.stock }))}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-800">I have verified stock changes</span>
                    <p className="text-xs text-gray-400 mt-0.5">The resulting math (Existing Stock + Purchased Qty = New Stock) is correct.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-100 hover:bg-gray-50 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={checklist.total}
                    onChange={() => setChecklist(prev => ({ ...prev, total: !prev.total }))}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-800">I have verified the invoice total</span>
                    <p className="text-xs text-gray-400 mt-0.5">The item row totals sum up correctly to the grand total in the header.</p>
                  </div>
                </label>

                {totalMismatch && (
                  <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-red-100 bg-red-50/50 hover:bg-red-50 cursor-pointer select-none mt-2">
                    <input 
                      type="checkbox" 
                      checked={acknowledgeMismatch}
                      onChange={() => setAcknowledgeMismatch(!acknowledgeMismatch)}
                      className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-500 w-4.5 h-4.5"
                    />
                    <div>
                      <span className="text-sm font-bold text-red-950">Acknowledge Invoice Total Mismatch</span>
                      <p className="text-xs text-red-800 mt-0.5">
                        I acknowledge the difference of ₹{Math.abs(calculatedTotal - metadata.grand_total).toFixed(2)} between the calculated total and the invoice total, and explicitly verify this is acceptable.
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Import summary card */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Purchase Summary</h3>
                <p className="text-xs text-gray-500 mt-0.5">Summary of transaction changes to write to database.</p>
              </div>

              <div className="p-6 space-y-4 text-sm">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Supplier:</span>
                  <span className="font-bold text-gray-900 truncate max-w-[150px]">{metadata.supplier_name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Invoice:</span>
                  <span className="font-bold text-gray-900 font-mono">{metadata.invoice_number}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Taxes (GST):</span>
                  <span className="font-bold text-gray-900 font-mono">₹{metadata.gst_tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">New Components:</span>
                  <span className="font-bold text-blue-600">+{lineItems.filter(r => r.selected && r.is_new).length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Existing Components:</span>
                  <span className="font-bold text-purple-600">+{lineItems.filter(r => r.selected && r.is_existing).length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 bg-green-50/20 px-3 -mx-3 rounded-xl">
                  <span className="text-green-950 font-bold">Total stock units:</span>
                  <span className="font-black text-green-600">+{lineItems.filter(r => r.selected).reduce((acc, r) => acc + r.quantity, 0)} units</span>
                </div>
                <div className="flex justify-between py-1.5 bg-blue-50/20 px-3 -mx-3 rounded-xl border-t border-blue-100 mt-2">
                  <span className="text-blue-950 font-bold">Grand Total Cost:</span>
                  <span className="font-black text-blue-600 font-mono">₹{metadata.grand_total.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
                <button 
                  onClick={handleConfirmPurchase}
                  disabled={
                    isConfirming || 
                    hasCriticalErrors || 
                    !(checklist.details && checklist.components && checklist.stock && checklist.total) || 
                    (totalMismatch && !acknowledgeMismatch)
                  }
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Purchase & Update Stock
                </button>
                <button 
                  onClick={() => setStep(3)} 
                  className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition text-center"
                >
                  &larr; Back to Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Success Summary */}
      {step === 5 && importSummary && (
        <div className="max-w-3xl mx-auto bg-white shadow-lg border border-gray-100 rounded-3xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Purchase Ingested Successfully</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">D1 database transactions committed atomically. Stocks updated.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <span className="text-2xl font-black text-blue-600">{importSummary.imported || 0}</span>
              <p className="text-xs font-bold text-blue-900 uppercase tracking-wide mt-1">Added</p>
            </div>
            <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
              <span className="text-2xl font-black text-purple-600">{importSummary.updated || 0}</span>
              <p className="text-xs font-bold text-purple-900 uppercase tracking-wide mt-1">Updated</p>
            </div>
            <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
              <span className="text-2xl font-black text-green-600">{importSummary.stock_units_added || 0}</span>
              <p className="text-xs font-bold text-green-900 uppercase tracking-wide mt-1">Stock Units</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <span className="text-2xl font-black text-gray-600">
                {importSummary.skipped || 0}
              </span>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Skipped</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <button 
              onClick={() => navigate(user?.role === 'admin' ? '/admin/inventory' : '/faculty/inventory')} 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all scale-100 hover:scale-105 active:scale-95"
            >
              View Components List
            </button>
            <button 
              onClick={() => navigate(user?.role === 'admin' ? '/admin/purchases' : '/faculty/purchases')} 
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-2xl transition-all scale-100 hover:scale-105 active:scale-95"
            >
              View Purchases List
            </button>
            <button 
              onClick={resetWizard} 
              className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm rounded-2xl transition-all scale-100"
            >
              Upload Another Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
