import React, { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, Download, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getAuthHeaders } from "../../utils/api";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface CSVImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = "upload" | "validating" | "preview" | "importing" | "completed";

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ onClose, onSuccess }) => {
  useEscapeKey(onClose, true);
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [importMode, setImportMode] = useState("skip");
  const [importSummary, setImportSummary] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const headers = await getAuthHeaders();
    fetch("/api/admin/components/import/template", {
      headers
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "components_import_template.csv";
      a.click();
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error("Please upload a valid CSV file");
        return;
      }
      setFile(selectedFile);
      await processCSV(selectedFile);
    }
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error("Please upload a valid CSV file");
        return;
      }
      setFile(selectedFile);
      await processCSV(selectedFile);
    }
  };

  const processCSV = async (csvFile: File) => {
    setStep("validating");
    
    const formData = new FormData();
    formData.append("file", csvFile);
    
    try {
      const headers = await getAuthHeaders();
      delete headers["Content-Type"]; // Let browser set multipart/form-data with boundary
      const response = await fetch("/api/admin/components/import/preview", {
        method: "POST",
        headers,
        body: formData
      });
      
      if (!response.ok) throw new Error(await response.text());
      
      const data = await response.json();
      setStats(data.stats);
      setRows(data.rows);
      setStep("preview");
    } catch (err: any) {
      toast.error(err.message || "Failed to process CSV");
      setStep("upload");
      setFile(null);
    }
  };

  const handleConfirmImport = async () => {
    setStep("importing");
    
    const startTime = performance.now();
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/admin/components/import/confirm", {
        method: "POST",
        headers,
        body: JSON.stringify({ rows, mode: importMode })
      });
      
      if (!response.ok) throw new Error(await response.text());
      
      const result = await response.json();
      const endTime = performance.now();
      
      setImportSummary({
        ...result,
        time: ((endTime - startTime) / 1000).toFixed(2)
      });
      
      setStep("completed");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
      setStep("preview");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-black flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Import Components from CSV
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {step === "upload" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <div>
                  <h4 className="font-bold text-blue-900">Need a template?</h4>
                  <p className="text-xs text-blue-700 mt-1">Download the standard CSV format with headers.</p>
                </div>
                <button onClick={downloadTemplate} className="px-4 py-2 bg-white text-blue-700 text-sm font-bold rounded-xl shadow-sm border border-blue-200 hover:bg-blue-50 transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" /> Template
                </button>
              </div>
              
              <div 
                className="border-2 border-dashed border-gray-300 rounded-3xl p-12 text-center hover:bg-gray-50 hover:border-blue-400 transition-colors cursor-pointer bg-white"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
                <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UploadCloud className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Click to upload or drag and drop</h3>
                <p className="text-sm text-gray-500">CSV files only. Max size 10MB.</p>
              </div>
            </div>
          )}

          {(step === "validating" || step === "importing") && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <h3 className="text-xl font-bold text-gray-900">
                {step === "validating" ? "Validating rows..." : "Importing to Cloudflare D1..."}
              </h3>
              <p className="text-gray-500 mt-2">Please don't close this window.</p>
            </div>
          )}

          {step === "preview" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Total Rows</p>
                  <p className="text-2xl font-black text-gray-900">{stats.total_rows}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">Valid (New)</p>
                  <p className="text-2xl font-black text-green-700">{stats.valid_rows}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm">
                  <p className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">Duplicates</p>
                  <p className="text-2xl font-black text-amber-700">{stats.duplicate_rows}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm">
                  <p className="text-xs text-red-700 uppercase font-bold tracking-wider mb-1">Invalid</p>
                  <p className="text-2xl font-black text-red-700">{stats.invalid_rows}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-bold text-gray-700">Row</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Status</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Comp ID</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Name</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Category</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Qty</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Available</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Unit</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Location</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Manufacturer</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Supplier</th>
                        <th className="px-4 py-3 font-bold text-gray-700">Price</th>
                        <th className="px-4 py-3 font-bold text-gray-700 w-full">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => (
                        <tr key={i} className={r.status === 'invalid' ? 'bg-red-50/50' : r.status === 'duplicate' ? 'bg-amber-50/50' : ''}>
                          <td className="px-4 py-2 text-gray-500">{r.original_index}</td>
                          <td className="px-4 py-2">
                            {r.status === 'valid' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold"><CheckCircle2 className="w-3 h-3"/> Valid</span>}
                            {r.status === 'invalid' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold"><AlertCircle className="w-3 h-3"/> Invalid</span>}
                            {r.status === 'duplicate' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold"><AlertCircle className="w-3 h-3"/> Duplicate</span>}
                          </td>
                          <td className="px-4 py-2 font-medium">{r.data.component_id || '-'}</td>
                          <td className="px-4 py-2 font-medium">{r.data.name}</td>
                          <td className="px-4 py-2">{r.data.category}</td>
                          <td className="px-4 py-2">{r.data.total_stock}</td>
                          <td className="px-4 py-2">{r.data.available_stock}</td>
                          <td className="px-4 py-2">{r.data.unit}</td>
                          <td className="px-4 py-2">{r.data.location}</td>
                          <td className="px-4 py-2">{r.data.manufacturer || '-'}</td>
                          <td className="px-4 py-2">{r.data.supplier || '-'}</td>
                          <td className="px-4 py-2">₹{r.data.unit_cost}</td>
                          <td className="px-4 py-2 text-red-600 text-xs">
                            {r.errors.join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-2xl flex items-center justify-between border border-blue-100">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-blue-900">How to handle duplicates?</label>
                  <select 
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="skip">Skip Duplicates</option>
                    <option value="update">Update Existing Components</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === "completed" && importSummary && (
            <div className="text-center py-12 max-w-lg mx-auto">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Import Successful!</h2>
              <p className="text-gray-500 mb-8">Completed in {importSummary.time} seconds</p>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-3xl font-black text-green-600">{importSummary.imported}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Imported</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-3xl font-black text-blue-600">{importSummary.updated}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Updated</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-3xl font-black text-amber-500">{importSummary.skipped}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Skipped</p>
                </div>
              </div>
            </div>
          )}
          
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-3xl">
          {step !== "completed" && (
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          
          {step === "preview" && (
            <button 
              onClick={handleConfirmImport}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
            >
              Confirm Import <ArrowRight className="w-4 h-4" />
            </button>
          )}
          
          {step === "completed" && (
            <button 
              onClick={() => { onSuccess(); onClose(); }}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              Done
            </button>
          )}
        </div>
        
      </div>
    </div>
  );
};
