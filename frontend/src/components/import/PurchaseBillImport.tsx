import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  Camera,
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize2,
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Save, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  Check, 
  AlertTriangle, 
  ArrowRight,
  ArrowLeft,
  Database,
  RefreshCw,
  Eye,
  Info,
  DollarSign,
  Building2,
  Calendar,
  Hash,
  Search,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Percent,
  CheckCheck
} from 'lucide-react';
import { apiRequest, getAuthHeaders, buildApiUrl } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface InvoiceMetadata {
  supplier_name: string;
  supplier_gst: string;
  supplier_phone?: string;
  supplier_address?: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  po_number: string;
  subtotal: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst_tax: number;
  discount: number;
  round_off: number;
  grand_total: number;
  printed_grand_total?: number | null;
  calculated_grand_total?: number | null;
  calculated_total?: number;
  has_discrepancy?: boolean;
  discrepancy_amount?: number;
  discrepancies?: string[];
  fields?: Record<string, any>;
  confidence?: Record<string, number>;
  uncertain_fields?: string[];
  is_duplicate?: boolean;
  duplicate_info?: {
    invoice_number: string;
    supplier_name: string;
    existing_id?: string;
    created_at?: string;
  } | null;
  supplier_match?: {
    id: string;
    name: string;
    gstin: string;
    phone?: string;
    address?: string;
    is_existing: boolean;
  } | null;
}

interface ComponentRow {
  id: string;
  item_name: string;
  original_item_name?: string;
  hsn_code: string;
  part_number: string;
  category: string;
  description: string;
  features?: string;
  quantity: number;
  raw_quantity?: number | null;
  unit: string;
  unit_price: number;
  raw_unit_price?: number | null;
  discount: number;
  tax_rate: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total: number;
  raw_total?: number | null;
  calculated_total?: number | null;
  confidence_score: number;
  field_confidences?: Record<string, number>;
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
    stock?: number;
  } | null;
  accepted_as_new?: boolean;
}

