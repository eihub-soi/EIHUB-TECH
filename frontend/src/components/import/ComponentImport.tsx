import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  Check, 
  AlertTriangle, 
  Download, 
  ArrowRight, 
  Info,
  Database,
  Trash2
} from 'lucide-react';
import { apiRequest, getAuthHeaders } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ComponentRow {
  __row_index: number;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  is_filtered_default?: boolean;
  selected?: boolean;
  
  // Verification details (returned from /verify)
  is_new?: boolean;
  is_existing?: boolean;
  existing_id?: string | null;
  action?: 'ADD' | 'UPDATE' | 'SKIP';
  old_stock?: number;
  old_available?: number;
  new_stock_add?: number;
  
  data: {
    sku: string;
    name: string;
    category: string;
    description: string;
    features: string;
    total_stock: number;
    unit_cost: number;
    location: string;
    image_url: string;
    unit?: string;
  };
}

interface ColumnMapping {
  systemField: string;
  excelColumn: string;
  isFound: boolean;
}

interface AnalysisResult {
  success: boolean;
  stats: {
    total_rows: number;
    valid_components: number;
    invalid_rows: number;
    duplicates_merged: number;
  };
  mapping: ColumnMapping[];
  missing_required: string[];
  rows: ComponentRow[];
}

export const ComponentImport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Steps: 1 = Upload, 2 = Analyze, 3 = Mapping & Filter, 4 = Preview & Edit, 5 = Verify, 6 = Success
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  
  // Loader states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Confirmation Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Analyze API result
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  // Cleaned and filtered rows currently shown in step 4
  const [rows, setRows] = useState<ComponentRow[]>([]);
  
  // User mapping and filtering config
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});
  const [onlyActiveStatus, setOnlyActiveStatus] = useState(true);
  
  // Verification API stats
  const [verifyStats, setVerifyStats] = useState<any>(null);
  

  
  // Final Import success metrics
  const [importSummary, setImportSummary] = useState<any>(null);
  
  // Pagination & Search in step 4
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const ROWS_PER_PAGE = 25;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Before unload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (step > 1 && step < 6) {
        e.preventDefault();
        const msg = "You have an import in progress. Leaving this page will discard the current import session.";
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

  // Validate a single row dynamically on editing
  const validateRow = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: 'valid' | 'warning' | 'error' = 'valid';

    if (!data.name || !data.name.trim()) {
      errors.push("Component name is required");
      status = 'error';
    }
    if (!data.category || !data.category.trim()) {
      errors.push("Category is required");
      status = 'error';
    }
    if (data.total_stock === undefined || data.total_stock === null || data.total_stock === "" || isNaN(parseInt(data.total_stock)) || parseInt(data.total_stock) < 0) {
      errors.push("Stock quantity cannot be negative or empty");
      status = 'error';
    }
    if (data.unit_cost !== undefined && data.unit_cost !== null && data.unit_cost !== "") {
      const parsedCost = parseFloat(data.unit_cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        errors.push("Unit Cost cannot be negative");
        status = 'error';
      }
    }
    if (data.image_url && data.image_url.trim() && !data.image_url.trim().startsWith('http://') && !data.image_url.trim().startsWith('https://')) {
      errors.push("Image URL format is invalid");
      status = 'error';
    }

    const compCats = ["sensor", "microcontroller", "resistor", "capacitor", "ic", "module", "display", "connector", "development board", "embedded component", "electronic component", "add-on", "component", "diode"];
    if (data.category) {
      const catLower = data.category.toLowerCase().trim();
      const matchesCompCat = compCats.some(c => catLower.includes(c));
      if (!matchesCompCat && catLower !== 'general' && catLower !== 'others') {
        warnings.push(`Category '${data.category}' is non-standard`);
        if (status === 'valid') status = 'warning';
      }
    }

    return { status, errors, warnings };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExt)) {
        toast.error("Invalid file format. Please upload a CSV or Excel file.");
        return;
      }
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast.error("File size exceeds 20MB limit.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const headers = await getAuthHeaders();
      delete headers['Content-Type'];
      
      const response = await fetch(`/api/imports/components/analyze`, {
        method: 'POST',
        headers,
        body: formData
      });
      
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Analysis failed');
      }
      
      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
      
      // Extract unique categories from uploaded rows to configure filtering
      const categories: Record<string, boolean> = {};
      const compCats = ["sensor", "microcontroller", "resistor", "capacitor", "ic", "module", "display", "connector", "development board", "embedded component", "electronic component", "add-on", "component", "diode"];
      
      result.rows.forEach(r => {
        const cat = r.data.category || 'General';
        if (categories[cat] === undefined) {
          const catLower = cat.toLowerCase();
          const matches = compCats.some(c => catLower.includes(c)) || catLower === 'general' || catLower === 'others';
          categories[cat] = matches;
        }
      });
      
      setSelectedCategories(categories);
      setStep(2); // Go to Analyze summary step
    } catch (error: any) {
      toast.error(`Error analyzing file: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyConfigAndProceed = () => {
    if (!analysisResult) return;
    
    // Apply categories and status filters to define default selected and filtered rows
    const configuredRows = analysisResult.rows.map(r => {
      const cat = r.data.category || 'General';
      const statusLower = 'active';
      
      const passCategory = selectedCategories[cat] !== false;
      const passStatus = !onlyActiveStatus || (statusLower === 'active' || statusLower === 'available');
      
      const isFiltered = !(passCategory && passStatus);
      const isError = r.status === 'error';
      
      return {
        ...r,
        selected: !isFiltered && !isError
      };
    });
    
    setRows(configuredRows);
    setStep(4); // Preview & Edit step
  };

  const toggleRowSelection = (index: number) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      selected: !updated[index].selected
    };
    setRows(updated);
  };

  const handleCellEdit = (index: number, field: keyof ComponentRow['data'], value: any) => {
    const updated = [...rows];
    const row = { ...updated[index] };
    const data = { ...row.data };
    
    if (field === 'unit_cost') {
      data.unit_cost = parseFloat(value) || 0.0;
    } else if (field === 'total_stock') {
      data.total_stock = parseInt(value) || 0;
    } else {
      (data as any)[field] = value;
    }
    
    row.data = data;
    
    // Immediately revalidate row
    const valResult = validateRow(data);
    row.status = valResult.status;
    row.errors = valResult.errors;
    row.warnings = valResult.warnings;
    
    if (valResult.status === 'error') {
      row.selected = false;
    }
    
    updated[index] = row;
    setRows(updated);
  };

  const selectQuickFilter = (type: 'all' | 'new' | 'existing' | 'valid' | 'none') => {
    const updated = rows.map(r => {
      if (r.status === 'error') return { ...r, selected: false };
      
      if (type === 'all') return { ...r, selected: true };
      if (type === 'none') return { ...r, selected: false };
      if (type === 'new') return { ...r, selected: !!r.is_new };
      if (type === 'existing') return { ...r, selected: !!r.is_existing };
      if (type === 'valid') return { ...r, selected: r.status === 'valid' || r.status === 'warning' };
      return r;
    });
    setRows(updated);
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const response = await apiRequest(`/api/imports/components/verify`, {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      setRows(response.rows);
      setVerifyStats(response.stats);
      setStep(5); // Go to Verify step
    } catch (error: any) {
      toast.error(`Verification failed: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCommit = async () => {
    setShowConfirmModal(false);
    setIsCommitting(true);
    try {
      const response = await apiRequest(`/api/imports/components/commit`, {
        method: 'POST',
        body: JSON.stringify({ 
          rows: rows,
          options: { mode: 'add' }
        })
      });
      setImportSummary(response.metrics);
      setStep(6); // Success step
      toast.success("Bulk import committed successfully!");
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setAnalysisResult(null);
    setRows([]);
    setVerifyStats(null);
    setImportSummary(null);
    setSearchTerm('');
    setPage(0);
    setShowCancelModal(false);
  };

  const handleStepClick = (targetStep: number) => {
    if (step === 6) return; // Disallow step jump on success screen
    
    if (targetStep === 1) {
      setStep(1);
    } else if (targetStep === 2 && analysisResult) {
      setStep(2);
    } else if (targetStep === 3 && analysisResult) {
      setStep(3);
    } else if (targetStep === 4 && rows.length > 0) {
      setStep(4);
    } else if (targetStep === 5 && verifyStats) {
      setStep(5);
    }
  };

  const downloadErrorReport = () => {
    const errorRows = rows.filter(r => r.status === 'error');
    if (errorRows.length === 0) return;
    
    const csvContent = [
      ["Row Number", "SKU Code", "Component Name", "Category", "Quantity", "Unit Cost", "Cabinet Rack", "Image URL", "Errors"].join(","),
      ...errorRows.map((r) => [
        r.__row_index + 1,
        `"${(r.data.sku || '').replace(/"/g, '""')}"`,
        `"${(r.data.name || '').replace(/"/g, '""')}"`,
        `"${(r.data.category || '').replace(/"/g, '""')}"`,
        r.data.total_stock,
        r.data.unit_cost,
        `"${(r.data.location || '').replace(/"/g, '""')}"`,
        `"${(r.data.image_url || '').replace(/"/g, '""')}"`,
        `"${r.errors.join('; ').replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "import_error_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStepper = () => {
    const steps = [
      { name: "Upload", num: 1 },
      { name: "Analyze", num: 2 },
      { name: "Mapping & Filter", num: 3 },
      { name: "Preview & Edit", num: 4 },
      { name: "Verify", num: 5 },
      { name: "Success", num: 6 }
    ];

    const isAvailable = (num: number) => {
      if (num === 1) return true;
      if (num === 2 || num === 3) return !!analysisResult;
      if (num === 4) return rows.length > 0;
      if (num === 5) return !!verifyStats;
      return false;
    };

    return (
      <div className="flex items-center justify-between mb-8 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm overflow-x-auto">
        {steps.map((s, i) => {
          const avail = isAvailable(s.num) && step !== 6;
          return (
            <div key={s.name} className="flex items-center flex-shrink-0">
              <button 
                disabled={!avail}
                onClick={() => handleStepClick(s.num)}
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-bold text-sm transition-all duration-300 ${
                  step > s.num ? 'bg-green-500 border-green-500 text-white cursor-pointer' : 
                  step === s.num ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-105' : 
                  avail ? 'border-blue-300 text-blue-600 bg-blue-50 cursor-pointer hover:bg-blue-100' : 'border-gray-200 text-gray-400 bg-white cursor-not-allowed'
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : i + 1}
              </button>
              <span className={`ml-2 text-xs sm:text-sm font-semibold transition-all duration-300 ${
                step >= s.num ? 'text-gray-900' : 'text-gray-400'
              }`}>{s.name}</span>
              {i < steps.length - 1 && <ChevronRight className="w-4 h-4 mx-3 sm:mx-4 text-gray-300" />}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Database className="w-7 h-7 text-blue-600" />
            Smart CSV / Excel Component Import
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Intelligent column matching, auto-filtering of component-like records, inline validation, and transaction-safe ingestion.
          </p>
        </div>
      </div>

      {renderStepper()}

      {/* STEP 1: Upload File */}
      {step === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 flex items-start gap-4">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-blue-900 text-sm sm:text-base">CSV & Excel Ingestion Pipeline</h4>
              <p className="text-xs sm:text-sm text-blue-700 mt-1">
                Upload `.csv`, `.xlsx`, or `.xls` inventory lists. Columns are automatically recognized, spaces trimmed, and duplicate component entries combined before database commits.
              </p>
            </div>
          </div>

          <div 
            className="border-2 border-dashed border-gray-300 rounded-3xl p-16 text-center hover:bg-blue-50/30 hover:border-blue-500 transition-all duration-300 cursor-pointer bg-white shadow-sm flex flex-col items-center justify-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const selectedFile = e.dataTransfer.files[0];
                const validExtensions = ['.csv', '.xlsx', '.xls'];
                const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
                if (validExtensions.includes(fileExt)) {
                  setFile(selectedFile);
                } else {
                  toast.error("Invalid file format.");
                }
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".csv, .xlsx, .xls" 
              className="hidden" 
            />
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5 hover:scale-105 transition-all">
              <Upload className="w-10 h-10" />
            </div>
            {file ? (
              <>
                <h3 className="text-lg sm:text-xl font-extrabold text-green-700 mb-2">File Selected</h3>
                <p className="text-sm text-gray-800 font-semibold mb-6">{file.name}</p>
              </>
            ) : (
              <>
                <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 mb-2">Drag and drop your file here</h3>
                <p className="text-xs sm:text-sm text-gray-500 mb-6">Supports .csv, .xlsx, .xls formats (Max 20MB)</p>
              </>
            )}
            <span className="px-6 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-md text-white bg-blue-600 hover:bg-blue-700 hover:shadow-lg transition-all scale-100 hover:scale-105 active:scale-95">
              {file ? 'Change File' : 'Browse Files'}
            </span>
          </div>

          {/* Footer controls */}
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-200">
            <button 
              onClick={() => { if (file) { setFile(null); } }} 
              disabled={!file}
              className="px-5 py-2.5 text-gray-500 hover:text-black font-semibold text-sm disabled:opacity-30"
            >
              Cancel
            </button>
            <button 
              onClick={startAnalysis} 
              disabled={!file || isAnalyzing}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {isAnalyzing && <Loader2 className="w-4 h-4 animate-spin" />}
              Analyze & Continue &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Analyze summary */}
      {step === 2 && analysisResult && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">File Ingest Summary</h3>
              <p className="text-xs text-gray-500 mt-1">Review the overall analysis parsed by the backend engine.</p>
            </div>
            
            <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                <span className="text-xs text-gray-500 font-bold uppercase block">Total Rows</span>
                <p className="text-2xl font-black text-gray-900 mt-1">{analysisResult.stats.total_rows}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                <span className="text-xs text-green-700 font-bold uppercase block">Valid Rows</span>
                <p className="text-2xl font-black text-green-700 mt-1">{analysisResult.stats.valid_components}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                <span className="text-xs text-amber-700 font-bold uppercase block">Warnings</span>
                <p className="text-2xl font-black text-amber-700 mt-1">{analysisResult.stats.invalid_rows}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                <span className="text-xs text-red-700 font-bold uppercase block">Invalid Rows</span>
                <p className="text-2xl font-black text-red-700 mt-1">{analysisResult.stats.invalid_rows}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 text-center">
                <span className="text-xs text-purple-700 font-bold uppercase block">Duplicates</span>
                <p className="text-2xl font-black text-purple-700 mt-1">{analysisResult.stats.duplicates_merged}</p>
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-200">
            <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50">
              &larr; Back
            </button>
            <button onClick={() => setShowCancelModal(true)} className="text-red-600 hover:text-red-700 font-bold text-sm">
              Cancel Import
            </button>
            <button onClick={() => setStep(3)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow transition">
              Continue to Mapping &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Column Mapping & Filters */}
      {step === 3 && analysisResult && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Detected Column Mapping
              </h3>
              <p className="text-xs text-gray-500 mt-1">Review how your spreadsheet columns map to EI HUB components fields.</p>
            </div>
            
            <div className="p-6 space-y-4">
              {analysisResult.missing_required.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="font-bold text-red-950 text-sm">Required Fields Missing!</h5>
                    <p className="text-xs text-red-700 mt-1">
                      The file does not contain a mapping for: <span className="font-extrabold">{analysisResult.missing_required.join(', ')}</span>. Please upload a file with these column names or maps.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analysisResult.mapping.map((map) => {
                  const isRequired = ['Category', 'Component Name', 'Total Stock'].includes(map.systemField);
                  return (
                    <div key={map.systemField} className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all duration-300 ${
                      map.isFound ? 'border-green-200 bg-green-50/30' : isRequired ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'
                    }`}>
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{map.systemField}</span>
                        <p className={`font-semibold mt-0.5 text-sm sm:text-base ${map.isFound ? 'text-green-800' : isRequired ? 'text-red-800' : 'text-gray-400 italic'}`}>
                          {map.isFound ? map.excelColumn : isRequired ? 'Not Found in Spreadsheet' : 'Default Value / Empty'}
                        </p>
                      </div>
                      {map.isFound ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold">Mapped</span>
                      ) : isRequired ? (
                        <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-bold">Required — Not Mapped</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full font-bold">Optional</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Auto-Filtering Configuration Panel */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Intelligent Auto-Filtering Review
              </h3>
              <p className="text-xs text-gray-500 mt-1">Configure which component categories and statuses to isolate from this spreadsheet file.</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-bold text-gray-800 text-sm mb-3">Include Categories:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Object.keys(selectedCategories).map((cat) => (
                    <label key={cat} className="flex items-center gap-2.5 p-3 rounded-2xl border border-gray-100 hover:bg-gray-50 transition cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={selectedCategories[cat]}
                        onChange={() => setSelectedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-gray-700 max-w-[120px] truncate" title={cat}>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">Status Filtration Option</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Only automatically isolate active/available components for import (recommended).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={onlyActiveStatus} 
                    onChange={() => setOnlyActiveStatus(!onlyActiveStatus)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-5 h-5"
                  />
                  <span className="ml-3 font-semibold text-sm text-gray-700">Active Only</span>
                </label>
              </div>
            </div>

            {/* Footer controls */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50">
                &larr; Back
              </button>
              <button onClick={() => setShowCancelModal(true)} className="text-red-600 hover:text-red-700 font-bold text-sm">
                Cancel Import
              </button>
              <button 
                onClick={applyConfigAndProceed} 
                disabled={analysisResult.missing_required.length > 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow transition flex items-center gap-2"
              >
                Continue to Preview &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Preview, Edit & Selection */}
      {step === 4 && rows.length > 0 && (
        <div className="space-y-6">
          {/* Stats Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Rows</span>
              <p className="text-2xl font-black text-gray-900 mt-1">{rows.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 shadow-sm">
              <span className="text-xs text-green-700 font-bold uppercase tracking-wider">Valid Rows</span>
              <p className="text-2xl font-black text-green-700 mt-1">{rows.filter(r => r.status === 'valid').length}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
              <span className="text-xs text-amber-700 font-bold uppercase tracking-wider">Warnings</span>
              <p className="text-2xl font-black text-amber-700 mt-1">{rows.filter(r => r.status === 'warning').length}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
              <span className="text-xs text-red-700 font-bold uppercase tracking-wider">Invalid (Errors)</span>
              <p className="text-2xl font-black text-red-700 mt-1">{rows.filter(r => r.status === 'error').length}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 shadow-sm">
              <span className="text-xs text-purple-700 font-bold uppercase tracking-wider">Duplicates Combined</span>
              <p className="text-2xl font-black text-purple-700 mt-1">{analysisResult?.stats.duplicates_merged || 0}</p>
            </div>
          </div>

          {/* Quick Selection Toolbar */}
          <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 font-bold uppercase mr-2">Selection filters:</span>
              <button onClick={() => selectQuickFilter('all')} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-50">Select All</button>
              <button onClick={() => selectQuickFilter('valid')} className="px-3 py-1.5 border border-green-200 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-50">Valid Only</button>
              <button onClick={() => selectQuickFilter('none')} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-50">Deselect All</button>
              {rows.some(r => r.status === 'error') && (
                <button onClick={downloadErrorReport} className="px-3 py-1.5 border border-red-200 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-50 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download Errors csv
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search components name..." 
                className="px-4 py-2 border border-gray-300 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-60"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
              />
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">Select</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase">Row</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-36">SKU Code</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-64">Component Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-48">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-60">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-48">Features</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-28">Total Stock</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase w-32">Unit Cost (₹ INR)</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-44">Cabinet Rack</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-60">Image URL</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Validation</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows
                    .filter(r => {
                      if (!searchTerm) return true;
                      return r.data.name.toLowerCase().includes(searchTerm.toLowerCase());
                    })
                    .slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)
                    .map((row, relativeIdx) => {
                      const idx = page * ROWS_PER_PAGE + relativeIdx;
                      const isError = row.status === 'error';
                      return (
                        <tr key={row.__row_index} className={`hover:bg-gray-50/70 transition-all ${
                          isError ? 'bg-red-50/30' : row.status === 'warning' ? 'bg-amber-50/20' : ''
                        }`}>
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            <input 
                              type="checkbox" 
                              checked={!!row.selected} 
                              disabled={isError}
                              onChange={() => toggleRowSelection(idx)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5 disabled:opacity-30"
                            />
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs font-bold text-gray-500">
                            {row.__row_index + 1}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.sku} 
                              onChange={(e) => handleCellEdit(idx, 'sku', e.target.value)}
                              className={`w-full px-2.5 py-1 rounded-xl text-sm border font-mono ${
                                isError && !row.data.sku ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.name} 
                              onChange={(e) => handleCellEdit(idx, 'name', e.target.value)}
                              className={`w-full px-2.5 py-1 rounded-xl text-sm border font-semibold ${
                                isError && !row.data.name ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.category} 
                              onChange={(e) => handleCellEdit(idx, 'category', e.target.value)}
                              className={`w-full px-2.5 py-1 rounded-xl text-sm border ${
                                isError && !row.data.category ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.description} 
                              onChange={(e) => handleCellEdit(idx, 'description', e.target.value)}
                              className="w-full px-2.5 py-1 rounded-xl text-sm border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white"
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.features} 
                              onChange={(e) => handleCellEdit(idx, 'features', e.target.value)}
                              className="w-full px-2.5 py-1 rounded-xl text-sm border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white"
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="number" 
                              value={row.data.total_stock} 
                              onChange={(e) => handleCellEdit(idx, 'total_stock', e.target.value)}
                              className={`w-full px-2.5 py-1 rounded-xl text-sm border font-bold text-center ${
                                isError && (row.data.total_stock === undefined || row.data.total_stock < 0) ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="number" 
                              step="0.01"
                              value={row.data.unit_cost} 
                              onChange={(e) => handleCellEdit(idx, 'unit_cost', e.target.value)}
                              className={`w-full px-2.5 py-1 rounded-xl text-sm border font-mono text-right ${
                                isError && (row.data.unit_cost === undefined || row.data.unit_cost < 0) ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.location} 
                              onChange={(e) => handleCellEdit(idx, 'location', e.target.value)}
                              className="w-full px-2.5 py-1 rounded-xl text-sm border border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white"
                            />
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <input 
                              type="text" 
                              value={row.data.image_url} 
                              onChange={(e) => handleCellEdit(idx, 'image_url', e.target.value)}
                              className={`w-full px-2.5 py-1 rounded-xl text-sm border ${
                                isError && row.data.image_url && !row.data.image_url.trim().startsWith('http') ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-transparent focus:border-blue-500 bg-transparent hover:bg-gray-100/50 focus:bg-white'
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.status === 'error' ? (
                              <div className="flex items-center gap-1 text-red-600 text-xs font-bold" title={row.errors.join('; ')}>
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>Error</span>
                              </div>
                            ) : row.status === 'warning' ? (
                              <div className="flex items-center gap-1 text-amber-600 text-xs font-bold" title={row.warnings.join('; ')}>
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>Warning</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                <span>Valid</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {rows.filter(r => !searchTerm || r.data.name.toLowerCase().includes(searchTerm.toLowerCase())).length > ROWS_PER_PAGE && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <button 
                  onClick={() => setPage(p => Math.max(0, p - 1))} 
                  disabled={page === 0} 
                  className="px-4 py-1.5 border border-gray-200 rounded-xl bg-white text-sm font-semibold disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500 font-semibold">
                  Page {page + 1} of {Math.ceil(rows.filter(r => !searchTerm || r.data.name.toLowerCase().includes(searchTerm.toLowerCase())).length / ROWS_PER_PAGE)}
                </span>
                <button 
                  onClick={() => setPage(p => Math.min(Math.ceil(rows.filter(r => !searchTerm || r.data.name.toLowerCase().includes(searchTerm.toLowerCase())).length / ROWS_PER_PAGE) - 1, p + 1))} 
                  disabled={page >= Math.ceil(rows.filter(r => !searchTerm || r.data.name.toLowerCase().includes(searchTerm.toLowerCase())).length / ROWS_PER_PAGE) - 1} 
                  className="px-4 py-1.5 border border-gray-200 rounded-xl bg-white text-sm font-semibold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-200">
            <button onClick={() => setStep(3)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50">
              &larr; Back
            </button>
            <button onClick={() => setShowCancelModal(true)} className="text-red-600 hover:text-red-700 font-bold text-sm">
              Cancel Import
            </button>
            <button 
              onClick={handleVerify} 
              disabled={rows.filter(r => r.selected).length === 0 || isVerifying}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow disabled:opacity-50 transition flex items-center gap-1.5 font-semibold"
            >
              {isVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue to Verify &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Verification Load Overlays */}
      {isVerifying && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
          <h3 className="text-lg font-bold">Verifying catalog records against Cloudflare D1...</h3>
        </div>
      )}

      {/* STEP 5: Verify (Summary & Mode Selector) */}
      {step === 5 && verifyStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Mode Selection & Preview Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stock Selector Panel */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Stock Handling Selection
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Determine how the database stock will update for matched existing components.</p>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1 flex items-center gap-3 p-4 rounded-2xl border border-blue-100 bg-blue-50/20 select-none">
                  <input 
                    type="radio" 
                    name="stockMode" 
                    value="add" 
                    checked={true} 
                    readOnly
                    className="text-blue-600 focus:ring-blue-500 w-4.5 h-4.5 cursor-default"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-900">Add stock (Incremental)</span>
                    <p className="text-xs text-gray-500 mt-0.5">New Stock = Existing Stock + Uploaded Stock</p>
                  </div>
                </div>
              </div>
            </div>

            {/* In-Memory comparison preview */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">Verification Table Preview</h3>
                <span className="text-xs text-gray-500 font-bold">{rows.filter(r => r.selected).length} Items Selected</span>
              </div>
              
              <div className="overflow-x-auto max-h-[300px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Match Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Component Name</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Old Stock</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">Uploaded</th>
                      <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase">New Stock</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.filter(r => r.selected).map((row) => (
                      <tr key={row.__row_index} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.is_new ? (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-bold">NEW</span>
                          ) : (
                            <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-bold">EXISTING</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {row.data.name}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap text-sm font-mono text-gray-500">
                          {row.is_new ? '-' : row.old_stock}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap text-sm font-bold text-gray-900">
                          +{row.data.total_stock}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap text-sm font-bold text-blue-600 font-mono">
                           {row.is_new ? row.data.total_stock : row.new_stock_add}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right summary panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Verification Summary</h3>
                <p className="text-xs text-gray-500 mt-0.5">Please review these details before updating database records.</p>
              </div>

              <div className="p-6 space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Total uploaded rows:</span>
                  <span className="font-bold text-gray-900">{analysisResult?.stats.total_rows}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Valid records selected:</span>
                  <span className="font-bold text-green-600">{rows.filter(r => r.selected).length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 bg-blue-50/20 px-3 -mx-3 rounded-xl">
                  <span className="text-blue-900 font-bold">New components:</span>
                  <span className="font-bold text-blue-600">+{rows.filter(r => r.selected && r.is_new).length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 bg-purple-50/20 px-3 -mx-3 rounded-xl">
                  <span className="text-purple-900 font-bold">Existing components:</span>
                  <span className="font-bold text-purple-600">{rows.filter(r => r.selected && r.is_existing).length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 bg-green-50/20 px-3 -mx-3 rounded-xl">
                  <span className="text-green-950 font-bold">Stock units addition:</span>
                  <span className="font-black text-green-600">
                    +{rows.filter(r => r.selected).reduce((acc, row) => acc + row.data.total_stock, 0)} units
                  </span>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
                <button 
                  onClick={() => setShowConfirmModal(true)} 
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm Import
                </button>
              </div>
            </div>
          </div>

          {/* Stepper controls */}
          <div className="lg:col-span-3 flex justify-between items-center bg-white p-4 rounded-3xl border border-gray-200 mt-4">
            <button onClick={() => setStep(4)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-50">
              &larr; Back
            </button>
            <button onClick={() => setShowCancelModal(true)} className="text-red-600 hover:text-red-700 font-bold text-sm">
              Cancel Import
            </button>
            <div className="w-20" /> {/* spacing */}
          </div>
        </div>
      )}

      {/* Committing Loader Overlay */}
      {isCommitting && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-green-500" />
          <h3 className="text-lg font-bold">Writing records to database...</h3>
        </div>
      )}

      {/* STEP 6: Success Result Summary */}
      {step === 6 && importSummary && (
        <div className="max-w-3xl mx-auto bg-white shadow-lg border border-gray-100 rounded-3xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Import Completed Successfully</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Cloudflare D1 tables have been updated safely.</p>
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
                {rows.filter(r => !r.selected || r.status === 'error').length}
              </span>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Skipped</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <button 
              onClick={() => navigate(user?.role === 'admin' ? '/admin/inventory' : '/faculty/inventory')} 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all scale-100 hover:scale-105 active:scale-95"
            >
              View Components
            </button>
            <button 
              onClick={resetWizard} 
              className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-sm rounded-2xl transition-all scale-100 hover:scale-105 active:scale-95"
            >
              Start New Import
            </button>
          </div>
        </div>
      )}

      {/* CANCEL IMPORT CONFIRMATION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-8 h-8 flex-shrink-0" />
              <h3 className="text-lg font-extrabold text-gray-900">Cancel Import?</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              All uploaded file data, analysis results, mapping changes, preview edits, and verification progress will be discarded.
              <br /><br />
              <strong>No database changes have been made yet.</strong>
              <br /><br />
              Are you sure you want to cancel?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 transition"
              >
                Keep Editing
              </button>
              <button 
                onClick={resetWizard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM COMMIT MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-blue-600">
              <Database className="w-8 h-8 flex-shrink-0" />
              <h3 className="text-lg font-extrabold text-gray-900">Confirm Import?</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed space-y-2">
              <span>This will permanently update the Components inventory database.</span>
              <ul className="list-disc list-inside mt-2 text-xs font-bold text-gray-800">
                <li>{rows.filter(r => r.selected && r.is_new).length} new components will be created.</li>
                <li>{rows.filter(r => r.selected && r.is_existing).length} existing components will be updated.</li>
                <li>
                  {rows.filter(r => r.selected).reduce((acc, row) => acc + row.data.total_stock, 0)} stock units will be added.
                </li>
              </ul>
              <span className="block mt-4 text-xs font-bold text-red-600">This action cannot be cancelled after confirmation.</span>
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 transition"
              >
                Go Back
              </button>
              <button 
                onClick={handleCommit}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Confirm & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
