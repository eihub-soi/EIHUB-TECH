import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { mockEngine } from "../../services/mockEngine";
import { toast } from "sonner";
import {
  ShoppingBag,
  Trash2,
  Calendar,
  User,
  FileText,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Clock,
} from "lucide-react";

export const CartPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cart, removeFromCart, updateCartQuantity, clearCart, totalItems } =
    useCart();

  // Requirements Form Fields
  const [purpose, setPurpose] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("17:00");
  const [projectGuide, setProjectGuide] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !user) return;

    if (!purpose.trim()) {
      toast.error("Please type your project purpose");
      return;
    }
    if (!fromDate) {
      toast.error("Please select a From Date");
      return;
    }
    if (!toDate) {
      toast.error("Please select a To Date");
      return;
    }
    if (!projectGuide.trim()) {
      toast.error("Please type your project guide name");
      return;
    }
    if (!projectDescription.trim()) {
      toast.error("Please type your project description");
      return;
    }

    setIsSubmitting(true);
    try {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)),
      );

      const formatTimeTo12Hour = (time24: string) => {
        if (!time24) return "05:00 PM";
        const [hoursStr, minutesStr] = time24.split(":");
        let hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;
        const hoursFormatted = hours < 10 ? '0' + hours : hours;
        return `${hoursFormatted}:${minutesFormatted} ${ampm}`;
      };

      let submittedCount = 0;
      cart.forEach((item) => {
        const fullPurpose = `Project Purpose: ${purpose}\nFrom Date: ${fromDate}\nTo Date: ${toDate}\nTo Time: ${formatTimeTo12Hour(toTime)}\nProject Guide: ${projectGuide}\nDescription: ${projectDescription}`;
        mockEngine.submitBorrowRequest(
          user.id,
          item.component.id,
          item.quantity,
          fullPurpose,
          days,
        );
        submittedCount++;
      });

      toast.success(
        `Successfully submitted borrowing requests for ${submittedCount} components to ${projectGuide}!`,
      );
      clearCart();
      navigate("/student/requests");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit borrow request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/student/browse")}
          className="p-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#60A5FA] text-gray-700 hover:text-black transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-blue-900 animate-pulse" />{" "}
            Requirements Cart
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Submit borrowing requests for selected components
          </p>
        </div>
      </div>

      {cart.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-white/15 text-center space-y-4 max-w-lg mx-auto mt-8">
          <div className="w-16 h-16 rounded-full bg-white border border-white/5 flex items-center justify-center mx-auto text-black0">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <p className="text-black text-sm font-bold">
              Your requirements cart is empty
            </p>
            <p className="text-xs text-slate-450 mt-1">
              Add electronic components from the inventory first to request
              them.
            </p>
          </div>
          <button
            onClick={() => navigate("/student/browse")}
            className="px-5 py-2.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white text-xs font-bold transition-all flex items-center gap-2 mx-auto"
          >
            <Boxes className="w-4 h-4" />
            <span>Browse Components</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Item Cards list */}
          <div className="lg:col-span-2 space-y-3.5">
            {cart.map((item) => (
              <div
                key={item.component.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-white border border-white/5 gap-4"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.component.image_url}
                    alt={item.component.name}
                    className="w-14 h-14 rounded-xl object-cover bg-white p-1 border border-white/5"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-black">
                      {item.component.name}
                    </h3>
                    <p className="text-[10px] text-gray-700 mt-0.5">
                      {item.component.category}
                    </p>
                    <p className="text-[10px] text-black0">
                      Cabinet: {item.component.cabinet} • SKU:{" "}
                      {item.component.sku}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                  <div className="flex items-center bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-inner">
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(item.component.id, item.quantity - 1)
                      }
                      className="px-3 py-1 text-gray-700 hover:text-black hover:bg-slate-855 font-extrabold text-xs transition-all"
                    >
                      -
                    </button>
                    <span className="px-2.5 font-extrabold text-black text-xs">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateCartQuantity(item.component.id, item.quantity + 1)
                      }
                      disabled={item.quantity >= item.component.available_stock}
                      className="px-3 py-1 text-gray-700 hover:text-black hover:bg-slate-855 font-extrabold text-xs transition-all disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.component.id)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/20 transition-all"
                    title="Remove from cart"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={clearCart}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-slate-500 text-gray-700 hover:text-black text-xs font-bold transition-all"
              >
                Clear Cart
              </button>
              <div className="text-right">
                <span className="text-xs text-blue-900 font-bold">
                  Total items in cart: {totalItems}
                </span>
              </div>
            </div>
          </div>

          {/* Borrow Request Form */}
          <div className="p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-5 bg-white">
            <h3 className="text-xs font-bold text-black flex items-center gap-1.5 border-b border-[#E5E7EB] pb-2">
              <Sparkles className="w-4 h-4 text-blue-900 animate-pulse" />{" "}
              Borrow Request Form
            </h3>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div>
                <label className="block text-black font-semibold mb-1">
                  Project Purpose / Topic
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="E.g. Smart IoT Irrigation Circuit"
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-black font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-black font-semibold mb-1 flex items-center gap-1 text-[11px] whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 text-blue-900" /> From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-black font-semibold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1 flex items-center gap-1 text-[11px] whitespace-nowrap">
                    <Calendar className="w-3.5 h-3.5 text-blue-900" /> To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-black font-semibold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1 flex items-center gap-1 text-[11px] whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-indigo-900" /> To Time
                  </label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-black font-semibold text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-900" /> Project
                  Guide
                </label>
                <input
                  type="text"
                  list="faculty-guides-list"
                  value={projectGuide}
                  onChange={(e) => setProjectGuide(e.target.value)}
                  placeholder="Type project guide (e.g. Prof. Robert Chen)"
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-black font-semibold"
                  required
                />
                <datalist id="faculty-guides-list">
                  <option value="Prof. Robert Chen (FAC-ECE-102)" />
                  <option value="Dr. Sarah Johnson (FAC-ECE-105)" />
                  <option value="Dr. M. K. Ananth (FAC-ECE-108)" />
                  <option value="Prof. S. R. Priya (FAC-ECE-112)" />
                </datalist>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-900" /> Description
                  & Hardware Notes
                </label>
                <textarea
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Circuit description or component usage pinouts..."
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-black resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                {isSubmitting
                  ? "Submitting Borrowing Request..."
                  : "Submit Hardware Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
