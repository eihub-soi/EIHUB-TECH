import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockEngine } from "../../services/mockEngine";
import { generateEnterpriseReportPdf } from "../../utils/pdfGenerator";
import { StatCard } from "../../components/common/StatCard";
import { previewReport, downloadReportCsv, downloadReportSql } from "../../services/reportService";
import { formatTimestamp } from "../../utils/timestamp";
import { sendBrevoReportEmail } from "../../utils/brevoService";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  FileText,
  Download,
  Calendar,
  Sparkles,
  QrCode,
  BarChart3,
  Boxes,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Mail,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
} from "recharts";

const getReportFilename = (
  reportType: string,
  format: "pdf" | "csv" | "sql",
  fromDate?: string,
  toDate?: string
) => {
  const formatDateForName = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (
      isNaN(Number(year)) ||
      isNaN(Number(month)) ||
      isNaN(Number(day)) ||
      year.length !== 4 ||
      month.length !== 2 ||
      day.length !== 2
    ) {
      return "";
    }
    return `${day}-${month}-${year}`;
  };

  const prefix = reportType.includes("Inventory") ? "Inventory_Reports" : "Transaction_Reports";
  const formattedFrom = formatDateForName(fromDate);
  const formattedTo = formatDateForName(toDate);

  const hasValidRange = formattedFrom && formattedTo;
  const suffix = format.toUpperCase();

  if (hasValidRange) {
    return `${prefix}_(${formattedFrom}_to_${formattedTo})_${suffix}.${format}`;
  } else {
    return `${prefix}_${suffix}.${format}`;
  }
};

