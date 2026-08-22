import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { formatTimeOnly } from "../../utils/timestamp";
import { mockEngine } from "../../services/mockEngine";
import { StatCard } from "../../components/common/StatCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  GraduationCap,
  Briefcase,
  Shield,
  Activity,
  Boxes,
  ArrowRight,
  CheckCircle2,
  Clock,
  PlusCircle,
} from "lucide-react";

import { apiRequest } from "../../utils/api";

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [systemOverviewData, setSystemOverviewData] = React.useState<{ day: string; users: number; requests: number }[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = React.useState<boolean>(false);

  const fetchOverview = React.useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    try {
      const response = await apiRequest("/api/admin/system-overview");
      if (response && response.labels) {
        const formatted = response.labels.map((label: string, index: number) => ({
          day: label,
          users: response.users[index] || 0,
          requests: response.requests[index] || 0,
        }));
        setSystemOverviewData(formatted);
        setIsReconnecting(false);
      }
    } catch (err) {
      console.error("Failed to fetch system overview:", err);
      setIsReconnecting(true);
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    fetchOverview(true);

    const interval = setInterval(() => {
      fetchOverview(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchOverview]);

  const stats = mockEngine.getSystemStats();

  const components = mockEngine.getComponents();
  const totalCategories = new Set(components.map((c) => c.category)).size;

  const inventorySummaryDonut = [
    { name: "Available", value: stats.availableStock, color: "#10B981" },
    { name: "Borrowed", value: stats.borrowedStock, color: "#6366F1" },
    { name: "Low Stock", value: stats.lowStockItemsCount, color: "#F59E0B" },
    {
      name: "Out of Stock",
      value: stats.outOfStockItemsCount,
      color: "#EF4444",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-card border border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-black tracking-tight">
              Admin Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-900 border border-gold-500/30">
              System Admin Console
            </span>
          </div>
          <p className="text-xs text-gray-700 mt-1">
            Master system health, user permissions, audit trail, and global
            inventory analytics.
          </p>
        </div>
      </div>

      {/* Stock Metrics Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 shadow-sm hover:shadow-md hover:border-purple-400 hover:border-t-purple-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Total Categories
          </p>
          <h4 className="text-xl font-extrabold text-black">
            {totalCategories}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 shadow-sm hover:shadow-md hover:border-purple-400 hover:border-t-purple-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Total Components
          </p>
          <h4 className="text-xl font-extrabold text-black">
            {stats.totalComponents}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 shadow-sm hover:shadow-md hover:border-purple-400 hover:border-t-purple-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Available Stock
          </p>
          <h4 className="text-xl font-extrabold text-emerald-900">
            {stats.availableStock}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 shadow-sm hover:shadow-md hover:border-purple-400 hover:border-t-purple-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Borrowed Stock
          </p>
          <h4 className="text-xl font-extrabold text-blue-900">
            {stats.borrowedStock}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 shadow-sm hover:shadow-md hover:border-purple-400 hover:border-t-purple-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
          <p className="text-[10px] text-gray-700 font-bold uppercase">
            Low Stock Items
          </p>
          <h4 className="text-xl font-extrabold text-amber-900">
            {stats.lowStockItemsCount}
          </h4>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 shadow-sm hover:shadow-md hover:border-purple-400 hover:border-t-purple-600 transition-all duration-300 hover:-translate-y-0.5 text-center space-y-1">
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
          title="Total Users"
          value={stats.totalUsers}
          subtitle="Registered accounts"
          icon={Users}
          roleTheme="admin"
        />
        <StatCard
          title="Students"
          value={stats.totalStudents}
          subtitle="Active student access"
          icon={GraduationCap}
          roleTheme="admin"
        />
        <StatCard
          title="Faculty"
          value={stats.totalFaculty}
          subtitle="Approved lab supervisors"
          icon={Briefcase}
          roleTheme="admin"
        />
        <StatCard
          title="Admins"
          value={stats.totalAdmins}
          subtitle="Full access administrators"
          icon={Shield}
          roleTheme="admin"
        />
      </div>

      {/* Main Charts Section matching reference preview UI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Overview Multi-Line Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-black">System Overview</h3>
                {isReconnecting && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Database reconnecting...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-700">
                Total active users & component requests growth
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-blue-900">
                <span className="w-2 h-2 rounded-full bg-[#60A5FA]" /> Users
              </span>
              <span className="flex items-center gap-1 text-amber-900">
                <span className="w-2 h-2 rounded-full bg-gold-400" /> Requests
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            {isLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl animate-pulse space-y-2 border border-[#E5E7EB]">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Loading live analytics...</p>
              </div>
            ) : systemOverviewData.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl space-y-1 border border-[#E5E7EB]">
                <p className="text-xs text-gray-500 font-bold">No system analytics data available</p>
                <p className="text-[10px] text-gray-400">Add profiles or requests to populate the chart.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={systemOverviewData}>
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
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#6366F1"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#D4AF37"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Inventory Summary Donut Chart */}
        <div className="p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-black">Inventory Summary</h3>
            <p className="text-[11px] text-gray-700">
              Stock health status distribution
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventorySummaryDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {inventorySummaryDonut.map((entry, index) => (
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
            <div className="flex items-center justify-between text-[11px] text-black">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{" "}
                Total Components
              </span>
              <span className="font-bold text-black">
                {stats.totalComponents}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-black">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />{" "}
                Available
              </span>
              <span className="font-bold text-emerald-900">
                {stats.availableStock}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-black">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]" />{" "}
                Borrowed
              </span>
              <span className="font-bold text-indigo-900">
                {stats.borrowedStock}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-black">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Low
                Stock
              </span>
              <span className="font-bold text-amber-900">
                {stats.lowStockItemsCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-black">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Out of
                Stock
              </span>
              <span className="font-bold text-rose-900">
                {stats.outOfStockItemsCount}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
