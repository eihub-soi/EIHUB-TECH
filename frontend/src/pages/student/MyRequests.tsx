import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockEngine } from "../../services/mockEngine";
import { useAuth } from "../../contexts/AuthContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  formatTimestamp,
  formatDateOnly,
  parseUTCDate,
} from "../../utils/timestamp";
import { BorrowRequest, RequestStatus } from "../../types";
import { generateStudentReceiptPdf } from "../../utils/pdfGenerator";
import { toast } from "sonner";
import {
  ClipboardList,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  X,
  FileText,
} from "lucide-react";

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

export const MyRequests: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<BorrowRequest[]>(
    mockEngine
      .getRequests()
      .filter(
        (r) => r.student_id === user?.id || r.student_id === "usr-student-1",
      ),
  );
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "All">(
    "All",
  );
  const [selectedReq, setSelectedReq] = useState<BorrowRequest | null>(null);

  useEscapeKey(() => setSelectedReq(null), !!selectedReq);

  const sortedRequests = [...requests].sort((a, b) => {
    const dateA = parseUTCDate(a.requested_at || a.created_at).getTime();
    const dateB = parseUTCDate(b.requested_at || b.created_at).getTime();
    return dateB - dateA;
  });

  const filteredRequests = sortedRequests.filter(
    (r) => statusFilter === "All" || r.status === statusFilter,
  );

  const details = selectedReq ? parsePurpose(selectedReq.purpose) : null;

  const handleDownloadReceipt = async (req: BorrowRequest) => {
    toast.info("Generating official PDF receipt...");
    try {
      await generateStudentReceiptPdf(req);
      toast.success("Receipt downloaded successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF receipt.");
    }
  };

  const renderStatusBadge = (req: BorrowRequest) => {
    const status = req.status;
    switch (status) {
      case "approved":
        if (req.return_requested_at) {
          return (
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-900 border border-amber-500/30 flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3 text-amber-900" /> Return Pending
            </span>
          );
        }
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/20 text-emerald-900 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "pending":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-900 border border-amber-500/30 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "rejected":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-500/20 text-rose-900 border border-rose-500/30 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" /> Rejected
          </span>
        );
      case "returned":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[#E6F0FF] text-indigo-900 border border-[#60A5FA] flex items-center gap-1 w-fit">
            <RotateCcw className="w-3 h-3" /> Returned
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            My Requests
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Track borrowing requests and download transaction receipts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {["All", "pending", "approved", "returned", "rejected"].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    statusFilter === st
                      ? "bg-[#60A5FA] text-white shadow-md "
                      : "bg-white text-gray-700 hover:text-black border border-white/5"
                  }`}
                >
                  {st}
                </button>
              ),
            )}
          </div>

          <button
            onClick={() => navigate("/student/browse")}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs transition-all hover:scale-105 shrink-0"
          >
            + New Request
          </button>
        </div>
      </div>

      {/* Data Table matching preview UI */}
      <div className="glass-card rounded-3xl border border-[#E5E7EB] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[11px] font-bold uppercase tracking-wider text-gray-700">
                <th className="py-4 px-6">Req ID</th>
                <th className="py-4 px-6">Component</th>
                <th className="py-4 px-6">Quantity</th>
                <th className="py-4 px-6">Requested At</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-700">
                    No requests found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
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
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              req.component_image ||
                              "https://images.unsplash.com/photo-1608564697071-ddf911d81370?w=100&auto=format&fit=crop&q=80"
                            }
                            alt={req.component_name}
                            className="w-8 h-8 rounded-xl object-cover"
                          />
                          <div>
                            <p className="font-bold text-black">
                              {req.component_name}
                            </p>
                            <p className="text-[10px] text-gray-700">
                              {req.component_category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-black">
                        {req.quantity}
                      </td>
                      <td className="py-4 px-6 text-gray-700">
                        <div>{formatTimestamp(req.requested_at)}</div>
                        <div className="text-[10px] text-indigo-900 mt-0.5 font-semibold">
                          Period:{" "}
                          {rowDetails.fromDate && rowDetails.toDate
                            ? `${formatDateOnly(rowDetails.fromDate)} to ${formatDateOnly(rowDetails.toDate)}`
                            : "N/A"}
                        </div>
                      </td>
                      <td className="py-4 px-6">{renderStatusBadge(req)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedReq(req)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#E6F0FF] text-black hover:text-black font-semibold text-[11px] flex items-center gap-1 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          {req.status === "approved" && (
                            <button
                              onClick={() => handleDownloadReceipt(req)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-semibold text-[11px] flex items-center gap-1 border border-[#60A5FA] transition-all"
                              title="Download Receipt"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </button>
                          )}
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

      {/* Request Details Timeline Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-lg glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-900" /> Request
                  Details ({selectedReq.request_code})
                </h3>
                <p className="text-[11px] text-gray-700">
                  Transaction log and approval timeline
                </p>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="p-1 rounded-xl text-gray-700 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-white border border-white/5">
                <div>
                  <p className="text-gray-700 text-[10px]">Component Name</p>
                  <p className="font-bold text-black">
                    {selectedReq.component_name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">Quantity</p>
                  <p className="font-bold text-black">
                    {selectedReq.quantity} units
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">Status</p>
                  <div className="mt-1">{renderStatusBadge(selectedReq)}</div>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">Project Guide</p>
                  <p className="font-bold text-black">
                    {details?.projectGuide || "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-700 text-[10px]">
                    Project Purpose / Topic
                  </p>
                  <p className="font-bold text-black">
                    {details?.purpose || selectedReq.purpose}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">From Date</p>
                  <p className="font-bold text-black">
                    {details?.fromDate
                      ? formatDateOnly(details.fromDate)
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">To Date</p>
                  <p className="font-bold text-black">
                    {details?.toDate ? formatDateOnly(details.toDate) : "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-700 text-[10px]">
                    Description & Hardware Notes
                  </p>
                  <p className="font-bold text-black whitespace-pre-wrap">
                    {details?.description || "N/A"}
                  </p>
                </div>
              </div>

              {/* Workflow timeline */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                  Workflow Timeline
                </p>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#E6F0FF] text-blue-900 flex items-center justify-center shrink-0 border border-[#60A5FA]">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-black">Submitted by Student</p>
                    <p className="text-[10px] text-gray-700">
                      {formatTimestamp(selectedReq.requested_at)}
                    </p>
                  </div>
                </div>

                {selectedReq.approved_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-900 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      2
                    </div>
                    <div>
                      <p className="font-bold text-black">
                        Approved by Faculty (
                        {selectedReq.approved_by_name || "Prof. Robert Chen"})
                      </p>
                      <p className="text-[10px] text-gray-700">
                        {formatTimestamp(selectedReq.approved_at)}
                      </p>
                      {selectedReq.rejection_reason && (
                        <p className="text-[10px] text-emerald-900 mt-0.5">
                          Remark:{" "}
                          <span className="italic">
                            "{selectedReq.rejection_reason}"
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedReq.return_requested_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 border border-amber-500/30">
                      3
                    </div>
                    <div>
                      <p className="font-bold text-black">
                        Return Requested by Student
                      </p>
                      <p className="text-[10px] text-gray-700">
                        {formatTimestamp(selectedReq.return_requested_at)}
                      </p>
                      {selectedReq.return_condition && (
                        <p className="text-[10px] text-black mt-0.5">
                          Reported Condition:{" "}
                          <span className="text-amber-900 font-semibold">
                            {selectedReq.return_condition}
                          </span>
                        </p>
                      )}
                      {selectedReq.return_description && (
                        <p className="text-[10px] text-gray-700 mt-0.5">
                          Description:{" "}
                          <span className="text-black italic">
                            "{selectedReq.return_description}"
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedReq.returned_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E6F0FF] text-blue-900 flex items-center justify-center shrink-0 border border-[#60A5FA]">
                      4
                    </div>
                    <div>
                      <p className="font-bold text-black">
                        Returned & Inspected ({selectedReq.return_condition})
                      </p>
                      <p className="text-[10px] text-gray-700">
                        {formatTimestamp(selectedReq.returned_at)}
                      </p>
                      <div className="mt-1 space-y-0.5 p-2 rounded-xl bg-white border border-white/5 text-[10px]">
                        <p className="text-gray-700">
                          Missing Accessories/Parts:{" "}
                          <span className="text-rose-900 font-semibold">
                            {selectedReq.return_missing_details || "None"}
                          </span>
                        </p>
                        <p className="text-gray-700">
                          Damaged Parts/Pins:{" "}
                          <span className="text-rose-900 font-semibold">
                            {selectedReq.return_damaged_details || "None"}
                          </span>
                        </p>
                        <p className="text-gray-700">
                          Remarks:{" "}
                          <span className="text-black font-semibold">
                            {selectedReq.return_remarks || "None"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
              {selectedReq.status === "approved" && (
                <button
                  onClick={() => handleDownloadReceipt(selectedReq)}
                  className="px-4 py-2 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF Receipt
                </button>
              )}
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2 rounded-xl bg-white text-black text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