export const ReportsAnalytics: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reportType, setReportType] = useState("Inventory Report");
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportCsv, setExportCsv] = useState(true);
  const [exportPdf, setExportPdf] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const [rawComponents, setRawComponents] = useState<any[]>([]);
  const [rawRequests, setRawRequests] = useState<any[]>([]);

  useEscapeKey(() => setIsExportModalOpen(false), isExportModalOpen);

  React.useEffect(() => {
    setRawComponents(mockEngine.getComponents());
    setRawRequests(mockEngine.getRequests());

    mockEngine.syncWithD1();

    const unsubscribe = mockEngine.subscribe(() => {
      setRawComponents(mockEngine.getComponents());
      setRawRequests(mockEngine.getRequests());
    });
    return unsubscribe;
  }, []);

  const filterByDate = (items: any[], dateField: string) => {
    if (!appliedFromDate && !appliedToDate) return items;
    return items.filter((item) => {
      const val = item[dateField];
      if (!val) return false;
      const itemDate = new Date(val);
      if (isNaN(itemDate.getTime())) return false;

      if (appliedFromDate) {
        const from = new Date(appliedFromDate);
        from.setHours(0, 0, 0, 0);
        if (itemDate < from) return false;
      }
      if (appliedToDate) {
        const to = new Date(appliedToDate);
        to.setHours(23, 59, 59, 999);
        if (itemDate > to) return false;
      }
      return true;
    });
  };

  const filteredComps = filterByDate(rawComponents, "created_at");
  const requests = filterByDate(rawRequests, "requested_at");

  const components = filteredComps.map((c) => {
    const activeBorrowedQty = requests
      .filter(
        (r) =>
          r.component_id === c.id &&
          r.status === "approved" &&
          !r.returned_at,
      )
      .reduce((acc, r) => acc + r.quantity, 0);

    return {
      ...c,
      borrowed_stock: activeBorrowedQty,
      available_stock: Math.max(0, c.total_stock - activeBorrowedQty),
    };
  });

  const getDateRangeText = () => {
    if (!appliedFromDate && !appliedToDate) return "All Time (First to Latest)";
    const formatDt = (d: string) => {
      const dt = new Date(d);
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
        .format(dt)
        .replace(/ /g, " "); // Force exact match format if needed, Intl handles '01 Aug 2026'
    };
    if (appliedFromDate && appliedToDate) {
      return `${formatDt(appliedFromDate)} – ${formatDt(appliedToDate)}`;
    } else if (appliedFromDate) {
      return `From ${formatDt(appliedFromDate)}`;
    } else {
      return `Until ${formatDt(appliedToDate)}`;
    }
  };
  const dateRangeText = getDateRangeText();

  // stats overridden below

  const totalCategories = new Set(components.map((c) => c.category)).size;
  const totalUnits = components.reduce((acc, c) => acc + c.total_stock, 0);
  const availableUnits = components.reduce(
    (acc, c) => acc + c.available_stock,
    0,
  );
  const borrowedUnits = components.reduce(
    (acc, c) => acc + c.borrowed_stock,
    0,
  );
  const lowStockCount = components.filter(
    (c) => c.available_stock > 0 && c.available_stock <= 5,
  ).length;
  const outOfStockCount = components.filter(
    (c) => c.available_stock === 0,
  ).length;

  const stats = {
    ...mockEngine.getSystemStats(),
    totalComponents: totalUnits,
    availableStock: availableUnits,
    borrowedStock: borrowedUnits,
  };

  const handleExportPdf = async () => {
    toast.info("Generating PDF report...");
    try {
      const filters = {
        from_date: appliedFromDate,
        to_date: appliedToDate,
      };
      const apiReportType = reportType === "Transaction Report" ? "Transaction Log" : reportType;
      const url = await previewReport(apiReportType, filters);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = getReportFilename(reportType, "pdf", appliedFromDate, appliedToDate);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Generated & downloaded ${reportType} PDF!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF report.");
    }
  };

  const handleEmailSelected = () => {
    if (!user) {
      toast.error("You must be logged in to email reports.");
      return;
    }
    if (!exportCsv && !exportPdf) {
      toast.error("Please select at least one format to email.");
      return;
    }
    const rolePath = user.role === "admin" ? "admin" : "faculty";
    setIsExportModalOpen(false);
    navigate(
      `/${rolePath}/reports/email?reportType=${reportType}&from_date=${appliedFromDate}&to_date=${appliedToDate}&attach_pdf=${exportPdf ? "1" : "0"}&attach_csv=${exportCsv ? "1" : "0"}&attach_sql=0`
    );
  };



  // Calculate category distribution dynamically
  const categoryMap: { [key: string]: number } = {};
  components.forEach((c) => {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + c.total_stock;
  });

  const totalCategoryStock = Object.values(categoryMap).reduce(
    (acc, val) => acc + val,
    0,
  );
  const COLORS = [
    "#6366F1",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#EC4899",
    "#8B5CF6",
    "#06B6D4",
  ];

  const categoryChartData = Object.entries(categoryMap).map(
    ([name, value], index) => {
      const percentage =
        totalCategoryStock > 0
          ? ((value / totalCategoryStock) * 100).toFixed(1)
          : "0.0";
      return {
        name,
        value,
        percentage,
        color: COLORS[index % COLORS.length],
      };
    },
  );

  const handleExportCsv = async () => {
    toast.info("Generating CSV report...");
    try {
      const filters = {
        from_date: appliedFromDate,
        to_date: appliedToDate,
      };
      const url = await downloadReportCsv(reportType, filters);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        getReportFilename(reportType, "csv", appliedFromDate, appliedToDate),
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${reportType} CSV successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export CSV.");
    }
  };

  const handleExportSql = async () => {
    toast.info("Generating SQL report...");
    try {
      const filters = {
        from_date: appliedFromDate,
        to_date: appliedToDate,
      };
      const url = await downloadReportSql(reportType, filters);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        getReportFilename(reportType, "sql", appliedFromDate, appliedToDate),
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${reportType} SQL successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export SQL.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-black tracking-tight">
          Reports & Analytics
        </h1>
        <p className="text-xs text-gray-700 mt-0.5">
          Generate formal institutional inventory reports and QR-verified
          documentation
        </p>
      </div>

      {/* Report Filter Controls */}
      <div className="p-4 rounded-3xl glass-card border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <label className="block text-[10px] text-gray-700 font-bold uppercase mb-1">
            Select Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl glass-input text-xs font-semibold text-black min-w-[220px]"
          >
            <option value="Inventory Report">Inventory Report</option>
            <option value="Transaction Report">Transaction Report</option>
            <option value="Department Report">Department Report</option>
            <option value="Faculty Report">Faculty Report</option>
            <option value="Usage Report">Usage Report</option>
          </select>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] text-gray-700 font-bold uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl glass-input text-xs font-semibold text-black"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-700 font-bold uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl glass-input text-xs font-semibold text-black"
            />
          </div>
          <button
            onClick={() => {
              if (!fromDate && !toDate) {
                setAppliedFromDate("");
                setAppliedToDate("");
                toast.error("Date not selected. Please select From Date and To Date.");
                return;
              }
              if (!fromDate || !toDate) {
                toast.error("Please select both From Date and To Date.");
                return;
              }
              if (new Date(fromDate) > new Date(toDate)) {
                toast.error("From date cannot be after To date.");
                return;
              }
              setAppliedFromDate(fromDate);
              setAppliedToDate(toDate);
              toast.success("Date filter applied.");
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
              setAppliedFromDate("");
              setAppliedToDate("");
              toast.info("Date filter reset.");
            }}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full justify-end mt-4 md:mt-0 md:w-auto">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all hover:scale-105 focus:outline-none"
          >
            <FileText className="w-4 h-4 text-white" /> Download PDF
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all hover:scale-105 focus:outline-none"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" /> Download CSV
          </button>
          <button
            onClick={handleExportSql}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all hover:scale-105 focus:outline-none"
          >
            <FileCode className="w-4 h-4 text-white" /> Download SQL
          </button>
          <button
            onClick={() => {
              setExportCsv(true);
              setExportPdf(true);
              setIsExportModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-all hover:scale-105 focus:outline-none"
          >
            <Mail className="w-4 h-4 text-white" /> Email PDF Report
          </button>
        </div>
      </div>

      {/* Styled PDF Preview Card */}
      <div className="p-8 rounded-3xl glass-card border border-white/15 space-y-8 max-w-5xl mx-auto bg-gradient-to-b from-slate-900/90 to-slate-950/90">
        {/* PDF Header Branding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E7EB] pb-6 gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="EI HUB Logo"
              className="w-14 h-14 rounded-2xl object-contain bg-white p-1"
            />
            <div>
              <h2 className="text-xl font-black tracking-tight text-black">
                EI HUB
              </h2>
              <p className="text-xs text-indigo-900 font-bold">
                KGISL Institute of Technology - School of Innovation
              </p>
              <p className="text-[11px] text-gray-700 font-semibold uppercase tracking-wider mt-0.5">
                {reportType.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold-500/20 text-amber-900 border border-gold-500/30">
              OFFICIAL DOCUMENT
            </span>
          </div>
        </div>

        {/* Realtime KPI Boxes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] text-center space-y-1">
            <p className="text-[10px] text-gray-700 font-bold uppercase">
              Total Categories
            </p>
            <h4 className="text-xl font-extrabold text-black">
              {totalCategories}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] text-center space-y-1">
            <p className="text-[10px] text-gray-700 font-bold uppercase">
              Total Components
            </p>
            <h4 className="text-xl font-extrabold text-black">{totalUnits}</h4>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-500/20 text-center space-y-1">
            <p className="text-[10px] text-gray-700 font-bold uppercase">
              Available Stock
            </p>
            <h4 className="text-xl font-extrabold text-emerald-900">
              {availableUnits}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#60A5FA] text-center space-y-1">
            <p className="text-[10px] text-gray-700 font-bold uppercase">
              Borrowed Stock
            </p>
            <h4 className="text-xl font-extrabold text-indigo-900">
              {borrowedUnits}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-amber-500/20 text-center space-y-1">
            <p className="text-[10px] text-gray-700 font-bold uppercase">
              Low Stock Items
            </p>
            <h4 className="text-xl font-extrabold text-amber-900">
              {lowStockCount}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-rose-500/20 text-center space-y-1">
            <p className="text-[10px] text-gray-700 font-bold uppercase">
              Out of Stock Items
            </p>
            <h4 className="text-xl font-extrabold text-rose-900">
              {outOfStockCount}
            </h4>
          </div>
        </div>

        {/* Category Distribution Chart Section */}
        <div className="border-t border-[#E5E7EB] pt-6 space-y-4">
          <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
            Category Stock Distribution
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Doughnut Chart */}
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    contentStyle={{
                      backgroundColor: "#0B132B",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#FFF",
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${value} units (${props.payload.percentage}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart Legend with Percentages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {categoryChartData.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-2xl bg-white border border-white/5 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-bold text-black truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-[10px] text-gray-700 font-semibold">
                      {item.value} units
                    </span>
                    <span className="text-xs font-extrabold text-black">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Metadata & Embedded QR verification */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#E5E7EB] pt-6 text-xs text-gray-700 gap-4">
          <div>
            <p>
              <span className="font-bold text-black">Generated By:</span> EI HUB
              Institutional Engine
            </p>
            <p>
              <span className="font-bold text-black">Generated On:</span>{" "}
              {formatTimestamp(new Date())}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0">
              <QrCode className="w-10 h-10 text-slate-950" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-black">QR VERIFIED</p>
              <p className="text-[9px] text-gray-700">
                Scan to verify institutional authenticity
              </p>
            </div>
          </div>
        </div>
      </div>
        {/* Export / Email Selection Modal */}
        {/* Email Selection Modal */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] max-w-md w-full p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
              <div>
                <h2 className="text-xl font-black text-black">Select Report Attachments</h2>
                <p className="text-xs text-gray-500 font-semibold mt-1">Select report formats to attach to your email</p>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-[#E5E7EB]">
                {/* Select All */}
                <label className="flex items-center gap-3 cursor-pointer pb-2 border-b border-dashed border-gray-200">
                  <input
                     type="checkbox"
                     checked={exportCsv && exportPdf}
                     onChange={(e) => {
                       const checked = e.target.checked;
                       setExportCsv(checked);
                       setExportPdf(checked);
                     }}
                     className="w-4 h-4 rounded text-blue-600 bg-white border-[#E5E7EB] focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-black">Select All Formats</span>
                </label>

                {/* PDF */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportPdf}
                    onChange={(e) => setExportPdf(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-white border-[#E5E7EB] focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-black flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-red-500" /> PDF Report
                  </span>
                </label>

                {/* CSV */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportCsv}
                    onChange={(e) => setExportCsv(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-white border-[#E5E7EB] focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-black flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> CSV Report
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmailSelected}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    );
  };
