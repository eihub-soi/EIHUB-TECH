import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { mockEngine } from "../../services/mockEngine";
import { StatCard } from "../../components/common/StatCard";
import { BorrowRequest } from "../../types";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Clock,
  RotateCcw,
  Boxes,
  AlertTriangle,
} from "lucide-react";

// Helper to get daily Requests Overview for the current month
const getRequestsOverviewData = (requests: BorrowRequest[]) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = monthNames[month];
  
  const data = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${monthLabel} ${d < 10 ? '0' + d : d}`;
    
    const dailyReqs = requests.filter((r) => {
      const reqDate = new Date(r.requested_at);
      return (
        reqDate.getDate() === d &&
        reqDate.getMonth() === month &&
        reqDate.getFullYear() === year
      );
    });
    
    const pending = dailyReqs.filter((r) => r.status === "pending").length;
    const approved = dailyReqs.filter((r) => r.status === "approved").length;
    const rejected = dailyReqs.filter((r) => r.status === "rejected").length;
    
    data.push({
      day: dayStr,
      pending,
      approved,
      rejected,
    });
  }
  return data;
};

// Helper to get Top Requested Components distribution
const getTopComponentsData = (requests: BorrowRequest[]) => {
  const counts: { [key: string]: number } = {};
  let total = 0;
  
  requests.forEach((r) => {
    if (r.component_name) {
      counts[r.component_name] = (counts[r.component_name] || 0) + r.quantity;
      total += r.quantity;
    }
  });
  
  if (total === 0) {
    return [
      { name: "No data", value: 100, color: "#E5E7EB" }
    ];
  }
  
  const sorted = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  
  const top4 = sorted.slice(0, 4);
  const othersValue = sorted.slice(4).reduce((acc, c) => acc + c.value, 0);
  
  const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#3B82F6", "#EC4899"];
  
  const data = top4.map((item, index) => {
    const percentage = Math.round((item.value / total) * 100);
    return {
      name: item.name,
      value: percentage,
      color: COLORS[index],
    };
  });
  
  if (othersValue > 0) {
    const percentage = Math.round((othersValue / total) * 100);
    data.push({
      name: "Others",
      value: percentage,
      color: COLORS[4],
    });
  }
  
  return data;
};

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<BorrowRequest[]>([]);

  useEffect(() => {
    mockEngine.syncWithD1();

    const unsubscribe = mockEngine.subscribe(() => {
      setRequests(mockEngine.getRequests());
    });
    return unsubscribe;
  }, []);

  const pendingRequests = requests.filter((r) => r.status === "pending");

  const stats = mockEngine.getSystemStats();
  const components = mockEngine.getComponents();
  const totalCategories = new Set(components.map((c) => c.category)).size;

  const handleApprove = (reqId: string) => {
    const remark = prompt(
      "Enter approval remark/notes (optional):",
      "Approved for project use",
    );
    if (remark === null) return;
    try {
      mockEngine.approveBorrowRequest(
        reqId,
        user?.id || "usr-faculty-1",
        remark,
      );
      toast.success("Request approved successfully!");
      setRequests(mockEngine.getRequests());
    } catch (err: any) {
      toast.error(err.message || "Failed to approve request");
    }
  };

  const handleReject = (reqId: string) => {
    const reason = prompt(
      "Enter rejection reason for student:",
      "Stock allocated for advanced lab session",
    );
    if (reason !== null) {
      try {
        mockEngine.rejectBorrowRequest(
          reqId,
          user?.id || "usr-faculty-1",
          reason,
        );
        toast.success("Request rejected.");
        setRequests(mockEngine.getRequests());
      } catch (err: any) {
        toast.error(err.message || "Failed to reject request");
      }
    }
  };

  const requestsOverviewData = getRequestsOverviewData(requests);
  const topComponentsData = getTopComponentsData(requests);

  return (
    <div className="space-y-6">
      {/* Faculty Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-black tracking-tight">
              Faculty Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-900 border border-emerald-500/30">
              Executive Mode
            </span>
          </div>
          <p className="text-xs text-gray-700 mt-1">
            Review student component requests, inventory levels, and return
            queues.
          </p>
        </div>
      </div>

      {/* Stock Metrics Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 shadow-sm hover:shadow-md hover:border-green-400 hover:border-t-green-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Total Categories
          </p>
          <h4 className="text-xl font-extrabold text-black">
            {totalCategories}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 shadow-sm hover:shadow-md hover:border-green-400 hover:border-t-green-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Total Components
          </p>
          <h4 className="text-xl font-extrabold text-black">
            {stats.totalComponents}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 shadow-sm hover:shadow-md hover:border-green-400 hover:border-t-green-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Available Stock
          </p>
          <h4 className="text-xl font-extrabold text-emerald-900">
            {stats.availableStock}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 shadow-sm hover:shadow-md hover:border-green-400 hover:border-t-green-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Borrowed Stock
          </p>
          <h4 className="text-xl font-extrabold text-blue-900">
            {stats.borrowedStock}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 shadow-sm hover:shadow-md hover:border-green-400 hover:border-t-green-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Low Stock Items
          </p>
          <h4 className="text-xl font-extrabold text-amber-900">
            {stats.lowStockItemsCount}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 shadow-sm hover:shadow-md hover:border-green-400 hover:border-t-green-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Out of Stock Items
          </p>
          <h4 className="text-xl font-extrabold text-rose-900">
            {stats.outOfStockItemsCount}
          </h4>
        </div>
      </div>

      {/* KPI Cards Grid matching reference UI preview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Requests"
          value={pendingRequests.length}
          subtitle="Approval queue"
          icon={Clock}
          roleTheme="faculty"
        />
        <StatCard
          title="Return Requests"
          value={stats.pendingReturnsCount}
          subtitle="Awaiting inspection"
          icon={RotateCcw}
          roleTheme="faculty"
        />
        <StatCard
          title="Active Loans"
          value={stats.activeLoansCount}
          subtitle="Issued to students"
          icon={Boxes}
          roleTheme="faculty"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockItemsCount}
          subtitle="Restock required"
          icon={AlertTriangle}
          roleTheme="faculty"
        />
      </div>

      {/* Analytics Charts Grid matching preview UI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests Overview Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-black">
                Requests Overview
              </h3>
              <p className="text-[11px] text-gray-700">
                Daily breakdown of student requests by status
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-amber-900">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Pending
              </span>
              <span className="flex items-center gap-1 text-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                Approved
              </span>
              <span className="flex items-center gap-1 text-rose-900">
                <span className="w-2 h-2 rounded-full bg-rose-400" /> Rejected
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={requestsOverviewData}>
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
                <Bar dataKey="pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Requested Components Pie Chart */}
        <div className="p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-black">
              Top Requested Components
            </h3>
            <p className="text-[11px] text-gray-700">
              Distribution by hardware type
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topComponentsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topComponentsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0B132B",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#FFF",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs pt-2">
            {topComponentsData.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-black font-medium">{c.name}</span>
                </div>
                <span className="font-bold text-black">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
