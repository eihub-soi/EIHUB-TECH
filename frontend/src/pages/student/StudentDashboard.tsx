import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { formatTimeOnly, parseUTCDate } from "../../utils/timestamp";
import { mockEngine } from "../../services/mockEngine";
import { StatCard } from "../../components/common/StatCard";
import { generateStudentReceiptPdf } from "../../utils/pdfGenerator";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Boxes,
  Clock,
  CheckCircle2,
  RotateCcw,
  Bell,
  ArrowRight,
  Download,
  PlusCircle,
  AlertCircle,
  Sparkles,
  Search,
  Info,
} from "lucide-react";
import { BorrowRequest } from "../../types";

// Helper to get student's dynamic monthly borrowings chart data
const getStudentChartData = (requests: BorrowRequest[]) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = monthNames[month];
  
  const data = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${monthLabel} ${d < 10 ? '0' + d : d}`;
    
    // Filter requests requested on this day in the current month/year
    const dailyBorrowings = requests.filter((r) => {
      const reqDate = new Date(r.requested_at);
      return (
        reqDate.getDate() === d &&
        reqDate.getMonth() === month &&
        reqDate.getFullYear() === year
      );
    }).length;
    
    data.push({
      day: dayStr,
      borrowings: dailyBorrowings,
    });
  }
  return data;
};

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    mockEngine.syncWithD1();
    
    const updateDashboardData = () => {
      const allReqs = mockEngine.getRequests();
      const studentReqs = allReqs.filter(
        (r) => r.student_id === user?.id || r.student_id === "usr-student-1",
      );
      setRequests(studentReqs);

      const rawNotifications = user ? mockEngine.getNotifications(user.id) : [];
      const sortedNotifs = [...rawNotifications].sort((a, b) => {
        return (
          parseUTCDate(b.created_at).getTime() -
          parseUTCDate(a.created_at).getTime()
        );
      });
      setNotifications(sortedNotifs);
    };

    updateDashboardData();

    const unsubscribe = mockEngine.subscribe(updateDashboardData);
    return unsubscribe;
  }, [user]);

  const borrowedCount = requests.filter(
    (r) => r.status === "approved" && !r.return_requested_at,
  ).length;
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const returnPendingCount = requests.filter(
    (r) => r.return_requested_at && r.status !== "returned",
  ).length;

  const handleDownloadLatestReceipt = async () => {
    const approvedReq =
      requests.find((r) => r.status === "approved") || requests[0];
    if (approvedReq) {
      toast.info("Generating official PDF receipt...");
      try {
        await generateStudentReceiptPdf(approvedReq);
        toast.success("Receipt downloaded successfully.");
      } catch (err) {
        console.error(err);
        toast.error("Failed to generate PDF receipt.");
      }
    } else {
      toast.error("No borrow requests found to download receipt.");
    }
  };

  const chartData = getStudentChartData(requests);

  const now = new Date();
  const standardMonthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthLabel = standardMonthsFull[now.getMonth()];
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dateRangeLabel = `${currentMonthLabel} 01 - ${currentMonthLabel} ${daysInMonth}`;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-[#E5E7EB] bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-black tracking-tight">
              Welcome back, {user?.full_name || "Aravind R"}! 👋
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F0FF] text-indigo-900 border border-[#60A5FA]">
              Student Mode
            </span>
          </div>
          <p className="text-xs text-gray-700 mt-1">
            Here's what's happening in your lab workspace today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student/browse")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white text-xs font-bold transition-all hover:scale-105"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Request Component</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Borrowed Items"
          value={borrowedCount}
          subtitle="Currently borrowed"
          icon={Boxes}
          roleTheme="student"
        />
        <StatCard
          title="Pending Requests"
          value={pendingCount}
          subtitle="Awaiting approval"
          icon={Clock}
          roleTheme="student"
        />
        <StatCard
          title="Approved Requests"
          value={approvedCount}
          subtitle="Approved by faculty"
          icon={CheckCircle2}
          roleTheme="student"
        />
        <StatCard
          title="Return Pending"
          value={returnPendingCount}
          subtitle="Awaiting return"
          icon={RotateCcw}
          roleTheme="student"
        />
      </div>

      {/* Main Grid: Borrowing Chart & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Borrowing Overview Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-black">
                Borrowing Overview (This Month)
              </h3>
              <p className="text-[11px] text-gray-700">
                Total component transactions activity
              </p>
            </div>
            <span className="text-[11px] text-gray-700 font-medium">
              {dateRangeLabel}
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBorrow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B132B",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#FFF",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="borrowings"
                  stroke="#6366F1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorBorrow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Notifications List */}
        <div className="p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
            <h3 className="text-sm font-bold text-black flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-900" /> Recent Notifications
            </h3>
            <button
              onClick={() => navigate("/student/notifications")}
              className="text-[11px] text-blue-900 hover:text-indigo-900 font-semibold"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-700 text-center py-6">
                No recent notifications
              </p>
            ) : (
              notifications.slice(0, 3).map((n) => {
                let borderClass = "border-[#60A5FA]";
                let textClass = "text-blue-900";
                let Icon = Info;
                if (n.type === "success") {
                  borderClass = "border-emerald-500/20";
                  textClass = "text-emerald-900";
                  Icon = CheckCircle2;
                } else if (n.type === "warning") {
                  borderClass = "border-rose-500/20";
                  textClass = "text-rose-450"; // standard text color
                  Icon = AlertCircle;
                }

                return (
                  <div
                    key={n.id}
                    className={`p-3 rounded-2xl bg-white border ${borderClass} text-xs space-y-1`}
                  >
                    <div
                      className={`flex items-center justify-between ${textClass} font-bold`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="capitalize">{n.title}</span>
                      </span>
                      <span className="text-[10px] text-black0 font-mono">
                        {formatTimeOnly(n.created_at)}
                      </span>
                    </div>
                    <p className="text-black text-[11px]">{n.message}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
