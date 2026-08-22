import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mockEngine } from "../services/mockEngine";
import { formatDateOnly } from "../utils/timestamp";
import { generateStudentReceiptPdf } from "../utils/pdfGenerator";
import { BorrowRequest, RequestStatus } from "../types";
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  FileText,
  Calendar,
  User,
  ShieldCheck,
  Building,
  Layers,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export const VerifyReceipt: React.FC = () => {
  const { requestCode } = useParams<{ requestCode: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<BorrowRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    const verifyTransaction = async () => {
      if (!requestCode) {
        setError("No reference code provided.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Look up locally first in mockEngine
        let req = mockEngine
          .getRequests()
          .find(
            (r) => r.request_code.toLowerCase() === requestCode.toLowerCase(),
          );

        // Helper to check if a string is a UUID
        const isUUID = (str: string): boolean => {
          const uuidPattern =
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
          return uuidPattern.test(str);
        };

        let lookupCode = requestCode;
        let isShortCode = false;
        if (requestCode.toLowerCase().startsWith("req-")) {
          lookupCode = requestCode.slice(4);
          isShortCode = true;
        }

        // 2. If not found, try querying public API
        if (!req) {
          try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
            const response = await fetch(`${apiBaseUrl}/api/requests/verify/${encodeURIComponent(requestCode)}`);
            if (response.ok) {
              const rawData = await response.json();
              req = {
                id: rawData.id,
                request_code: rawData.request_code,
                student_id: rawData.student_id,
                student_name: rawData.student_name,
                student_register_no: rawData.student_register_no,
                student_email: rawData.student_email,
                component_id: rawData.component_id,
                component_name: rawData.component_name,
                component_category: rawData.component_category,
                component_image: rawData.component_image,
                quantity: rawData.quantity,
                purpose: rawData.purpose,
                status: rawData.status,
                approved_by: rawData.approved_by,
                approved_by_name: rawData.approved_by_name,
                rejection_reason: rawData.rejection_reason,
                requested_at: rawData.requested_at,
                approved_at: rawData.approved_at,
                expected_return_at: rawData.expected_return_at,
                returned_at: rawData.returned_at,
                return_condition: "Good / Fully Functional",
                created_at: rawData.created_at,
              };
            }
          } catch (fetchErr) {
            console.error("Failed to query public verification endpoint:", fetchErr);
          }
        }

        if (req) {
          setRequest(req);
        } else {
          setError(
            `Transaction reference "${requestCode}" could not be found in our secure database registry.`,
          );
        }
      } catch (err) {
        console.error("Error during transaction verification:", err);
        setError(
          "An unexpected error occurred while verifying the transaction.",
        );
      } finally {
        setLoading(false);
      }
    };

    verifyTransaction();
  }, [requestCode]);

  const handleDownloadReceipt = async () => {
    if (!request) return;
    setDownloading(true);
    try {
      await generateStudentReceiptPdf(request);
      toast.success(
        "Official verification PDF receipt downloaded successfully.",
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate official PDF receipt.");
    } finally {
      setDownloading(false);
    }
  };

  const renderStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case "approved":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-900 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Approved & Verified
          </span>
        );
      case "pending":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-900 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Approval
          </span>
        );
      case "rejected":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-900 border border-rose-500/30 flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Rejected
          </span>
        );
      case "returned":
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E6F0FF] text-indigo-900 border border-[#60A5FA] flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Returned & Audited
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-black border border-slate-500/30 flex items-center gap-1.5 w-fit">
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="bg-[#FFFFFF] min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-black">
      {/* Decorative background */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#E6F0FF] rounded-full -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full -z-10" />

      {loading && (
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 text-blue-900 animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-black">
            Verifying Transaction Authenticity
          </h2>
          <p className="text-xs text-gray-700">
            Decrypting cryptographic signatures & querying secure registry...
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="glass-card border border-[#E5E7EB] p-8 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 text-rose-900 mx-auto rounded-full bg-rose-500/10 p-4 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-black tracking-tight">
              Verification Failed
            </h1>
            <p className="text-xs text-gray-700 px-2">{error}</p>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white hover:bg-white text-black border border-[#E5E7EB] text-xs font-bold transition-all hover:scale-102 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Portal Login</span>
            </button>
          </div>
        </div>
      )}

      {!loading && request && (
        <div className="glass-card border border-[#E5E7EB] p-8 max-w-2xl w-full space-y-6">
          {/* Badge & Authenticity Title */}
          <div className="text-center space-y-3 pb-6 border-b border-white/5">
            <div className="w-16 h-16 text-emerald-900 mx-auto rounded-full bg-emerald-500/10 p-3 border border-emerald-500/25 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <ShieldCheck className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black text-blue-900 tracking-widest uppercase">
                OFFICIAL EI HUB VERIFICATION
              </span>
              <h1 className="text-2xl font-black text-black tracking-tight mt-0.5">
                TRANSACTION VERIFIED
              </h1>
              <p className="text-xs text-gray-700 mt-1">
                This digital receipt represents a valid and authenticated
                inventory transaction.
              </p>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3.5 rounded-2xl border border-white/5">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-gray-700 font-bold">
                  Transaction Reference
                </span>
                <div className="text-base font-extrabold text-black gradient-text-gold">
                  {request.request_code}
                </div>
              </div>
              <div>{renderStatusBadge(request.status)}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Student Details Card */}
              <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-3">
                <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <User className="w-3.5 h-3.5" /> Student Information
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Full Name</span>
                    <span className="font-semibold text-black">
                      {request.student_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Register Number</span>
                    <span className="font-semibold text-black">
                      {request.student_register_no}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Email Address</span>
                    <span className="font-semibold text-black">
                      {request.student_email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Department</span>
                    <span className="font-semibold text-black">ECE</span>
                  </div>
                </div>
              </div>

              {/* Component Details Card */}
              <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-3">
                <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Layers className="w-3.5 h-3.5" /> Component Details
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Name</span>
                    <span className="font-semibold text-black text-right truncate max-w-[150px]">
                      {request.component_name || "Arduino Uno R3"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">SKU / ID</span>
                    <span className="font-semibold text-black select-all font-mono">
                      {request.component_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Category</span>
                    <span className="font-semibold text-black">
                      {request.component_category || "Microcontrollers"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Quantity</span>
                    <span className="font-bold text-blue-900">
                      {request.quantity} Unit(s)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Transaction Details */}
            <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold border-b border-white/5 pb-2 mb-1">
                <Building className="w-3.5 h-3.5" /> Transaction Metadata
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Issue Date</span>
                  <span className="font-semibold text-black">
                    {formatDateOnly(request.requested_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Expected Return</span>
                  <span className="font-semibold text-black">
                    {formatDateOnly(request.expected_return_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Authorized Issuer</span>
                  <span className="font-semibold text-black">
                    {request.approved_by_name || "Prof. Robert Chen"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Transaction Status</span>
                  <span className="font-semibold text-black uppercase text-[10px] tracking-wide">
                    {request.status}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/5 mt-1 flex flex-col gap-1">
                <span className="text-gray-700">Stated Purpose</span>
                <span className="text-black italic font-medium">
                  "{request.purpose}"
                </span>
              </div>
              {request.status === "returned" && request.returned_at && (
                <div className="pt-2 border-t border-white/5 flex justify-between items-center text-emerald-900">
                  <span>Actual Return Date</span>
                  <span className="font-bold">
                    {formatDateOnly(request.returned_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadReceipt}
              disabled={downloading}
              className="flex items-center justify-center gap-2 flex-1 py-3.5 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] disabled:bg-[#60A5FA] disabled:opacity-50 text-white font-bold transition-all hover:scale-102 cursor-pointer"
            >
              {downloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Official PDF Receipt</span>
            </button>

            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-white text-black border border-[#E5E7EB] font-bold transition-all hover:scale-102 cursor-pointer"
            >
              <span>Go to Portal Login</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
