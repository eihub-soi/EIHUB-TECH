import React, { useState } from "react";
import { mockEngine } from "../../services/mockEngine";
import { useAuth } from "../../contexts/AuthContext";
import { formatTimestamp, parseUTCDate } from "../../utils/timestamp";
import { NotificationItem } from "../../types";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Check,
  Search,
  Filter,
} from "lucide-react";

export const StudentNotifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    user ? mockEngine.getNotifications(user.id) : [],
  );
  const [filter, setFilter] = useState<"All" | "Unread">("All");

  const sortedNotifs = [...notifications].sort((a, b) => {
    return (
      parseUTCDate(b.created_at).getTime() -
      parseUTCDate(a.created_at).getTime()
    );
  });

  const filteredNotifs = sortedNotifs.filter(
    (n) => filter === "All" || !n.is_read,
  );

  const handleMarkAsRead = (id: string) => {
    mockEngine.markNotificationAsRead(id);
    if (user) {
      setNotifications(mockEngine.getNotifications(user.id));
    }
    toast.success("Notification marked as read");
  };

  const handleMarkAllRead = () => {
    notifications.forEach((n) => mockEngine.markNotificationAsRead(n.id));
    if (user) {
      setNotifications(mockEngine.getNotifications(user.id));
    }
    toast.success("All notifications marked as read");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            Notifications
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Stay updated on your request approvals, return confirmations, and
            lab alerts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#E5E7EB]">
            <button
              onClick={() => setFilter("All")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === "All"
                  ? "bg-[#60A5FA] text-white shadow-md"
                  : "text-gray-700 hover:text-black"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("Unread")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filter === "Unread"
                  ? "bg-[#60A5FA] text-white shadow-md"
                  : "text-gray-700 hover:text-black"
              }`}
            >
              Unread ({notifications.filter((n) => !n.is_read).length})
            </button>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-[#E6F0FF] text-black hover:text-black text-xs font-semibold border border-[#E5E7EB] transition-all"
          >
            <Check className="w-4 h-4 text-emerald-900" /> Mark all as read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifs.length === 0 ? (
          <div className="p-12 text-center glass-card rounded-3xl border border-[#E5E7EB] space-y-2">
            <Bell className="w-10 h-10 text-black0 mx-auto" />
            <h3 className="text-sm font-bold text-black">No Notifications</h3>
            <p className="text-xs text-gray-700">You are all caught up!</p>
          </div>
        ) : (
          filteredNotifs.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-3xl border transition-all flex items-start justify-between gap-4 ${
                n.is_read
                  ? "glass-card opacity-60 border-white/5"
                  : "glass-card border-[#60A5FA] bg-indigo-950/20 "
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">
                  {n.type === "success" && (
                    <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-900 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                  {n.type === "warning" && (
                    <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-900 flex items-center justify-center border border-amber-500/30">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  )}
                  {n.type === "info" && (
                    <div className="w-9 h-9 rounded-2xl bg-[#E6F0FF] text-blue-900 flex items-center justify-center border border-[#60A5FA]">
                      <Info className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-black">{n.title}</h4>
                  <p className="text-xs text-black mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                  <span className="text-[10px] text-black0 block mt-2 font-mono">
                    {formatTimestamp(n.created_at)}
                  </span>
                </div>
              </div>

              {!n.is_read && (
                <button
                  onClick={() => handleMarkAsRead(n.id)}
                  className="px-3 py-1.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-semibold text-xs border border-[#60A5FA] shrink-0 transition-all"
                >
                  Mark as read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
