import React, { useState } from "react";
import { mockEngine } from "../../services/mockEngine";
import { useAuth } from "../../contexts/AuthContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  formatTimestamp,
  formatDateOnly,
  parseUTCDate,
} from "../../utils/timestamp";
import { BorrowRequest } from "../../types";
import { toast } from "sonner";
import { Search, Check, X, Clock, CheckCircle2 } from "lucide-react";

const parsePurpose = (purposeStr: string) => {
  if (!purposeStr)
    return {
      purpose: "",
      fromDate: "",
      toDate: "",
      projectGuide: "",
      description: "",
    };

  if (
    purposeStr.includes("Project Purpose:") ||
    purposeStr.includes("From Date:")
  ) {
    const lines = purposeStr.split("\n");
    const result = {
      purpose: "",
      fromDate: "",
      toDate: "",
      projectGuide: "",
      description: "",
    };
    lines.forEach((line) => {
      if (line.startsWith("Project Purpose:"))
        result.purpose = line.replace("Project Purpose:", "").trim();
      else if (line.startsWith("From Date:"))
        result.fromDate = line.replace("From Date:", "").trim();
      else if (line.startsWith("To Date:"))
        result.toDate = line.replace("To Date:", "").trim();
      else if (line.startsWith("Project Guide:"))
        result.projectGuide = line.replace("Project Guide:", "").trim();
      else if (line.startsWith("Description:"))
        result.description = line.replace("Description:", "").trim();
    });
    return result;
  }

  // Fallback parser for old format: "Purpose (Guide: XYZ) - Notes: ABC"
  const guideMatch = purposeStr.match(/\(Guide:\s*(.*?)\)/);
  const notesMatch = purposeStr.match(/-\s*Notes:\s*(.*)/);

  let guide = guideMatch ? guideMatch[1] : "";
  let notes = notesMatch ? notesMatch[1] : "";
  let mainPurpose = purposeStr;

  if (guideMatch) {
    mainPurpose = mainPurpose.replace(guideMatch[0], "");
  }
  if (notesMatch) {
    mainPurpose = mainPurpose.replace(notesMatch[0], "");
  }

  return {
    purpose: mainPurpose.trim(),
    fromDate: "",
    toDate: "",
    projectGuide: guide.trim(),
    description: notes.trim(),
  };
};

