import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockEngine } from "../../services/mockEngine";
import { useAuth } from "../../contexts/AuthContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { formatDateOnly } from "../../utils/timestamp";
import { BorrowRequest } from "../../types";
import { toast } from "sonner";
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  Info,
  ShieldCheck,
} from "lucide-react";

export const ReturnPortal: React.FC = () => {
  const { user } = useAuth();
  const [activeLoans, setActiveLoans] = useState<BorrowRequest[]>(
    mockEngine
      .getRequests()
      .filter(
        (r) =>
          r.status === "approved" &&
          !r.return_requested_at &&
          (r.student_id === user?.id || r.student_id === "usr-student-1"),
      ),
  );
  const [selectedReq, setSelectedReq] = useState<BorrowRequest | null>(null);
  const [condition, setCondition] = useState("Good Working Condition");
  const [description, setDescription] = useState("");

  useEscapeKey(() => setSelectedReq(null), !!selectedReq);

  const handleProcessReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    try {
      mockEngine.requestReturnComponent(
        selectedReq.id,
        user?.id || "usr-student-1",
        condition,
        description,
      );
      toast.success(
        `Return request submitted! Faculty will inspect and confirm the return.`,
      );
      setActiveLoans(
        mockEngine
          .getRequests()
          .filter(
            (r) =>
              r.status === "approved" &&
              !r.return_requested_at &&
              (r.student_id === user?.id || r.student_id === "usr-student-1"),
          ),
      );
      setSelectedReq(null);
      setDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to request return");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-black tracking-tight">
          Return Portal
        </h1>
        <p className="text-xs text-gray-700 mt-0.5">
          Initiate component return and submit condition report
        </p>
      </div>

      {activeLoans.length === 0 ? (
        <div className="p-12 text-center glass-card rounded-3xl border border-[#E5E7EB] space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-900 mx-auto" />
          <h3 className="text-base font-bold text-black">
            No Active Component Loans
          </h3>
          <p className="text-xs text-gray-700">
            You currently have no active borrowed components pending return.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activeLoans.map((req) => (
            <div
              key={req.id}
              className="p-5 rounded-3xl glass-card border border-[#E5E7EB] space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={req.component_image}
                    alt={req.component_name}
                    className="w-12 h-12 rounded-2xl object-cover"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-black">
                      {req.component_name}
                    </h3>
                    <p className="text-[10px] text-gray-700">
                      Code: {req.request_code} • Qty: {req.quantity}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-900 border border-amber-500/30">
                  Due: {formatDateOnly(req.expected_return_at)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white text-xs space-y-1">
                <p className="text-gray-700 text-[10px]">Issued By</p>
                <p className="font-semibold text-black">
                  {req.approved_by_name || "Prof. Robert Chen"}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedReq(req);
                  setCondition("Good Working Condition");
                  setDescription("");
                }}
                className="w-full py-2.5 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Initiate Return
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Return Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-md glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-900" /> Return Inspection
              ({selectedReq.component_name})
            </h3>

            <form onSubmit={handleProcessReturn} className="space-y-4 text-xs">
              <div>
                <label className="block text-black font-semibold mb-1">
                  Component Condition Status
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                >
                  <option value="Good Working Condition">
                    Good Working Condition
                  </option>
                  <option value="Minor Wear / Scratches">
                    Minor Wear / Scratches
                  </option>
                  <option value="Damaged / Faulty Pin">
                    Damaged / Faulty Pin
                  </option>
                  <option value="Lost Accessory / Wire">
                    Lost Accessory / Wire
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the component state or details of wear/accessories..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl glass-input text-black resize-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Please return the physical component to Lab Cabinet (
                  {selectedReq.component_name}) for physical faculty
                  verification.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="px-4 py-2 text-gray-700 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold "
                >
                  Request Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
