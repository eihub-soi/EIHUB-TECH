import React, { useState } from "react";
import { mockEngine } from "../../services/mockEngine";
import { useAuth } from "../../contexts/AuthContext";
import { formatDateOnly, parseUTCDate } from "../../utils/timestamp";
import { BorrowRequest } from "../../types";
import { toast } from "sonner";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  RotateCcw,
  Search,
  Check,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Boxes,
  X,
} from "lucide-react";

export const ReturnApprovals: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BorrowRequest[]>(
    mockEngine.getRequests(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<BorrowRequest | null>(
    null,
  );
  const [inspectionNotes, setInspectionNotes] = useState(
    "Good Working Condition - Returned to Cabinet",
  );
  const [missingDetails, setMissingDetails] = useState("");
  const [damagedDetails, setDamagedDetails] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEscapeKey(() => setSelectedReturn(null), !!selectedReturn);

  const sortedReturnable = [...requests].sort((a, b) => {
    const dateA = parseUTCDate(
      a.return_requested_at || a.requested_at || a.created_at,
    ).getTime();
    const dateB = parseUTCDate(
      b.return_requested_at || b.requested_at || b.created_at,
    ).getTime();
    return dateB - dateA;
  });

  // Filter approved or active loans ready for return processing (only those where a return has been requested by the student)
  const returnableRequests = sortedReturnable.filter(
    (r) =>
      (r.status === "approved" || r.status === "overdue") &&
      r.return_requested_at &&
      (r.request_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.student_name &&
          r.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.component_name &&
          r.component_name.toLowerCase().includes(searchQuery.toLowerCase()))),
  );

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setIsProcessing(true);
    try {
      await mockEngine.processReturnComponent(
        selectedReturn.id,
        user?.id || "usr-faculty-1",
        inspectionNotes,
        missingDetails,
        damagedDetails,
        remarks,
      );
      toast.success(
        `Confirmed return for ${selectedReturn.request_code} (${selectedReturn.component_name})! Stock returned.`,
      );
      setRequests(mockEngine.getRequests());
      setSelectedReturn(null);
      setMissingDetails("");
      setDamagedDetails("");
      setRemarks("");
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-black tracking-tight">
          Return Approvals & Inspection Queue
        </h1>
        <p className="text-xs text-gray-700 mt-0.5">
          Inspect physical component returns, verify condition, and restore
          stock to cabinet inventory
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-3xl glass-card border border-[#E5E7EB] flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search active loans by request code, student, or component..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl glass-input text-xs"
          />
        </div>
      </div>

      {/* Return Inspection Table */}
      <div className="glass-card rounded-3xl border border-[#E5E7EB] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[10px] font-bold uppercase tracking-wider text-gray-700">
                <th className="py-3.5 px-6">Req Code</th>
                <th className="py-3.5 px-6">Student</th>
                <th className="py-3.5 px-6">Component Loaned</th>
                <th className="py-3.5 px-6">Qty</th>
                <th className="py-3.5 px-6">Expected Return</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {returnableRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-700">
                    <CheckCircle2 className="w-10 h-10 text-emerald-900 mx-auto mb-2 opacity-60" />
                    <p className="font-bold text-black text-sm">
                      No Active Loans Pending Return
                    </p>
                    <p className="text-xs text-black0 mt-1">
                      All borrowed items are in stock or processed.
                    </p>
                  </td>
                </tr>
              ) : (
                returnableRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-white transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-indigo-900">
                      {req.request_code}
                    </td>
                    <td className="py-4 px-6 font-bold text-black">
                      {req.student_name}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={req.component_image}
                          alt={req.component_name}
                          className="w-8 h-8 rounded-xl object-cover"
                        />
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
                    <td className="py-4 px-6 font-bold text-indigo-900">
                      {req.quantity}
                    </td>
                    <td className="py-4 px-6 text-gray-700 text-[11px]">
                      {formatDateOnly(req.expected_return_at)}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-900 border border-amber-500/30">
                        Active Loan
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => {
                          setSelectedReturn(req);
                          setInspectionNotes(
                            "Good Working Condition - Restocked to Cabinet",
                          );
                          setMissingDetails("");
                          setDamagedDetails("");
                          setRemarks("");
                        }}
                        disabled={isProcessing}
                        className="px-3.5 py-1.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs flex items-center gap-1.5 mx-auto transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Process Return
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Inspection Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-md glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-blue-900" /> Physical Return
                Inspection ({selectedReturn.request_code})
              </h3>
              <button
                disabled={isProcessing}
                onClick={() => setSelectedReturn(null)}
                className="p-1 text-gray-700 hover:text-black disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-white border border-white/5 space-y-1">
                <p className="text-[10px] text-gray-700">
                  Student: {selectedReturn.student_name}
                </p>
                <p className="font-bold text-black">
                  Item: {selectedReturn.quantity}x{" "}
                  {selectedReturn.component_name}
                </p>
                <p className="text-[10px] text-gray-700 mt-1">
                  Student Condition:{" "}
                  <span className="text-amber-900 font-semibold">
                    {selectedReturn.return_condition}
                  </span>
                </p>
                {selectedReturn.return_description && (
                  <p className="text-[10px] text-gray-700">
                    Student Description:{" "}
                    <span className="text-black italic">
                      "{selectedReturn.return_description}"
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Inspection Condition Status
                </label>
                <select
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                >
                  <option value="Good Working Condition - Restocked to Cabinet">
                    Good Working Condition - Restocked to Cabinet
                  </option>
                  <option value="Minor Wear - Working Properly">
                    Minor Wear - Working Properly
                  </option>
                  <option value="Damaged Pin / Needs Repair">
                    Damaged Pin / Needs Repair
                  </option>
                  <option value="Incomplete Parts / Accessories Missing">
                    Incomplete Parts / Accessories Missing
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Missing Accessories / Components Details
                </label>
                <input
                  type="text"
                  value={missingDetails}
                  onChange={(e) => setMissingDetails(e.target.value)}
                  placeholder="e.g. Missing USB cable, none..."
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                />
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Damaged Parts / Pins Details
                </label>
                <input
                  type="text"
                  value={damagedDetails}
                  onChange={(e) => setDamagedDetails(e.target.value)}
                  placeholder="e.g. Scratched panel, bent pins, none..."
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                />
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Remarks / Additional Notes
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Verified return to cabinet A2..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl glass-input text-black resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setSelectedReturn(null)}
                  className="px-4 py-2 text-gray-700 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? "Verifying..." : "Verify Return & Restock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