export const PurchaseBillImport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role validation: Admin & Super Admin are primary; Student is denied
  if (user && user.role === 'student') {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-gray-200 m-6 max-w-xl mx-auto shadow-sm">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900">Access Restricted</h2>
        <p className="text-gray-500 mt-2 text-sm">
          The Smart Purchase Bill Automation module is restricted to administrators and procurement staff.
        </p>
      </div>
    );
  }

  // Workflow Steps:
  // 1: Upload / Photograph
  // 2: Intelligent Extraction (Processing)
  // 3: Side-by-Side Verification & Matching
  // 4: Confirmation Checklist Modal / Review
  // 5: Success & Purchase Register Committal
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);
  const [fileSizeStr, setFileSizeStr] = useState<string>('');

  // Processing Progress simulation
  const [extractionProgress, setExtractionProgress] = useState<number>(15);
  const [extractionStage, setExtractionStage] = useState<string>('Validating document...');

  // Viewer Controls for Left Preview Panel
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Search filter for 40+ line items in right panel
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');

  // Extracted Metadata
  const [metadata, setMetadata] = useState<InvoiceMetadata>({
    supplier_name: '',
    supplier_gst: '',
    supplier_phone: '',
    supplier_address: '',
    invoice_number: '',
    invoice_date: '',
    due_date: '',
    po_number: '',
    subtotal: 0,
    taxable_amount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    gst_tax: 0,
    discount: 0,
    round_off: 0,
    grand_total: 0,
    confidence: {},
    uncertain_fields: [],
    is_duplicate: false
  });

  const [lineItems, setLineItems] = useState<ComponentRow[]>([]);
  const [excludedItems, setExcludedItems] = useState<ComponentRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [acknowledgeMismatch, setAcknowledgeMismatch] = useState<boolean>(false);
  const [allowDuplicateCommit, setAllowDuplicateCommit] = useState<boolean>(false);

  // Confirmation Checklist
  const [checklist, setChecklist] = useState({
    details: false,
    components: false,
    stock: false,
    total: false
  });

  const [importSummary, setImportSummary] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // File size formatter
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  };

  const handleSelectFile = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
      toast.error('Unsupported file format. Please upload a PDF, PNG, JPG, or JPEG file.');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('File size exceeds the 20MB limit.');
      return;
    }

    setFile(selectedFile);
    setFileSizeStr(formatFileSize(selectedFile.size));
    const isPdfDoc = ext === 'pdf';
    setFileType(isPdfDoc ? 'pdf' : 'image');
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setZoomLevel(100);
    setRotation(0);
    setStep(2);
    await processOCR(selectedFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0]);
    }
  };

  const processOCR = async (selectedFile: File) => {
    setIsProcessing(true);
    setExtractionProgress(20);
    setExtractionStage('Preprocessing document and sharpening image...');

    const stageTimer1 = setTimeout(() => {
      setExtractionProgress(45);
      setExtractionStage('Optical Character Recognition (OCR) running...');
    }, 400);

    const stageTimer2 = setTimeout(() => {
      setExtractionProgress(70);
      setExtractionStage('Extracting line items, HSN codes, and GST breakdown...');
    }, 900);

    const stageTimer3 = setTimeout(() => {
      setExtractionProgress(90);
      setExtractionStage('Matching items against EI HUB inventory master...');
    }, 1400);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const headers = await getAuthHeaders();
      delete headers['Content-Type'];

      const response = await fetch(buildApiUrl('/api/imports/purchase/ocr'), {
        method: 'POST',
        headers,
        body: formData
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'OCR processing failed');
      }

      const result = await response.json();
      setExtractionProgress(100);
      setExtractionStage('Extraction complete!');

      const meta = result.metadata || {};
      setMetadata({
        supplier_name: meta.supplier_name || '',
        supplier_gst: meta.supplier_gst || '',
        supplier_phone: meta.supplier_match?.phone || '',
        supplier_address: meta.supplier_match?.address || '',
        invoice_number: meta.invoice_number || '',
        invoice_date: meta.invoice_date || '',
        due_date: meta.due_date || '',
        po_number: meta.po_number || '',
        subtotal: meta.subtotal || 0,
        taxable_amount: meta.taxable_amount || meta.subtotal || 0,
        cgst: meta.cgst || 0,
        sgst: meta.sgst || 0,
        igst: meta.igst || 0,
        gst_tax: meta.gst_tax || 0,
        discount: meta.discount || 0,
        round_off: meta.round_off || 0,
        grand_total: meta.grand_total || 0,
        printed_grand_total: meta.printed_grand_total ?? meta.grand_total ?? null,
        calculated_grand_total: meta.calculated_grand_total ?? meta.calculated_total ?? null,
        calculated_total: meta.calculated_total || meta.calculated_grand_total || 0,
        has_discrepancy: !!meta.has_discrepancy,
        discrepancy_amount: meta.discrepancy_amount ?? 0,
        discrepancies: meta.discrepancies || [],
        fields: meta.fields || {},
        confidence: meta.confidence || {},
        uncertain_fields: meta.uncertain_fields || [],
        is_duplicate: !!meta.is_duplicate,
        duplicate_info: meta.duplicate_info || null,
        supplier_match: meta.supplier_match || null
      });

      const parsedItems = (result.line_items || []).map((item: any, idx: number) => ({
        ...item,
        id: item.id || `row-${idx}-${Date.now()}`,
        original_item_name: item.original_item_name || item.item_name || '',
        item_name: item.item_name || item.original_item_name || '',
        unit: item.unit || 'pcs',
        hsn_code: item.hsn_code || '',
        discount: item.discount || 0,
        tax_rate: item.tax_rate || 18,
        raw_quantity: item.raw_quantity,
        raw_unit_price: item.raw_unit_price,
        raw_total: item.raw_total,
        calculated_total: item.calculated_total,
        field_confidences: item.field_confidences || {},
        selected: true
      }));

      setLineItems(parsedItems);
      setExcludedItems(result.excluded_items || []);
      setWarnings(result.warnings || []);
      
      // Delay transition slightly for smooth visual progression
      setTimeout(() => {
        setStep(3); // Enter side-by-side verification
      }, 300);

    } catch (err: any) {
      toast.error(`OCR Extraction Error: ${err.message}`);
      setStep(1);
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMetadataChange = (field: keyof InvoiceMetadata, val: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: ['grand_total', 'subtotal', 'taxable_amount', 'cgst', 'sgst', 'igst', 'gst_tax', 'discount', 'round_off'].includes(field)
        ? parseFloat(val) || 0
        : val
    }));
  };

  const handleCellEdit = (index: number, field: keyof ComponentRow, value: any) => {
    const updated = [...lineItems];
    const row = { ...updated[index] };

    if (field === 'quantity') {
      row.quantity = parseInt(value) || 0;
      row.total = row.quantity * row.unit_price * (1 - (row.discount || 0) / 100);
      row.new_stock = (row.old_stock || 0) + row.quantity;
    } else if (field === 'unit_price') {
      row.unit_price = parseFloat(value) || 0;
      row.total = row.quantity * row.unit_price * (1 - (row.discount || 0) / 100);
    } else if (field === 'discount') {
      row.discount = parseFloat(value) || 0;
      row.total = row.quantity * row.unit_price * (1 - (row.discount || 0) / 100);
    } else {
      (row as any)[field] = value;
    }

    updated[index] = row;
    setLineItems(updated);
  };

  const addRow = () => {
    const newItem: ComponentRow = {
      id: `manual-item-${Date.now()}`,
      item_name: '',
      hsn_code: '',
      part_number: '',
      category: 'Electronics',
      description: 'Manually added purchase bill item',
      quantity: 1,
      unit: 'pcs',
      unit_price: 0,
      discount: 0,
      tax_rate: 18,
      total: 0,
      confidence_score: 100,
      errors: [],
      warnings: [],
      status: '✓ VERIFIED NEW',
      is_new: true,
      is_existing: false,
      existing_id: null,
      old_stock: 0,
      new_stock: 1,
      selected: true
    };
    setLineItems(prev => [newItem, ...prev]);
  };

  const deleteRow = (index: number) => {
    const item = lineItems[index];
    setExcludedItems(prev => [...prev, { ...item, selected: false }]);
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
    toast.info(`Moved "${item.item_name || 'Item'}" to excluded lines.`);
  };

  const restoreExcludedItem = (index: number) => {
    const item = excludedItems[index];
    setLineItems(prev => [...prev, { ...item, selected: true }]);
    setExcludedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await apiRequest(`/api/imports/purchase/verify`, {
        method: 'POST',
        body: JSON.stringify({
          metadata,
          line_items: lineItems
        })
      });
      setLineItems(response.line_items || lineItems);
      toast.success("Verification complete: Inventory master and stock levels re-checked!");
    } catch (error: any) {
      toast.error(`Verification Failed: ${error.message}`);
    } finally {
      setIsVerifying(false);
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
            allow_duplicate: allowDuplicateCommit,
            duplicates_merged: lineItems.filter(r => r.warnings.some(w => w.includes("Merged"))).length
          },
          line_items: lineItems.filter(r => r.selected)
        })
      });

      setImportSummary(response.metrics);
      setStep(5);
      toast.success("Purchase bill committed successfully! Inventory stocks and register updated.");
    } catch (error: any) {
      toast.error(`Commit Failed: ${error.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  // Cleanup temporary document object URLs to ensure zero permanent storage/memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {}
      }
    };
  }, [previewUrl]);

  const resetWizard = () => {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    }
    setStep(1);
    setFile(null);
    setPreviewUrl(null);
    setFileType(null);
    setFileSizeStr('');
    setZoomLevel(100);
    setRotation(0);
    setMetadata({
      supplier_name: '',
      supplier_gst: '',
      supplier_phone: '',
      supplier_address: '',
      invoice_number: '',
      invoice_date: '',
      due_date: '',
      po_number: '',
      subtotal: 0,
      taxable_amount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gst_tax: 0,
      discount: 0,
      round_off: 0,
      grand_total: 0,
      confidence: {},
      uncertain_fields: [],
      is_duplicate: false
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
    setAcknowledgeMismatch(false);
    setAllowDuplicateCommit(false);
  };

  // Reconciled financial calculations
  const totalComponentsCost = useMemo(() => {
    return lineItems.reduce((acc, r) => acc + (r.selected ? r.total : 0), 0);
  }, [lineItems]);

  const totalCharges = useMemo(() => {
    return excludedItems.reduce((acc, r) => acc + r.total, 0);
  }, [excludedItems]);

  const totalTaxCalculated = (metadata.cgst || 0) + (metadata.sgst || 0) + (metadata.igst || 0) || metadata.gst_tax || 0;
  const calculatedGrandTotal = totalComponentsCost + totalCharges + totalTaxCalculated - (metadata.discount || 0) + (metadata.round_off || 0);
  const totalMismatch = Math.abs(calculatedGrandTotal - metadata.grand_total) > 2.0;

  // Validation checks
  const getCriticalErrorsList = (): string[] => {
    const errs: string[] = [];
    const selected = lineItems.filter(r => r.selected);

    if (selected.length === 0) {
      errs.push("At least one line item must be selected.");
    }

    if (!metadata.invoice_number.trim()) {
      errs.push("Invoice Number is required.");
    }

    selected.forEach((r, idx) => {
      const rowNum = idx + 1;
      if (!r.item_name || !r.item_name.trim()) {
        errs.push(`Row #${rowNum}: Component name is required.`);
      }
      if (r.quantity <= 0) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Item'}): Quantity must be > 0.`);
      }
      if (r.unit_price < 0) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Item'}): Unit price cannot be negative.`);
      }
      if (r.status && r.status.includes('POSSIBLE MATCH') && !r.accepted_as_new) {
        errs.push(`Row #${rowNum} (${r.item_name || 'Item'}): Unresolved possible inventory match.`);
      }
    });

    return errs;
  };

  const criticalErrors = getCriticalErrorsList();
  const hasCriticalErrors = criticalErrors.length > 0;

  // Filtered line items for search
  const filteredLineItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return lineItems;
    const q = itemSearchQuery.toLowerCase();
    return lineItems.filter(item => 
      item.item_name.toLowerCase().includes(q) ||
      (item.hsn_code && item.hsn_code.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }, [lineItems, itemSearchQuery]);

  // GSTIN format checker
  const isValidGSTIN = (gst: string): boolean => {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst.trim());
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold tracking-wide mb-2 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
            Smart Bill Automation &middot; Optical Character Recognition
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            Import Purchase Bills from PDF &amp; JPG
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-3xl leading-relaxed">
            Eliminate manual purchase invoice data entry. Upload supplier PDF bills or capture invoice photographs to automatically extract invoice headers, line items, and GST taxes, match items against existing inventory, and commit verified records into the register.
          </p>
        </div>

        {step === 3 && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={resetWizard}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition-all"
            >
              Upload Another
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={hasCriticalErrors || lineItems.filter(r => r.selected).length === 0 || (totalMismatch && !acknowledgeMismatch)}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              Review &amp; Confirm
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Stepper Progress Header */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs overflow-x-auto gap-2">
        {[
          { name: "Upload Bill", num: 1 },
          { name: "Intelligent Extraction", num: 2 },
          { name: "Side-by-Side Verification", num: 3 },
          { name: "Confirmation", num: 4 },
          { name: "Purchase Register", num: 5 }
        ].map((s, idx) => (
          <div key={s.name} className="flex items-center shrink-0">
            <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 font-bold text-xs sm:text-sm transition-all duration-300 ${
              step > s.num ? 'bg-emerald-600 border-emerald-600 text-white' : 
              step === s.num ? 'bg-sky-600 border-sky-600 text-white shadow-sm ring-4 ring-sky-100 scale-105' : 
              'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {step > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span className={`ml-2 text-xs sm:text-sm font-semibold whitespace-nowrap ${
              step >= s.num ? 'text-gray-900 font-bold' : 'text-gray-400'
            }`}>
              {s.name}
            </span>
            {idx < 4 && <ChevronRight className="w-4 h-4 mx-2 sm:mx-3 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: Upload or Photograph Interface */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Two Prominent Upload Cards as specified in UI Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Supplier PDF Bills */}
            <div 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = ".pdf";
                  fileInputRef.current.click();
                }
              }}
              className="group cursor-pointer bg-white rounded-3xl p-6 border-2 border-gray-200 hover:border-sky-500 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-gray-900 group-hover:text-sky-600 transition-colors">
                  Supplier PDF Bills
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Direct text parsing &amp; OCR for digitally generated supplier invoices or scanned multi-page PDF documents.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-sky-600 flex items-center gap-1">
                  Upload PDF <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-semibold text-gray-400">PDF &middot; Up to 20MB</span>
              </div>
            </div>

            {/* Card 2: Camera Photo (JPG/PNG) */}
            <div 
              onClick={() => {
                if (cameraInputRef.current) {
                  cameraInputRef.current.click();
                }
              }}
              className="group cursor-pointer bg-white rounded-3xl p-6 border-2 border-gray-200 hover:border-sky-500 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-extrabold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  Camera Photo (JPG/PNG)
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Snap an invoice photograph with your mobile camera or upload clear printed receipts and scanned images.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  Take Photo / Browse <ArrowRight className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-semibold text-gray-400">JPG, JPEG, PNG</span>
              </div>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div 
            className="border-2 border-dashed border-sky-300 bg-sky-50/20 hover:bg-sky-50/40 rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center shadow-xs"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleSelectFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileInputChange} 
              accept=".pdf, .png, .jpg, .jpeg" 
              className="hidden" 
            />
            {/* Mobile Camera input with capture="environment" */}
            <input 
              type="file" 
              ref={cameraInputRef} 
              onChange={handleFileInputChange} 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
            />

            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-4 shadow-xs">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">
              Drag &amp; drop purchase bill here, or browse
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              Supports PDF, PNG, JPG, JPEG documents (Max file size: 20MB)
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                Browse Files
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                <Camera className="w-3.5 h-3.5 text-gray-500" />
                Capture with Camera
              </button>
            </div>
          </div>

          {/* Supported Format Guidelines Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 flex items-start gap-4 shadow-xs">
            <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-600 space-y-1">
              <h5 className="font-bold text-gray-900 text-sm">Best Practices for High OCR Accuracy:</h5>
              <p>&bull; For paper invoices, ensure even lighting without glare, shadows, or folded edges.</p>
              <p>&bull; Multi-page invoices are fully processed across all pages with automated table alignment.</p>
              <p>&bull; Items in invoice will be automatically fuzzy-matched against your existing Components catalog.</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: Intelligent Extraction Progress Animation */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="max-w-2xl mx-auto py-16 px-6 bg-white rounded-3xl border border-gray-200 text-center shadow-xs space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 rounded-full border-4 border-sky-100 border-t-sky-600 animate-spin flex items-center justify-center" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-sky-600 animate-pulse" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-gray-900">
              Intelligent OCR Extraction in Progress...
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              {extractionStage}
            </p>
          </div>

          {/* Extraction steps indicator */}
          <div className="space-y-2 text-left bg-gray-50 rounded-2xl p-4 border border-gray-100 max-w-md mx-auto text-xs">
            <div className="flex items-center gap-2 text-gray-700">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> File validation &amp; pre-processing
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Loader2 className="w-3.5 h-3.5 text-sky-600 animate-spin" /> Image contrast enhancement &amp; multi-pass Tesseract OCR
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              &bull; Extracting supplier GSTIN, invoice metadata, and line items
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              &bull; Fuzzy matching products with EI HUB inventory records
            </div>
          </div>

          {/* Progress bar */}
          <div className="max-w-md mx-auto">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-sky-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: Professional Split-Screen Verification Interface */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* ------------------------------------------------------------- */}
          {/* LEFT PANEL: Document Preview (5 cols on xl) */}
          {/* ------------------------------------------------------------- */}
          <div className="xl:col-span-5 bg-white rounded-3xl border border-gray-200 shadow-xs flex flex-col sticky top-4 max-h-[calc(100vh-120px)] overflow-hidden">
            {/* Viewer Header & Controls */}
            <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="text-xs font-bold text-gray-800 truncate max-w-[140px]" title={file?.name}>
                  {file?.name || 'Invoice Document'}
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                  {fileType || 'PDF'}
                </span>
              </div>

              {/* Zoom & Rotation Toolbar */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-700 transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold text-gray-600 w-10 text-center">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(250, prev + 15))}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-700 transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="text-[10px] font-bold px-2 py-1 rounded hover:bg-gray-200 text-gray-600 transition"
                  title="Reset Zoom"
                >
                  100%
                </button>
                <div className="h-4 w-px bg-gray-300 mx-1" />
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev - 90 + 360) % 360)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-700 transition"
                  title="Rotate Counter-Clockwise"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation(prev => (prev + 90) % 360)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-700 transition"
                  title="Rotate Clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Document Canvas / Viewport */}
            <div className="flex-1 bg-gray-100/70 overflow-auto p-4 flex items-center justify-center min-h-[500px]">
              {fileType === 'pdf' && previewUrl ? (
                <div 
                  className="w-full h-full min-h-[550px] transition-transform duration-200 origin-top flex items-center justify-center"
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`
                  }}
                >
                  <iframe 
                    src={previewUrl} 
                    className="w-full h-[550px] border-0 rounded-xl shadow-md bg-white" 
                    title="PDF Document Preview" 
                  />
                </div>
              ) : previewUrl ? (
                <div 
                  className="transition-transform duration-200 origin-center flex items-center justify-center p-2"
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`
                  }}
                >
                  <img 
                    src={previewUrl} 
                    alt="Uploaded Invoice Preview" 
                    className="max-w-full max-h-[600px] object-contain rounded-xl shadow-md bg-white" 
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400 py-16">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No preview available</p>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
              <span>File size: {fileSizeStr}</span>
              <span>Use zoom and rotate to verify small details</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* RIGHT PANEL: Extracted & Editable Information (7 cols on xl) */}
          {/* ------------------------------------------------------------- */}
          <div className="xl:col-span-7 space-y-5">
            {/* Duplicate Invoice Warning Alert Banner */}
            {metadata.is_duplicate && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h5 className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
                    Duplicate Invoice Detected in Database
                  </h5>
                  <p className="text-xs text-amber-800 mt-0.5">
                    An invoice with number <strong>#{metadata.invoice_number}</strong> for supplier <strong>{metadata.supplier_name || 'this supplier'}</strong> is already recorded in the EI HUB purchase register.
                  </p>
                  <label className="mt-2.5 inline-flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={allowDuplicateCommit}
                      onChange={(e) => setAllowDuplicateCommit(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    I acknowledge this duplicate and explicitly wish to proceed with importation
                  </label>
                </div>
              </div>
            )}

            {/* Total Mismatch Warning Alert Banner */}
            {totalMismatch && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="font-extrabold text-red-950 text-sm flex items-center gap-1.5">
                      Financial Reconciliation Discrepancy Detected
                    </h5>
                    <span className="font-mono text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                      Discrepancy: ₹{Math.abs(calculatedGrandTotal - metadata.grand_total).toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2.5 p-3 bg-white/80 rounded-xl border border-red-100 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-gray-500 font-sans uppercase font-bold block">Printed on Invoice</span>
                      <span className="font-black text-gray-900 text-sm">₹{metadata.grand_total.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-sans uppercase font-bold block">Calculated (Items + Tax)</span>
                      <span className="font-black text-sky-700 text-sm">₹{calculatedGrandTotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-sans uppercase font-bold block">Difference</span>
                      <span className="font-black text-red-600 text-sm">₹{Math.abs(calculatedGrandTotal - metadata.grand_total).toFixed(2)}</span>
                    </div>
                  </div>
                  {metadata.discrepancies && metadata.discrepancies.length > 0 && (
                    <ul className="list-disc list-inside text-[11px] text-red-800 mt-2 space-y-0.5">
                      {metadata.discrepancies.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                  <label className="mt-2.5 inline-flex items-center gap-2 text-xs font-bold text-red-950 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={acknowledgeMismatch}
                      onChange={(e) => setAcknowledgeMismatch(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    I have verified these amounts against the original document and wish to proceed
                  </label>
                </div>
              </div>
            )}

            {/* Critical Errors Summary */}
            {hasCriticalErrors && (
              <div className="bg-red-50/70 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div className="text-xs text-red-800">
                  <span className="font-bold">Required Corrections: </span>
                  {criticalErrors.join("; ")}
                </div>
              </div>
            )}

            {/* Card 1: Supplier Information */}
            <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Supplier &amp; Vendor Information
                  </h3>
                </div>
                {metadata.supplier_match?.is_existing ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCheck className="w-3 h-3" /> Verified Existing Supplier
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    + New Supplier Master
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      Supplier / Vendor Name *
                    </label>
                    {!metadata.supplier_name && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700">
                        Manual Entry Needed
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={metadata.supplier_name}
                    onChange={e => handleMetadataChange('supplier_name', e.target.value)}
                    placeholder="Enter supplier or vendor name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      Supplier GSTIN
                    </label>
                    {metadata.supplier_gst ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isValidGSTIN(metadata.supplier_gst) 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isValidGSTIN(metadata.supplier_gst) ? '✓ Valid' : 'Format check'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-gray-100 text-gray-500">
                        Not printed / Unregistered
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={metadata.supplier_gst}
                    onChange={e => handleMetadataChange('supplier_gst', e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Contact Phone
                  </label>
                  <input 
                    type="text" 
                    value={metadata.supplier_phone || ''}
                    onChange={e => handleMetadataChange('supplier_phone', e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Address / State
                  </label>
                  <input 
                    type="text" 
                    value={metadata.supplier_address || ''}
                    onChange={e => handleMetadataChange('supplier_address', e.target.value)}
                    placeholder="Supplier city, state or street address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Invoice Details */}
            <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Invoice Numbers &amp; Dates
                  </h3>
                </div>
                <span className="text-[11px] text-gray-400">
                  OCR Confidence: {metadata.confidence?.invoice_number || 95}%
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      Invoice Number *
                    </label>
                    {!metadata.invoice_number && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-700">
                        Required
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={metadata.invoice_number}
                    onChange={e => handleMetadataChange('invoice_number', e.target.value)}
                    placeholder="INV-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      Invoice Date *
                    </label>
                    {!metadata.invoice_date && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-700">
                        Required
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={metadata.invoice_date}
                    onChange={e => handleMetadataChange('invoice_date', e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Due Date
                  </label>
                  <input 
                    type="text" 
                    value={metadata.due_date}
                    onChange={e => handleMetadataChange('due_date', e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    P.O. Reference #
                  </label>
                  <input 
                    type="text" 
                    value={metadata.po_number}
                    onChange={e => handleMetadataChange('po_number', e.target.value)}
                    placeholder="PO-2026-..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Line Items Table (Practical for 40+ Items) */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
              {/* Table Toolbar */}
              <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Extracted Line Items
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                    {lineItems.length} items
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Search within line items */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      value={itemSearchQuery}
                      onChange={e => setItemSearchQuery(e.target.value)}
                      placeholder="Search items / HSN..."
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-sky-500 w-44 sm:w-56"
                    />
                  </div>

                  <button 
                    onClick={addRow}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
              </div>

              {/* Scrollable table container supporting 40+ items with sticky header */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50/95 backdrop-blur-xs sticky top-0 z-10 border-b border-gray-200">
                    <tr className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-3 py-2.5 text-center w-8">
                        <input 
                          type="checkbox" 
                          checked={lineItems.length > 0 && lineItems.every(r => r.selected)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setLineItems(prev => prev.map(r => ({ ...r, selected: val })));
                          }}
                          className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left min-w-[200px]">Item Name &amp; Description</th>
                      <th className="px-2 py-2.5 text-center w-20">HSN</th>
                      <th className="px-2 py-2.5 text-center w-16">Qty</th>
                      <th className="px-2 py-2.5 text-center w-20">Unit</th>
                      <th className="px-2 py-2.5 text-right w-24">Rate (₹)</th>
                      <th className="px-2 py-2.5 text-center w-16">Disc%</th>
                      <th className="px-2 py-2.5 text-right w-24">Total (₹)</th>
                      <th className="px-3 py-2.5 text-center min-w-[150px]">Master Matching</th>
                      <th className="px-2 py-2.5 text-center w-10">Del</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredLineItems.map((item) => {
                      const actualIdx = lineItems.findIndex(r => r.id === item.id);
                      return (
                        <tr key={item.id} className={`hover:bg-sky-50/30 transition-colors ${!item.selected ? 'opacity-40 bg-gray-50' : ''}`}>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            <input 
                              type="checkbox" 
                              checked={!!item.selected}
                              onChange={() => {
                                const updated = [...lineItems];
                                updated[actualIdx].selected = !updated[actualIdx].selected;
                                setLineItems(updated);
                              }}
                              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                            />
                          </td>

                          {/* Item Name */}
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={item.item_name}
                              onChange={e => handleCellEdit(actualIdx, 'item_name', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-sky-500 bg-transparent focus:bg-white text-xs font-semibold"
                            />
                            {item.original_item_name && (
                              <p className="text-[10px] text-gray-500 font-mono px-2 mt-0.5 truncate" title={item.original_item_name}>
                                <span className="text-gray-400 font-sans font-medium">Source:</span> {item.original_item_name}
                              </p>
                            )}
                            {item.warnings && item.warnings.length > 0 && (
                              <p className="text-[10px] text-amber-600 font-medium px-2 mt-0.5">
                                {item.warnings.join(", ")}
                              </p>
                            )}
                          </td>

                          {/* HSN Code */}
                          <td className="px-2 py-2">
                            <input 
                              type="text" 
                              value={item.hsn_code || ''}
                              onChange={e => handleCellEdit(actualIdx, 'hsn_code', e.target.value)}
                              placeholder="HSN"
                              className="w-full px-1.5 py-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-sky-500 bg-transparent focus:bg-white text-xs text-center font-mono"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="px-2 py-2">
                            <input 
                              type="number" 
                              value={item.quantity}
                              onChange={e => handleCellEdit(actualIdx, 'quantity', e.target.value)}
                              className="w-full px-1.5 py-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-sky-500 bg-transparent focus:bg-white text-xs text-center font-bold font-mono"
                            />
                          </td>

                          {/* Unit dropdown */}
                          <td className="px-2 py-2">
                            <select
                              value={item.unit || 'pcs'}
                              onChange={e => handleCellEdit(actualIdx, 'unit', e.target.value)}
                              className="w-full px-1 py-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-sky-500 bg-transparent focus:bg-white text-xs text-center"
                            >
                              <option value="pcs">pcs</option>
                              <option value="nos">nos</option>
                              <option value="pkts">pkts</option>
                              <option value="mtr">mtr</option>
                              <option value="kg">kg</option>
                              <option value="box">box</option>
                              <option value="set">set</option>
                            </select>
                          </td>

                          {/* Rate */}
                          <td className="px-2 py-2 text-right">
                            <input 
                              type="number" 
                              step="0.01"
                              value={item.unit_price}
                              onChange={e => handleCellEdit(actualIdx, 'unit_price', e.target.value)}
                              className="w-full px-1.5 py-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-sky-500 bg-transparent focus:bg-white text-xs text-right font-mono"
                            />
                          </td>

                          {/* Discount % */}
                          <td className="px-2 py-2 text-center">
                            <input 
                              type="number" 
                              step="0.5"
                              value={item.discount || 0}
                              onChange={e => handleCellEdit(actualIdx, 'discount', e.target.value)}
                              className="w-full px-1 py-1 rounded-lg border border-transparent hover:border-gray-200 focus:border-sky-500 bg-transparent focus:bg-white text-xs text-center font-mono"
                            />
                          </td>

                          {/* Total */}
                          <td className="px-2 py-2 text-right font-mono font-bold text-gray-900">
                            ₹{item.total.toFixed(2)}
                          </td>

                          {/* Master Matching Status */}
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {item.status.includes('✓ VERIFIED EXISTING') ? (
                              <div className="flex flex-col items-center">
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Existing ({item.old_stock} &rarr; {item.new_stock})
                                </span>
                              </div>
                            ) : item.status.includes('POSSIBLE MATCH') && !item.accepted_as_new ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="bg-amber-50 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                  ⚠ Possible Match ({item.possible_match?.similarity}%)
                                </span>
                                <span className="text-[10px] text-gray-500 truncate max-w-[130px]">
                                  {item.possible_match?.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const updated = [...lineItems];
                                      updated[actualIdx] = {
                                        ...updated[actualIdx],
                                        item_name: item.possible_match!.name,
                                        status: '✓ VERIFIED EXISTING',
                                        is_existing: true,
                                        is_new: false,
                                        possible_match: null
                                      };
                                      setLineItems(updated);
                                      setTimeout(handleVerify, 100);
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded shadow-2xs"
                                    title="Link to existing inventory catalog component"
                                  >
                                    Link Catalog
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updated = [...lineItems];
                                      updated[actualIdx] = {
                                        ...updated[actualIdx],
                                        accepted_as_new: true,
                                        status: '✓ VERIFIED NEW'
                                      };
                                      setLineItems(updated);
                                    }}
                                    className="px-2 py-0.5 bg-gray-500 hover:bg-gray-600 text-white text-[9px] font-bold rounded shadow-2xs"
                                    title="Keep verbatim invoice description as a new component"
                                  >
                                    Keep Description
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="bg-sky-50 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-sky-200">
                                + New Item
                              </span>
                            )}
                          </td>

                          {/* Delete Action */}
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => deleteRow(actualIdx)}
                              className="text-gray-400 hover:text-red-500 transition p-1"
                              title="Exclude item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredLineItems.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-xs text-gray-400">
                          {lineItems.length === 0 ? "No line items extracted. Click '+ Add Item' above." : "No matching items found for search query."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">
                  {lineItems.filter(r => r.selected).length} of {lineItems.length} items selected for inventory write
                </span>
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="px-3.5 py-1.5 border border-gray-300 hover:bg-white bg-white text-gray-700 font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin text-sky-600' : ''}`} />
                  Re-Verify Against Catalog
                </button>
              </div>
            </div>

            {/* Excluded Non-Component Lines (Delivery, Courier, Freight) */}
            {excludedItems.length > 0 && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-800 text-xs">Excluded Overhead &amp; Expense Lines</h4>
                  <span className="text-[11px] text-gray-500">{excludedItems.length} lines</span>
                </div>
                <div className="space-y-1.5">
                  {excludedItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 text-xs">
                      <div>
                        <span className="font-bold text-gray-800">{item.item_name}</span>
                        <span className="ml-2 font-mono text-gray-500">₹{item.total.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => restoreExcludedItem(idx)}
                        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold rounded-lg transition"
                      >
                        Restore as Line Item
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card 4: Tax Breakdown & Financial Totals Reconciliation */}
            <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-extrabold text-gray-900">
                    Tax Breakdown &amp; Grand Total Calculations
                  </h3>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  totalMismatch ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {totalMismatch ? '⚠ Total Mismatch' : '✓ Reconciled'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    Taxable Amount (₹)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={metadata.taxable_amount}
                    onChange={e => handleMetadataChange('taxable_amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    CGST (₹)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={metadata.cgst}
                    onChange={e => handleMetadataChange('cgst', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    SGST (₹)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={metadata.sgst}
                    onChange={e => handleMetadataChange('sgst', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    IGST (₹)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={metadata.igst}
                    onChange={e => handleMetadataChange('igst', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    Discount (₹)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={metadata.discount}
                    onChange={e => handleMetadataChange('discount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                    Round-off (₹)
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    value={metadata.round_off}
                    onChange={e => handleMetadataChange('round_off', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl font-mono"
                  />
                </div>

                <div className="col-span-2 bg-sky-50/60 p-3 rounded-2xl border border-sky-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-sky-900 uppercase tracking-wide">Invoice Grand Total</span>
                    <p className="text-base font-black text-sky-700 font-mono">₹{metadata.grand_total.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Calculated</span>
                    <p className="text-sm font-bold text-gray-800 font-mono">₹{calculatedGrandTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-gray-200">
              <button
                onClick={resetWizard}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-3 py-2"
              >
                Clear &amp; Start Over
              </button>

              <button
                onClick={() => setStep(4)}
                disabled={hasCriticalErrors || lineItems.filter(r => r.selected).length === 0 || (totalMismatch && !acknowledgeMismatch)}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                Proceed to Confirmation
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: Confirmation Checklist & Metrics Modal */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-md space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verification Checklist
              </div>
              <h3 className="text-xl font-extrabold text-gray-900">
                Final Review &amp; Inventory Write Confirmation
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Please verify each check below to commit this purchase bill atomically to the database register.
              </p>
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                <span className="text-xs text-gray-500 font-semibold">Invoice #</span>
                <p className="text-sm font-bold text-gray-900 font-mono mt-0.5 truncate">{metadata.invoice_number}</p>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                <span className="text-xs text-gray-500 font-semibold">Supplier</span>
                <p className="text-sm font-bold text-gray-900 truncate mt-0.5">{metadata.supplier_name}</p>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                <span className="text-xs text-gray-500 font-semibold">Total Stock Units</span>
                <p className="text-sm font-black text-emerald-600 mt-0.5">
                  +{lineItems.filter(r => r.selected).reduce((acc, r) => acc + r.quantity, 0)} units
                </p>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-center">
                <span className="text-xs text-gray-500 font-semibold">Grand Total</span>
                <p className="text-sm font-black text-sky-600 font-mono mt-0.5">₹{metadata.grand_total.toFixed(2)}</p>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={checklist.details}
                  onChange={() => setChecklist(prev => ({ ...prev, details: !prev.details }))}
                  className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900">1. Verified Supplier Details &amp; GSTIN</span>
                  <p className="text-[11px] text-gray-500">Supplier name, GSTIN code, invoice number, and dates accurately match the bill.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={checklist.components}
                  onChange={() => setChecklist(prev => ({ ...prev, components: !prev.components }))}
                  className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900">2. Verified Item Names &amp; HSN Codes</span>
                  <p className="text-[11px] text-gray-500">All line items, quantities, and units map to intended hardware components.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={checklist.stock}
                  onChange={() => setChecklist(prev => ({ ...prev, stock: !prev.stock }))}
                  className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900">3. Verified Stock Increments</span>
                  <p className="text-[11px] text-gray-500">New inventory stock math (Existing Stock + Purchased Quantity = New Stock) is correct.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={checklist.total}
                  onChange={() => setChecklist(prev => ({ ...prev, total: !prev.total }))}
                  className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-bold text-gray-900">4. Verified Financials &amp; GST Taxes</span>
                  <p className="text-[11px] text-gray-500">Tax amounts (CGST, SGST, IGST) and grand total correspond to the supplier's charge.</p>
                </div>
              </label>

              {totalMismatch && (
                <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-red-200 bg-red-50/50 hover:bg-red-50 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={acknowledgeMismatch}
                    onChange={() => setAcknowledgeMismatch(!acknowledgeMismatch)}
                    className="mt-0.5 rounded border-red-300 text-red-600 focus:ring-red-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-red-950">Acknowledge Total Difference</span>
                    <p className="text-[11px] text-red-700">
                      I acknowledge the difference of ₹{Math.abs(calculatedGrandTotal - metadata.grand_total).toFixed(2)} between the calculated line items and the invoice total.
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                &larr; Back to Side-by-Side Editor
              </button>

              <button
                onClick={handleConfirmPurchase}
                disabled={
                  isConfirming || 
                  !(checklist.details && checklist.components && checklist.stock && checklist.total) ||
                  (totalMismatch && !acknowledgeMismatch) ||
                  (metadata.is_duplicate && !allowDuplicateCommit)
                }
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm &amp; Update Inventory Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: Success Summary Screen */}
      {/* ========================================================================= */}
      {step === 5 && importSummary && (
        <div className="max-w-2xl mx-auto bg-white shadow-md border border-gray-200 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Purchase Bill Ingested Successfully
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Invoice #{metadata.invoice_number} saved. Components inventory updated atomically with transaction consistency.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-100">
              <span className="text-2xl font-black text-sky-600">{importSummary.imported || 0}</span>
              <p className="text-[10px] font-bold text-sky-900 uppercase tracking-wide mt-1">New Items Added</p>
            </div>
            <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100">
              <span className="text-2xl font-black text-purple-600">{importSummary.updated || 0}</span>
              <p className="text-[10px] font-bold text-purple-900 uppercase tracking-wide mt-1">Existing Updated</p>
            </div>
            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
              <span className="text-2xl font-black text-emerald-600">+{importSummary.stock_units_added || 0}</span>
              <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide mt-1">Units Added</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <span className="text-2xl font-black text-gray-600 font-mono">₹{metadata.grand_total.toFixed(0)}</span>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-1">Total Amount</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            <button 
              onClick={() => navigate(user?.role === 'admin' ? '/admin/inventory' : '/faculty/inventory')} 
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              View Inventory Catalog
            </button>
            <button 
              onClick={() => navigate(user?.role === 'admin' ? '/admin/purchases' : '/faculty/purchases')} 
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition"
            >
              View Purchase Orders
            </button>
            <button 
              onClick={resetWizard} 
              className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition"
            >
              Import Another Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
