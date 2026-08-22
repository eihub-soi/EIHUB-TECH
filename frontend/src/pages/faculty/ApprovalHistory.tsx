import React, { useState } from "react";
import { mockEngine } from "../../services/mockEngine";
import { BorrowRequest } from "../../types";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  formatTimestamp,
  formatDateOnly,
  parseUTCDate,
} from "../../utils/timestamp";
import {
  ClipboardList,
  Search,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  X,
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

const getCurrentKolkataDateStr = () => {
  const parts = Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  return `${year}-${month}-${day}`;
};

const normalizeToYYYYMMDD = (dateStr: string | undefined | null): string | null => {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const match = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const parts = Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const day = parts.find((p) => p.type === "day")?.value || "01";
      const month = parts.find((p) => p.type === "month")?.value || "01";
      const year = parts.find((p) => p.type === "year")?.value || "1970";
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  return null;
};

const getEffectiveStatus = (req: BorrowRequest): string => {
  if (req.status === "returned" || req.returned_at) {
    return "returned";
  }
  if (req.status === "approved") {
    const rowDetails = parsePurpose(req.purpose);
    const toDateStr = rowDetails.toDate;
    if (toDateStr) {
      const normalizedToDate = normalizeToYYYYMMDD(toDateStr);
      if (normalizedToDate) {
        const currentKolkataDate = getCurrentKolkataDateStr();
        if (currentKolkataDate > normalizedToDate) {
          return "overdue";
        }
      }
    }
  }
  return req.status;
};

export const ApprovalHistory: React.FC = () => {
  const [requests] = useState<BorrowRequest[]>(mockEngine.getRequests());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedGuide, setSelectedGuide] = useState("all");
  const [selectedReq, setSelectedReq] = useState<BorrowRequest | null>(null);

  useEscapeKey(() => setSelectedReq(null), !!selectedReq);

  // Dynamically extract unique guides from history requests
  const uniqueGuides = Array.from(
    new Set(
      requests
        .filter((r) => r.status !== "pending")
        .map((r) => parsePurpose(r.purpose).projectGuide)
        .filter((g) => g && g.trim() !== ""),
    ),
  ).sort();

  const sortedRequests = [...requests].sort((a, b) => {
    const dateA = parseUTCDate(
      a.approved_at || a.requested_at || a.created_at,
    ).getTime();
    const dateB = parseUTCDate(
      b.approved_at || b.requested_at || b.created_at,
    ).getTime();
    return dateB - dateA;
  });

  const historyRequests = sortedRequests.filter((r) => {
    if (r.status === "pending") return false;

    const rowDetails = parsePurpose(r.purpose);
    const effectiveStatus = getEffectiveStatus(r);

    // Status Filter
    if (selectedStatus !== "all" && effectiveStatus !== selectedStatus) return false;

    // Guide Filter
    if (selectedGuide !== "all" && rowDetails.projectGuide !== selectedGuide)
      return false;

    // Search Query Filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const matchesCode = r.request_code.toLowerCase().includes(query);
      const matchesStudent =
        r.student_name && r.student_name.toLowerCase().includes(query);
      const matchesReg =
        r.student_register_no &&
        r.student_register_no.toLowerCase().includes(query);
      const matchesComponent =
        r.component_name && r.component_name.toLowerCase().includes(query);
      const matchesGuide =
        rowDetails.projectGuide &&
        rowDetails.projectGuide.toLowerCase().includes(query);
      const matchesPurpose =
        rowDetails.purpose && rowDetails.purpose.toLowerCase().includes(query);
      const matchesStatus = effectiveStatus.toLowerCase().includes(query);

      return (
        matchesCode ||
        matchesStudent ||
        matchesReg ||
        matchesComponent ||
        matchesGuide ||
        matchesPurpose ||
        matchesStatus
      );
    }

    return true;
  });

  const details = selectedReq ? parsePurpose(selectedReq.purpose) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-blue-900" /> Approval &
            Return History
          </h1>
          <p className="text-xs text-gray-700 mt-1">
            View past approvals, rejections and processed returns
          </p>
        </div>
      </div>

      {/* Help Guide Banner */}
      <div className="p-4 rounded-3xl bg-[#E6F0FF] border border-[#60A5FA] text-xs text-gray-900 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-gray-900 block mb-0.5">
            Approval History Guide
          </span>
          <p className="text-[11px] leading-relaxed text-gray-700">
            Use this dashboard to track all resolved component transactions. You
            can search by request code, student details, components, or guides.
            Use the filters to isolate records by status (Approved, Rejected,
            Returned) or specific Project Guides.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-3xl glass-card border border-[#E5E7EB]">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, component, guide, status..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-xs text-black"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl glass-input text-xs text-black cursor-pointer appearance-none bg-white/80 border border-white/5 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
            <option value="overdue">Overdue</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700">
            <svg
              className="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>

        {/* Guide Filter */}
        <div className="relative">
          <select
            value={selectedGuide}
            onChange={(e) => setSelectedGuide(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl glass-input text-xs text-black cursor-pointer appearance-none bg-white/80 border border-white/5 focus:outline-none"
          >
            <option value="all">All Project Guides</option>
            {uniqueGuides.map((guide) => (
              <option key={guide} value={guide}>
                {guide}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700">
            <svg
              className="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="glass-card rounded-3xl border border-[#E5E7EB] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[10px] font-bold uppercase tracking-wider text-gray-700">
                <th className="py-3.5 px-6">Req Code</th>
                <th className="py-3.5 px-6">Student Details</th>
                <th className="py-3.5 px-6">Component</th>
                <th className="py-3.5 px-6">Qty</th>
                <th className="py-3.5 px-6">Project Purpose</th>
                <th className="py-3.5 px-6">Project Guide</th>
                <th className="py-3.5 px-6">Borrowing Period</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {historyRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-700">
                    <CheckCircle2 className="w-10 h-10 text-black0 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-black text-sm">
                      No History Records
                    </p>
                    <p className="text-xs text-black0 mt-1">
                      No completed component transactions found.
                    </p>
                  </td>
                </tr>
              ) : (
                historyRequests.map((req) => {
                  const rowDetails = parsePurpose(req.purpose);
                  const effectiveStatus = getEffectiveStatus(req);
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
                          Reg: {req.student_register_no}
                        </p>
                      </td>
                      <td className="py-4 px-6 font-semibold text-black">
                        {req.component_name}
                      </td>
                      <td className="py-4 px-6 font-extrabold text-indigo-900">
                        {req.quantity}
                      </td>
                      <td className="py-4 px-6 text-black max-w-xs truncate">
                        {rowDetails.purpose || req.purpose}
                      </td>
                      <td className="py-4 px-6 text-black font-semibold">
                        {rowDetails.projectGuide || "N/A"}
                      </td>
                      <td className="py-4 px-6 text-gray-700 text-[10px]">
                        <div>Requested: {formatDateOnly(req.requested_at)}</div>
                        <div className="text-indigo-900 mt-0.5 font-semibold">
                          {rowDetails.fromDate && rowDetails.toDate
                            ? `${formatDateOnly(rowDetails.fromDate)} to ${formatDateOnly(rowDetails.toDate)}`
                            : "N/A"}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {effectiveStatus === "approved" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/20 text-emerald-350">
                            Approved
                          </span>
                        )}
                        {effectiveStatus === "rejected" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/20 text-rose-350">
                            Rejected
                          </span>
                        )}
                        {effectiveStatus === "returned" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#60A5FA]/15 border border-[#60A5FA] text-indigo-350">
                            Returned
                          </span>
                        )}
                        {effectiveStatus === "overdue" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/20 text-rose-350">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => setSelectedReq(req)}
                          className="p-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-slate-500 text-slate-450 hover:text-black transition-all"
                          title="View workflow history"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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
                  <ClipboardList className="w-4 h-4 text-blue-900" /> Request
                  Details ({selectedReq.request_code})
                </h3>
                <p className="text-[11px] text-gray-700">
                  Transaction log and resolution details
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
                  <p className="text-gray-700 text-[10px]">Student Name</p>
                  <p className="font-bold text-black">
                    {selectedReq.student_name}
                  </p>
                  <p className="text-[10px] text-gray-700 font-mono">
                    Reg: {selectedReq.student_register_no}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">Component Name</p>
                  <p className="font-bold text-black">
                    {selectedReq.component_name}
                  </p>
                  <p className="text-[10px] text-gray-700">
                    {selectedReq.component_category}
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">Quantity</p>
                  <p className="font-bold text-black">
                    {selectedReq.quantity} units
                  </p>
                </div>
                <div>
                  <p className="text-gray-700 text-[10px]">Project Guide</p>
                  <p className="font-bold text-black">
                    {details?.projectGuide || "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-700 text-[10px]">Status</p>
                  <div className="mt-1">
                    {getEffectiveStatus(selectedReq) === "approved" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/20 text-emerald-350">
                        Approved
                      </span>
                    )}
                    {getEffectiveStatus(selectedReq) === "rejected" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/20 text-rose-350">
                        Rejected
                      </span>
                    )}
                    {getEffectiveStatus(selectedReq) === "returned" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#60A5FA]/15 border border-[#60A5FA] text-indigo-350">
                        Returned
                      </span>
                    )}
                    {getEffectiveStatus(selectedReq) === "overdue" && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 border border-rose-500/20 text-rose-350">
                        Overdue
                      </span>
                    )}
                  </div>
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

              {/* Resolution details timeline */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                  Resolution History
                </p>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#E6F0FF] text-blue-900 flex items-center justify-center shrink-0 border border-[#60A5FA] text-[10px] font-bold animate-pulse">
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
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-900 flex items-center justify-center shrink-0 border border-emerald-500/30 text-[10px] font-bold">
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
                      {selectedReq.rejection_reason &&
                        selectedReq.status === "approved" && (
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

                {selectedReq.status === "rejected" && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-900 flex items-center justify-center shrink-0 border border-rose-500/30 text-[10px] font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-bold text-black">
                        Rejected by Faculty (
                        {selectedReq.approved_by_name || "Prof. Robert Chen"})
                      </p>
                      <p className="text-[10px] text-gray-700">
                        Reason:{" "}
                        <span className="text-rose-900 italic">
                          "{selectedReq.rejection_reason || "Stock limitations"}
                          "
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {selectedReq.return_requested_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 border border-amber-500/30 text-[10px] font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-bold text-black">
                        Return Requested by Student
                      </p>
                      <p className="text-[10px] text-gray-700">
                        {formatTimestamp(selectedReq.return_requested_at)}
                      </p>
                    </div>
                  </div>
                )}

                {selectedReq.returned_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#E6F0FF] text-blue-900 flex items-center justify-center shrink-0 border border-[#60A5FA] text-[10px] font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-bold text-black">
                        Returned & Verified
                      </p>
                      <p className="text-[10px] text-gray-700">
                        {formatTimestamp(selectedReq.returned_at)}
                      </p>
                      <div className="mt-1 space-y-0.5 p-2 rounded-xl bg-white border border-white/5 text-[10px]">
                        <p className="text-gray-700">
                          Missing Accessories:{" "}
                          <span className="text-rose-900 font-semibold">
                            {selectedReq.return_missing_details || "None"}
                          </span>
                        </p>
                        <p className="text-gray-700">
                          Damaged Parts:{" "}
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

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2 rounded-xl bg-white text-black hover:text-black text-xs"
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
