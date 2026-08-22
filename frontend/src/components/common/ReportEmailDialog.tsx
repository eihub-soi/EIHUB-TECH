import React, { useState, useEffect } from "react";
import { X, Send, Eye, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { previewReport, sendReportEmail } from "../../services/reportService";
import { useEscapeKey } from "../../hooks/useEscapeKey";

interface ReportEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  filters?: any;
}

const EmailInput: React.FC<{
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  required?: boolean;
}> = ({ label, emails, onChange, required }) => {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    } else if (e.key === 'Backspace' && inputValue === '' && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  const addEmail = () => {
    const email = inputValue.trim().replace(',', '');
    if (!email) return;
    
    if (!validateEmail(email)) {
      setError(`Invalid email format: ${email}`);
      return;
    }
    
    if (!emails.includes(email)) {
      onChange([...emails, email]);
    }
    setInputValue("");
    setError("");
  };

  const removeEmail = (indexToRemove: number) => {
    onChange(emails.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={`p-2 rounded-xl bg-slate-50 border ${error ? 'border-red-300 focus-within:border-red-500' : 'border-[#E5E7EB] focus-within:border-blue-500'} transition-colors flex flex-wrap gap-2 items-center`}>
        {emails.map((email, index) => (
          <span key={index} className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-1 rounded-lg text-xs font-semibold">
            {email}
            <button type="button" onClick={() => removeEmail(index)} className="hover:text-red-600 transition-colors focus:outline-none">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          onBlur={addEmail}
          placeholder={emails.length === 0 ? "Enter email(s)..." : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-black placeholder:text-gray-400"
        />
      </div>
      {error && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</p>}
    </div>
  );
};

export const ReportEmailDialog: React.FC<ReportEmailDialogProps> = ({ isOpen, onClose, reportType, filters }) => {
  const { user } = useAuth();
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(`EI HUB INNOVENTRY - ${reportType}`);
  const [message, setMessage] = useState(`Dear Team,\n\nPlease find attached the ${reportType} generated from EI HUB Innoventry.\n\nThis report contains the latest inventory information, requests, returns, stock, and purchase order details.\n\nRegards,\nEI HUB Innoventry System`);
  
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      setSubject(`EI HUB INNOVENTRY - ${reportType}`);
      setMessage(`Dear Team,\n\nPlease find attached the ${reportType} generated from EI HUB Innoventry.\n\nThis report contains the latest inventory information, requests, returns, stock, and purchase order details.\n\nRegards,\nEI HUB Innoventry System`);
      setIsSuccess(false);
      setIsSending(false);
    }
  }, [isOpen, reportType]);

  const filename = `${reportType.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

  const handleSend = async () => {
    if (to.length === 0) {
      toast.error("Please add at least one recipient in the 'To' field.");
      return;
    }

    setIsSending(true);
    try {
      await sendReportEmail({
        report_type: reportType,
        to,
        cc,
        bcc,
        subject,
        message,
        from_date: filters?.from_date || null,
        to_date: filters?.to_date || null
      });
      
      setIsSuccess(true);
      toast.success("PDF report emailed successfully");
    } catch (err: any) {
      toast.error(err.message || "Error sending email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handlePreview = async () => {
    toast.info("Generating PDF preview...");
    try {
      const url = await previewReport(reportType, filters);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      toast.error(err.message || "Failed to load PDF preview.");
    }
  };

  if (!isOpen) return null;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-[32px] max-w-md w-full p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-black mb-2">Report Sent Successfully</h2>
          <p className="text-sm text-gray-600 mb-6">
            The {reportType} has been emailed to {to.length} recipient(s).
          </p>
          
          <div className="w-full bg-slate-50 rounded-2xl p-4 text-left space-y-3 mb-8">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">Time Sent</span>
              <span className="text-black font-semibold">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">Recipients</span>
              <span className="text-black font-semibold truncate max-w-[150px]">{to.join(', ')}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-bold">Report Name</span>
              <span className="text-black font-semibold truncate max-w-[150px]">{reportType}</span>
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <button 
              onClick={() => setIsSuccess(false)}
              className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-all"
            >
              Send Another
            </button>
            <button 
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl bg-[#60A5FA] hover:bg-blue-500 text-white font-bold text-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] max-w-5xl w-full h-[90vh] md:h-[80vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#E5E7EB] flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-xl font-black text-black">Send Report via Email</h2>
            <p className="text-xs text-gray-500 font-semibold mt-1">Email the selected report as a PDF attachment</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors focus:outline-none"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white">
          
          {/* Left Side: Form */}
          <div className="w-full md:w-3/5 p-8 overflow-y-auto space-y-6">
            
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">Report Type</label>
              <input 
                type="text" 
                value={reportType} 
                disabled
                className="w-full p-3 rounded-xl bg-slate-100 border border-transparent text-sm text-gray-700 font-semibold cursor-not-allowed"
              />
            </div>

            <EmailInput label="To" emails={to} onChange={setTo} required />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmailInput label="CC" emails={cc} onChange={setCc} />
              <EmailInput label="BCC" emails={bcc} onChange={setBcc} />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">Subject *</label>
              <input 
                type="text" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border border-[#E5E7EB] focus:border-blue-500 text-sm text-black focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-700">Message *</label>
              <textarea 
                rows={6}
                value={message} 
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border border-[#E5E7EB] focus:border-blue-500 text-sm text-black focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#F0F6FF] border border-blue-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm shrink-0">
                <FileText className="w-6 h-6 text-[#60A5FA]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-950">Attachment Ready</h4>
                <p className="text-xs text-blue-800 font-medium mt-1">{filename}</p>
                <p className="text-[10px] text-blue-600/70 font-semibold mt-1">File size: ~245 KB (Auto-generated)</p>
              </div>
            </div>

          </div>

          {/* Right Side: Preview */}
          <div className="w-full md:w-2/5 bg-slate-50 border-l border-[#E5E7EB] p-8 flex flex-col items-center justify-center relative">
            <div className="w-full max-w-[280px] bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col items-center text-center">
              
              {/* Dummy PDF Thumbnail */}
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
              
              <h3 className="font-black text-black text-lg mb-1 leading-tight">{reportType}</h3>
              <p className="text-[10px] uppercase font-bold text-blue-600 mb-6 tracking-widest">School of Innovation</p>
              
              <div className="w-full space-y-3 mb-8">
                <div className="flex justify-between items-center text-xs border-b border-dashed border-slate-200 pb-2">
                  <span className="text-gray-500 font-bold">Generated Date</span>
                  <span className="text-black font-semibold">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-dashed border-slate-200 pb-2">
                  <span className="text-gray-500 font-bold">Generated By</span>
                  <span className="text-black font-semibold">{user?.full_name || 'System Admin'}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-2">
                  <span className="text-gray-500 font-bold">Total Pages</span>
                  <span className="text-black font-semibold">Dynamic</span>
                </div>
              </div>

              <button 
                onClick={handlePreview}
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" /> Preview PDF Document
              </button>
            </div>
            
            {isSending && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-r-[32px]">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-[#60A5FA] rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-black animate-pulse">Generating PDF & Sending Email...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-[#E5E7EB] flex items-center justify-end gap-3 bg-white shrink-0">
          <button 
            onClick={onClose}
            disabled={isSending}
            className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={isSending || to.length === 0}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-[#60A5FA] hover:bg-blue-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {isSending ? "Sending..." : "Send Email"}
          </button>
        </div>

      </div>
    </div>
  );
};