export const PendingRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BorrowRequest[]>(
    mockEngine.getRequests(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReqForReject, setSelectedReqForReject] =
    useState<BorrowRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState(
    "Stock allocated for advanced research lab session",
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEscapeKey(() => setSelectedReqForReject(null), !!selectedReqForReject);

  const sortedPending = [...requests].sort((a, b) => {
    const dateA = parseUTCDate(a.requested_at || a.created_at).getTime();
    const dateB = parseUTCDate(b.requested_at || b.created_at).getTime();
    return dateB - dateA;
  });

  const pendingRequests = sortedPending.filter(
    (r) =>
      r.status === "pending" &&
      (r.request_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.student_name &&
          r.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.component_name &&
          r.component_name.toLowerCase().includes(searchQuery.toLowerCase()))),
  );

  const handleApprove = async (req: BorrowRequest) => {
    const remark = prompt(
      `Enter approval remark/notes for ${req.student_name} (optional):`,
      "Approved for lab project",
    );
    if (remark === null) return;
    setIsProcessing(true);
    try {
      await mockEngine.approveBorrowRequest(
        req.id,
        user?.id || "usr-faculty-1",
        remark,
      );
      toast.success(
        `Approved ${req.request_code} for ${req.student_name} (${req.quantity}x ${req.component_name})!`,
      );
      setRequests(mockEngine.getRequests());
    } catch (err: any) {
      toast.error(err.message || "Failed to approve request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForReject) return;
    setIsProcessing(true);
    try {
      await mockEngine.rejectBorrowRequest(
        selectedReqForReject.id,
        user?.id || "usr-faculty-1",
        rejectionReason,
      );
      toast.success(`Rejected request ${selectedReqForReject.request_code}`);
      setRequests(mockEngine.getRequests());
      setSelectedReqForReject(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to reject request");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (pendingRequests.length === 0) return;
    const remark = prompt(
      "Enter bulk approval remark/notes (optional):",
      "Bulk approved by coordinator",
    );
    if (remark === null) return;
    setIsProcessing(true);
    let approvedCount = 0;
    try {
      const promises = pendingRequests.map(async (req) => {
        try {
          await mockEngine.approveBorrowRequest(
            req.id,
            user?.id || "usr-faculty-1",
            remark,
          );
          approvedCount++;
        } catch (e) {
          // Skip failed
        }
      });
      await Promise.all(promises);
      toast.success(`Bulk approved ${approvedCount} pending requests!`);
      setRequests(mockEngine.getRequests());
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            Pending Borrow Requests
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Review student hardware requests and manage approval authorization
          </p>
        </div>

        {pendingRequests.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs shadow-md transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" /> Bulk Approve All (
            {pendingRequests.length})
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-3xl glass-card border border-[#E5E7EB] flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by request code, student name, or component..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl glass-input text-xs"
          />
        </div>
      </div>

      {/* Pending Queue Table */}
      <div className="glass-card rounded-3xl border border-[#E5E7EB] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[10px] font-bold uppercase tracking-wider text-gray-700">
                <th className="py-3.5 px-6">Req Code</th>
                <th className="py-3.5 px-6">Student Details</th>
                <th className="py-3.5 px-6">Component Requested</th>
                <th className="py-3.5 px-6">Qty</th>
                <th className="py-3.5 px-6">Project Purpose</th>
                <th className="py-3.5 px-6">Requested At</th>
                <th className="py-3.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-700">
                    <CheckCircle2 className="w-10 h-10 text-emerald-900 mx-auto mb-2 opacity-60" />
                    <p className="font-bold text-black text-sm">
                      No Pending Approvals
                    </p>
                    <p className="text-xs text-black0 mt-1">
                      All student component requests have been processed.
                    </p>
                  </td>
                </tr>
              ) : (
                pendingRequests.map((req) => {
                  const rowDetails = parsePurpose(req.purpose);
                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-white transition-colors"
                    >
                      <td className="py-4 px-6 font-mono font-bold text-indigo-900">
                        {req.request_code}
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-black">
                          {req.student_name}
                        </p>
                        <p className="text-[10px] text-gray-700 font-mono">
                          Reg: {req.student_register_no || "711721106001"}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          {req.component_image && (
                            <img
                              src={req.component_image}
                              alt={req.component_name}
                              className="w-8 h-8 rounded-xl object-cover"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-black">
                              {req.component_name}
                            </p>
                            <p className="text-[10px] text-gray-700">
                              {req.component_category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-extrabold text-indigo-900">
                        {req.quantity}
                      </td>
                      <td className="py-4 px-6 text-black max-w-xs">
                        {rowDetails.purpose || req.purpose}
                      </td>
                      <td className="py-4 px-6 text-gray-700 text-[11px]">
                        <div>{formatTimestamp(req.requested_at)}</div>
                        <div className="text-[10px] text-indigo-900 mt-0.5 font-semibold">
                          Period:{" "}
                          {rowDetails.fromDate && rowDetails.toDate
                            ? `${formatDateOnly(rowDetails.fromDate)} to ${formatDateOnly(rowDetails.toDate)}`
                            : "N/A"}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-900 hover:text-black font-bold text-xs flex items-center gap-1 border border-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => setSelectedReqForReject(req)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-900 hover:text-black font-bold text-xs flex items-center gap-1 border border-rose-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {selectedReqForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-md glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              <X className="w-4 h-4 text-rose-900" /> Reject Request (
              {selectedReqForReject.request_code})
            </h3>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div>
                <label className="block text-black font-semibold mb-1">
                  Rejection Reason for Student
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-black resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setSelectedReqForReject(null)}
                  className="px-4 py-2 text-gray-700 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
