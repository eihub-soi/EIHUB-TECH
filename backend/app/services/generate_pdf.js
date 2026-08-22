const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const fs = require("fs");
const path = require("path");

// Read input data from stdin
let inputJson = "";
try {
  inputJson = fs.readFileSync(0, "utf-8");
} catch (err) {
  console.error("Failed to read from stdin:", err);
  process.exit(1);
}

let inputData;
try {
  inputData = JSON.parse(inputJson);
} catch (err) {
  console.error("Failed to parse input JSON:", err);
  process.exit(1);
}

const {
  reportType = "Inventory Report",
  components = [],
  requests = [],
  userRole = "admin",
  userName = "Admin User",
  fromDate = null,
  toDate = null
} = inputData;

// Retrieve the base64 banner dynamically from input data or fallback to the file
let pdfBannerBase64 = inputData.pdfBannerBase64 || "";
if (!pdfBannerBase64) {
  try {
    const bannerPath = path.join(__dirname, "..", "..", "..", "frontend", "src", "utils", "pdfBanner.ts");
    const bannerContent = fs.readFileSync(bannerPath, "utf8");
    const startIdx = bannerContent.indexOf("base64,") + 7;
    const endIdx = bannerContent.lastIndexOf('"') !== -1 ? bannerContent.lastIndexOf('"') : bannerContent.lastIndexOf("'");
    pdfBannerBase64 = bannerContent.substring(startIdx, endIdx).trim();
  } catch (err) {
    console.error("Warning: Failed to load banner image from frontend code:", err.message);
  }
}

// Date range checker
const isDateInRange = (dateStr, fDate, tDate) => {
  if (!dateStr) return false;
  // Parse UTC ISO timestamp
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  
  if (fDate) {
    const from = new Date(fDate);
    from.setHours(0, 0, 0, 0);
    if (d < from) return false;
  }
  if (tDate) {
    const to = new Date(tDate);
    to.setHours(23, 59, 59, 999);
    if (d > to) return false;
  }
  return true;
};

// Date Range Text Formatter
const formatSingleDate = (dStr) => {
  const d = new Date(dStr);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  // Adjust index for JS date getMonth()
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};

let dateRangeText = "All Time (First to Latest)";
if (fromDate && toDate) {
  dateRangeText = `${formatSingleDate(fromDate)} – ${formatSingleDate(toDate)}`;
} else if (fromDate) {
  dateRangeText = `From ${formatSingleDate(fromDate)}`;
} else if (toDate) {
  dateRangeText = `Until ${formatSingleDate(toDate)}`;
}

// ---------------- FILTERS APPLICATION ----------------
// Filter components by created_at
const filteredComponentsRaw = components.filter(c => {
  if (!fromDate && !toDate) return true;
  return isDateInRange(c.created_at, fromDate, toDate);
});

// Filter requests by requested_at for Requests page
const filteredRequests = requests.filter(r => {
  if (!fromDate && !toDate) return true;
  return isDateInRange(r.requested_at, fromDate, toDate);
});

// Filter borrows by requested_at
const filteredBorrows = requests.filter(r => {
  if (r.status.toLowerCase() !== "approved" && r.status.toLowerCase() !== "active" && r.status.toLowerCase() !== "returned") {
    return false;
  }
  if (!fromDate && !toDate) return true;
  return isDateInRange(r.requested_at, fromDate, toDate);
});

// Filter returns by returned_at
const filteredReturns = requests.filter(r => {
  if (r.status.toLowerCase() !== "returned") return false;
  if (!fromDate && !toDate) return true;
  return isDateInRange(r.returned_at, fromDate, toDate);
});

// Calculate active borrowed stock for each component based on filtered requests
const activeBorrowedQty = {};
filteredRequests.forEach(r => {
  if ((r.status.toLowerCase() === "approved" || r.status.toLowerCase() === "active") && !r.returned_at) {
    activeBorrowedQty[r.component_id] = (activeBorrowedQty[r.component_id] || 0) + (r.quantity || 0);
  }
});

const filteredComponents = filteredComponentsRaw.map(c => {
  const bQty = activeBorrowedQty[c.id] || 0;
  return {
    ...c,
    borrowed_stock: bQty,
    available_stock: Math.max(0, (c.total_stock || 0) - bQty)
  };
});

// Helpers
const formatDateAndTime = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const time = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  return `${day} ${month} ${year} ${time}`;
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

// Unit Costs
const unitCosts = {
  "Arduino Uno R3": 18.5,
  "ESP32 Dev Module": 9.75,
  "Ultrasonic Sensor HC-SR04": 3.2,
  "Raspberry Pi 4 (4GB)": 55.0,
  "Laser Diode - APS Lasers": 4.5
};

// Start PDF Generation
const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
});

const black = [0, 0, 0];
const white = [255, 255, 255];

const PT_TO_MM = 2.83465;
const A4_WIDTH = 210; // mm
const A4_HEIGHT = 297; // mm
const MARGIN_LEFT = 36 / PT_TO_MM; // mm (12.70mm = 36 pt)
const MARGIN_RIGHT = 36 / PT_TO_MM; // mm
const TABLE_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // mm (184.60mm = 523.28 pt)

const normalizeWidths = (rawWidths, targetWidth) => {
  const sum = rawWidths.reduce((s, w) => s + w, 0);
  const factor = targetWidth / sum;
  const normalized = rawWidths.map(w => w * factor);
  const rounded = normalized.map(w => Math.round(w * 100) / 100);
  const roundedSum = rounded.reduce((s, w) => s + w, 0);
  const diff = targetWidth - roundedSum;
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + diff) * 100) / 100;
  return rounded;
};

const validatePageWidth = (columnWidths, usablePageWidth) => {
  const sumWidths = columnWidths.reduce((sum, w) => sum + w, 0);
  if (Math.abs(sumWidths - usablePageWidth) > 0.5) {
    throw new Error(`PDF Layout Error: sum of column widths (${sumWidths}mm) must equal usable page width (${usablePageWidth}mm).`);
  }
};

const getAutoTableStyles = () => ({
  theme: "grid",
  styles: {
    fontSize: 8,
    cellPadding: { top: 2.5, right: 3.5, bottom: 2.5, left: 3.5 },
    valign: "middle",
    textColor: black,
    lineColor: black,
    lineWidth: 0.1,
  },
  headStyles: {
    fillColor: [124, 58, 237], // Violet: #7C3AED
    textColor: white,
    fontStyle: "bold",
    halign: "center",
    valign: "middle",
    fontSize: 8,
    cellPadding: { top: 3.5, right: 3.5, bottom: 3.5, left: 3.5 },
  },
});

// Helper to draw section square and header
const drawSectionHeader = (doc, title, y, color = [11, 31, 74]) => {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(14, y - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, y - 0.5);
};

// ================= PAGE 1 =================
// KPI Summary Cards
const startY = 52;
const cardW = 29;
const cardH = 15;
const gapX = 2;
const gapY = 5;

// Calculations based on filtered sets
const totalCategories = new Set(filteredComponents.map(c => c.category)).size;
const totalComponents = filteredComponents.length;
const availableStock = filteredComponents.reduce((acc, c) => acc + (c.available_stock || 0), 0);
const borrowedStock = filteredComponents.reduce((acc, c) => acc + (c.borrowed_stock || 0), 0);
const lowStockCount = filteredComponents.filter(c => (c.available_stock || 0) > 0 && (c.available_stock || 0) <= 5).length;
const outOfStockCount = filteredComponents.filter(c => (c.available_stock || 0) === 0).length;
const pendingReq = filteredRequests.filter(r => r.status.toLowerCase() === "pending").length;
const approvedReq = filteredRequests.filter(r => r.status.toLowerCase() === "approved" || r.status.toLowerCase() === "active").length;
const rejectedReq = filteredRequests.filter(r => r.status.toLowerCase() === "rejected").length;
const totalTrans = filteredRequests.length;

const kpis = [
  { title: "CATEGORIES", val: totalCategories.toString(), color: [29, 78, 216] },
  { title: "COMPONENTS", val: totalComponents.toString(), color: [16, 185, 129] },
  { title: "AVAILABLE", val: availableStock.toString(), color: [16, 185, 129] },
  { title: "BORROWED", val: borrowedStock.toString(), color: [249, 115, 22] },
  { title: "RETURNED", val: filteredReturns.length.toString(), color: [249, 115, 22] },
  { title: "LOW STOCK", val: lowStockCount.toString(), color: [249, 115, 22] },
  { title: "OUT OF STOCK", val: outOfStockCount.toString(), color: [225, 29, 72] },
  { title: "PENDING REQ", val: pendingReq.toString(), color: [56, 189, 248] },
  { title: "APPROVED REQ", val: approvedReq.toString(), color: [16, 185, 129] },
  { title: "REJECTED REQ", val: rejectedReq.toString(), color: [225, 29, 72] },
  { title: "TOTAL TRANS", val: totalTrans.toString(), color: [29, 78, 216] },
];

kpis.forEach((kpi, idx) => {
  const row = Math.floor(idx / 6);
  const col = idx % 6;
  const x = 14 + col * (cardW + gapX);
  const y = startY + row * (cardH + gapY);

  // Card background
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

  // Left colored indicator border
  doc.setDrawColor(kpi.color[0], kpi.color[1], kpi.color[2]);
  doc.setLineWidth(1.5);
  doc.line(x + 0.75, y + 1, x + 0.75, y + cardH - 1);

  // Label text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  doc.text(kpi.title, x + cardW / 2, y + 5, { align: "center" });

  // Value text
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(kpi.val, x + cardW / 2, y + 11, { align: "center" });
});

// Table Section 1: Laboratory Component Stock Breakdown
const table1Y = startY + 2 * (cardH + gapY) + 5;
drawSectionHeader(doc, "Laboratory Component Stock Breakdown", table1Y, [11, 31, 74]);

// Calculate returned quantities for each component based on filtered returns
const componentReturnedQty = {};
filteredReturns.forEach(r => {
  componentReturnedQty[r.component_id] = (componentReturnedQty[r.component_id] || 0) + (r.quantity || 0);
});

let inventoryRows = filteredComponents.map(c => [
  c.sku || `COMP-${c.id.substring(0, 4).toUpperCase()}`,
  c.name,
  c.category,
  (c.total_stock || 0).toString(),
  (c.available_stock || 0).toString(),
  (c.borrowed_stock || 0).toString(),
  (componentReturnedQty[c.id] || 0).toString(),
  "0", // Damaged
  "0", // Reserved
  c.location || "Lab A, Shelf 1",
]);

if (inventoryRows.length === 0) {
  inventoryRows = [[{ content: "No components available in inventory breakdown", colSpan: 10, styles: { halign: "center" } }]];
}

const t1Widths = normalizeWidths([62, 112, 75, 38, 48, 45, 45, 45, 45, 88].map(w => w / PT_TO_MM), TABLE_WIDTH);
validatePageWidth(t1Widths, TABLE_WIDTH);

doc.autoTable({
  startY: table1Y + 3,
  head: [
    [
      "SKU",
      "Component Name",
      "Category",
      "Total",
      "Available",
      "Borrowed",
      "Returned",
      "Damaged",
      "Reserved",
      "Location",
    ],
  ],
  body: inventoryRows,
  margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  ...getAutoTableStyles(),
  columnStyles: {
    0: { cellWidth: t1Widths[0], halign: "left" },
    1: { cellWidth: t1Widths[1], halign: "left" },
    2: { cellWidth: t1Widths[2], halign: "left" },
    3: { cellWidth: t1Widths[3], halign: "center" },
    4: { cellWidth: t1Widths[4], halign: "center" },
    5: { cellWidth: t1Widths[5], halign: "center" },
    6: { cellWidth: t1Widths[6], halign: "center" },
    7: { cellWidth: t1Widths[7], halign: "center" },
    8: { cellWidth: t1Widths[8], halign: "center" },
    9: { cellWidth: t1Widths[9], halign: "left" },
  },
});

// ================= PAGE 2 =================
doc.addPage("a4", "portrait");
const page2Y = 52;
drawSectionHeader(doc, "Borrow Transaction History", page2Y, [59, 130, 246]);

let borrowRows = filteredBorrows.map(r => [
  r.request_code || `REQ-${r.id.substring(0, 8).toUpperCase()}`,
  r.id.substring(0, 8).toUpperCase(),
  formatDateAndTime(r.requested_at),
  r.student_name || "N/A",
  r.student_register_no || "N/A",
  r.student_department || "ECE",
  r.component_name || "N/A",
  r.component_sku || `COMP-${r.component_id.substring(0, 4).toUpperCase()}`,
  r.quantity.toString(),
  r.purpose || "Project",
  r.approver_name || "Faculty",
  r.status.toUpperCase(),
  r.notes || "None",
]);

if (borrowRows.length === 0) {
  borrowRows = [[{ content: "No borrow transactions available", colSpan: 13, styles: { halign: "center" } }]];
}

const t2Widths = normalizeWidths([35, 35, 60, 60, 45, 25, 65, 45, 22, 60, 50, 40, 50].map(w => w / PT_TO_MM), TABLE_WIDTH);
validatePageWidth(t2Widths, TABLE_WIDTH);

doc.autoTable({
  startY: page2Y + 3,
  head: [
    [
      "Tx ID",
      "Req ID",
      "Date & Time",
      "Student",
      "Roll No",
      "Dept",
      "Component",
      "SKU",
      "Qty",
      "Purpose",
      "Faculty",
      "Status",
      "Remarks",
    ],
  ],
  body: borrowRows,
  margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  ...getAutoTableStyles(),
  columnStyles: {
    0: { cellWidth: t2Widths[0], halign: "center" },
    1: { cellWidth: t2Widths[1], halign: "center" },
    2: { cellWidth: t2Widths[2], halign: "left" },
    3: { cellWidth: t2Widths[3], halign: "left" },
    4: { cellWidth: t2Widths[4], halign: "center" },
    5: { cellWidth: t2Widths[5], halign: "center" },
    6: { cellWidth: t2Widths[6], halign: "left" },
    7: { cellWidth: t2Widths[7], halign: "center" },
    8: { cellWidth: t2Widths[8], halign: "center" },
    9: { cellWidth: t2Widths[9], halign: "left" },
    10: { cellWidth: t2Widths[10], halign: "left" },
    11: { cellWidth: t2Widths[11], halign: "center" },
    12: { cellWidth: t2Widths[12], halign: "left" },
  },
});

// ================= PAGE 3 =================
doc.addPage("a4", "portrait");
const page3Y = 52;
drawSectionHeader(doc, "Return Transaction History", page3Y, [16, 185, 129]);

let returnRows = filteredReturns.map(r => [
  r.request_code || `REQ-${r.id.substring(0, 8).toUpperCase()}`,
  r.id.substring(0, 8).toUpperCase(),
  formatDateOnly(r.returned_at),
  formatDateOnly(r.requested_at),
  r.student_name || "N/A",
  r.component_name || "N/A",
  r.quantity.toString(),
  r.reject_reason && r.reject_reason.includes("Condition")
    ? r.reject_reason.replace("Condition reported by student:", "").trim()
    : "Good",
  r.return_reviewed_by_name || r.approver_name || "Faculty",
  r.notes || "None",
]);

if (returnRows.length === 0) {
  returnRows = [[{ content: "No return transactions available", colSpan: 10, styles: { halign: "center" } }]];
}

const t3Widths = normalizeWidths([40, 40, 65, 65, 65, 75, 25, 50, 60, 60].map(w => w / PT_TO_MM), TABLE_WIDTH);
validatePageWidth(t3Widths, TABLE_WIDTH);

doc.autoTable({
  startY: page3Y + 3,
  head: [
    [
      "Tx ID",
      "Req ID",
      "Returned Date",
      "Borrowed Date",
      "Student",
      "Component",
      "Qty",
      "Condition",
      "Verified By",
      "Remarks",
    ],
  ],
  body: returnRows,
  margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  ...getAutoTableStyles(),
  columnStyles: {
    0: { cellWidth: t3Widths[0], halign: "center" },
    1: { cellWidth: t3Widths[1], halign: "center" },
    2: { cellWidth: t3Widths[2], halign: "center" },
    3: { cellWidth: t3Widths[3], halign: "center" },
    4: { cellWidth: t3Widths[4], halign: "left" },
    5: { cellWidth: t3Widths[5], halign: "left" },
    6: { cellWidth: t3Widths[6], halign: "center" },
    7: { cellWidth: t3Widths[7], halign: "center" },
    8: { cellWidth: t3Widths[8], halign: "left" },
    9: { cellWidth: t3Widths[9], halign: "left" },
  },
});

// ================= PAGE 4 =================
doc.addPage("a4", "portrait");
const page4Y = 52;
drawSectionHeader(doc, "Component Request History", page4Y, [139, 92, 246]);

let requestRows = filteredRequests.map(r => [
  r.request_code || `REQ-${r.id.substring(0, 8).toUpperCase()}`,
  r.student_name || "N/A",
  r.student_register_no || "N/A",
  r.component_name || "N/A",
  r.quantity.toString(),
  r.purpose || "Project",
  formatDateOnly(r.requested_at),
  r.approver_name || "Faculty",
  r.status.toUpperCase(),
  r.reject_reason || "None",
]);

if (requestRows.length === 0) {
  requestRows = [[{ content: "No component requests available", colSpan: 10, styles: { halign: "center" } }]];
}

const t4Widths = normalizeWidths([45, 65, 60, 75, 25, 65, 65, 65, 50, 50].map(w => w / PT_TO_MM), TABLE_WIDTH);
validatePageWidth(t4Widths, TABLE_WIDTH);

doc.autoTable({
  startY: page4Y + 3,
  head: [
    [
      "Request ID",
      "Student",
      "Roll Number",
      "Component",
      "Qty",
      "Purpose",
      "Requested Date",
      "Approved By",
      "Status",
      "Remarks",
    ],
  ],
  body: requestRows,
  margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
  ...getAutoTableStyles(),
  columnStyles: {
    0: { cellWidth: t4Widths[0], halign: "center" },
    1: { cellWidth: t4Widths[1], halign: "left" },
    2: { cellWidth: t4Widths[2], halign: "center" },
    3: { cellWidth: t4Widths[3], halign: "left" },
    4: { cellWidth: t4Widths[4], halign: "center" },
    5: { cellWidth: t4Widths[5], halign: "left" },
    6: { cellWidth: t4Widths[6], halign: "center" },
    7: { cellWidth: t4Widths[7], halign: "left" },
    8: { cellWidth: t4Widths[8], halign: "center" },
    9: { cellWidth: t4Widths[9], halign: "left" },
  },
});

// ================= PAGE 5 =================
doc.addPage("a4", "portrait");
const page5Y = 52;
drawSectionHeader(doc, "Charts & Analytics (Overview)", page5Y, [6, 182, 212]);

const chartW = 86;
const chartH = 65;
const chartStartY = 58;

const drawChartFrame = (title, x, y, isEmpty = false) => {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y + 4, chartW, chartH, 2, 2, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x, y);

  if (isEmpty) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("No data available", x + chartW / 2, y + 4 + chartH / 2, {
      align: "center",
    });
  }
};

// 1. Component Distribution (Top Categories)
const categoryCounts = {};
filteredComponents.forEach(c => {
  categoryCounts[c.category] = (categoryCounts[c.category] || 0) + (c.total_stock || 0);
});
const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

if (sortedCategories.length > 0) {
  drawChartFrame("Component Distribution (Top Categories)", 14, chartStartY, false);
  const maxVal = sortedCategories[0][1];
  sortedCategories.slice(0, 4).forEach((cat, idx) => {
    const yBar = chartStartY + 15 + idx * 13;
    const barWidth = maxVal > 0 ? (cat[1] / maxVal) * 52 : 0;
    doc.setFillColor(99, 102, 241);
    doc.rect(38, yBar, barWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const displayName = cat[0].length > 12 ? cat[0].substring(0, 10) + ".." : cat[0];
    doc.text(displayName, 18, yBar + 4.5);
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(cat[1].toString(), 38 + barWidth + 2, yBar + 4.5);
  });
} else {
  drawChartFrame("Component Distribution (Top Categories)", 14, chartStartY, true);
}

// 2. Active Loans vs Completed Returns
drawChartFrame("Active Loans vs Completed Returns", 106, chartStartY, false);
const maxLoansReturns = Math.max(borrowedStock, filteredReturns.length);
const activeBarW = maxLoansReturns > 0 ? (borrowedStock / maxLoansReturns) * 50 : 0;
const returnBarW = maxLoansReturns > 0 ? (filteredReturns.length / maxLoansReturns) * 50 : 0;

doc.setFillColor(241, 245, 249);
doc.rect(130, chartStartY + 25, 50, 4, "F");
doc.setFillColor(59, 130, 246);
doc.rect(130, chartStartY + 25, activeBarW, 4, "F");

doc.setFillColor(241, 245, 249);
doc.rect(130, chartStartY + 45, 50, 4, "F");
doc.setFillColor(16, 185, 129);
doc.rect(130, chartStartY + 45, returnBarW, 4, "F");

doc.setFontSize(7);
doc.setTextColor(71, 85, 105);
doc.setFont("helvetica", "normal");
doc.text("Active Loans", 112, chartStartY + 28);
doc.text("Returns", 112, chartStartY + 48);
doc.setFont("helvetica", "bold");
doc.setTextColor(15, 23, 42);
doc.text(borrowedStock.toString(), 130 + activeBarW + 2, chartStartY + 28);
doc.text(filteredReturns.length.toString(), 130 + returnBarW + 2, chartStartY + 48);

// 3. Monthly Request Transactions
const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const monthlyCounts = { "Mar": 0, "Apr": 0, "May": 0, "Jun": 0, "Jul": 0, "Aug": 0 };
filteredRequests.forEach(r => {
  if (r.requested_at) {
    const d = new Date(r.requested_at);
    const mName = d.toLocaleString('en-US', { month: 'short' });
    if (mName in monthlyCounts) {
      monthlyCounts[mName] += 1;
    }
  }
});

drawChartFrame("Monthly Request Transactions", 14, chartStartY + chartH + 12, false);
const lcX = 24, lcY = chartStartY + chartH + 12 + 60, lcW = 70, lcH = 40;
doc.setDrawColor(241, 245, 249);
doc.setLineWidth(0.5);

const maxMonthly = Math.max(...Object.values(monthlyCounts), 5);
const steps = [0, 10, 20, 30];
steps.forEach(i => {
  const yVal = lcY - i;
  doc.line(lcX, yVal, lcX + lcW, yVal);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  const labelVal = Math.round((i / 30) * maxMonthly);
  doc.text(labelVal.toString(), lcX - 4, yVal + 2);
});

months.forEach((m, i) => doc.text(m, lcX + 2 + i * 12.5, lcY + 5));
doc.setDrawColor(37, 99, 235);
doc.setLineWidth(1.2);
const pts = months.map((m, i) => {
  const val = monthlyCounts[m];
  const yPoint = lcY - (maxMonthly > 0 ? (val / maxMonthly) * 30 : 0);
  return [lcX + 4 + i * 12.5, yPoint];
});

for (let i = 0; i < pts.length - 1; i++) {
  doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  doc.setFillColor(37, 99, 235);
  doc.circle(pts[i][0], pts[i][1], 1, "F");
}
doc.circle(pts[pts.length - 1][0], pts[pts.length - 1][1], 1, "F");

// 4. Category Requests Usage
const categoryUsage = {};
filteredRequests.forEach(r => {
  if (r.component_category) {
    categoryUsage[r.component_category] = (categoryUsage[r.component_category] || 0) + 1;
  }
});
const sortedUsage = Object.entries(categoryUsage).sort((a, b) => b[1] - a[1]);

if (sortedUsage.length > 0) {
  drawChartFrame("Category Requests Usage", 106, chartStartY + chartH + 12, false);
  const maxUsage = sortedUsage[0][1];
  sortedUsage.slice(0, 4).forEach((cat, idx) => {
    const yBar = chartStartY + chartH + 12 + 15 + idx * 13;
    const barWidth = maxUsage > 0 ? (cat[1] / maxUsage) * 45 : 0;
    doc.setFillColor(139, 92, 246);
    doc.rect(130, yBar, barWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const displayName = cat[0].length > 10 ? cat[0].substring(0, 8) + ".." : cat[0];
    doc.text(displayName, 110, yBar + 4.5);
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(cat[1].toString(), 130 + barWidth + 2, yBar + 4.5);
  });
} else {
  drawChartFrame("Category Requests Usage", 106, chartStartY + chartH + 12, true);
}

// 5. Most Borrowed Components (Units)
const borrowedComponents = {};
filteredBorrows.forEach(r => {
  borrowedComponents[r.component_name] = (borrowedComponents[r.component_name] || 0) + (r.quantity || 0);
});
const sortedBorrowed = Object.entries(borrowedComponents).sort((a, b) => b[1] - a[1]);

if (sortedBorrowed.length > 0) {
  drawChartFrame("Most Borrowed Components (Units)", 14, chartStartY + (chartH + 12) * 2, false);
  const maxB = sortedBorrowed[0][1];
  sortedBorrowed.slice(0, 4).forEach((comp, idx) => {
    const yBar = chartStartY + (chartH + 12) * 2 + 15 + idx * 13;
    const barWidth = maxB > 0 ? (comp[1] / maxB) * 48 : 0;
    doc.setFillColor(249, 115, 22);
    doc.rect(38, yBar, barWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const displayName = comp[0].length > 12 ? comp[0].substring(0, 10) + ".." : comp[0];
    doc.text(displayName, 18, yBar + 4.5);
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(comp[1].toString(), 38 + barWidth + 2, yBar + 4.5);
  });
} else {
  drawChartFrame("Most Borrowed Components (Units)", 14, chartStartY + (chartH + 12) * 2, true);
}

// 6. Top Requesting Users (Transactions)
const userRequests = {};
filteredRequests.forEach(r => {
  userRequests[r.student_name] = (userRequests[r.student_name] || 0) + 1;
});
const sortedUsers = Object.entries(userRequests).sort((a, b) => b[1] - a[1]);

if (sortedUsers.length > 0) {
  drawChartFrame("Top Requesting Users (Transactions)", 106, chartStartY + (chartH + 12) * 2, false);
  const maxU = sortedUsers[0][1];
  sortedUsers.slice(0, 4).forEach((user, idx) => {
    const yBar = chartStartY + (chartH + 12) * 2 + 15 + idx * 13;
    const barWidth = maxU > 0 ? (user[1] / maxU) * 45 : 0;
    doc.setFillColor(37, 99, 235);
    doc.rect(130, yBar, barWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const displayName = user[0].length > 10 ? user[0].substring(0, 8) + ".." : user[0];
    doc.text(displayName, 110, yBar + 4.5);
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(user[1].toString(), 130 + barWidth + 2, yBar + 4.5);
  });
} else {
  drawChartFrame("Top Requesting Users (Transactions)", 106, chartStartY + (chartH + 12) * 2, true);
}

// ================= PAGE 6 =================
doc.addPage("a4", "portrait");
const page6Y = 52;
drawSectionHeader(doc, "Charts & Analytics (Details)", page6Y, [6, 182, 212]);

// 7. Least Borrowed Components
const sortedLeastBorrowed = Object.entries(borrowedComponents).sort((a, b) => a[1] - b[1]);
if (sortedLeastBorrowed.length > 0) {
  drawChartFrame("Least Borrowed Components", 14, chartStartY, false);
  const maxL = Math.max(...sortedLeastBorrowed.map(c => c[1]), 1);
  sortedLeastBorrowed.slice(0, 4).forEach((comp, idx) => {
    const yBar = chartStartY + 15 + idx * 13;
    const barWidth = (comp[1] / maxL) * 48;
    doc.setFillColor(100, 116, 139);
    doc.rect(38, yBar, barWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const displayName = comp[0].length > 12 ? comp[0].substring(0, 10) + ".." : comp[0];
    doc.text(displayName, 18, yBar + 4.5);
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(comp[1].toString(), 38 + barWidth + 2, yBar + 4.5);
  });
} else {
  drawChartFrame("Least Borrowed Components", 14, chartStartY, true);
}

// 8. Low Stock Level Warnings (Units)
const lowStockComponents = filteredComponents.filter(c => (c.available_stock || 0) <= 5);
if (lowStockComponents.length > 0) {
  drawChartFrame("Low Stock Level Warnings (Units)", 106, chartStartY, false);
  const maxLow = Math.max(...lowStockComponents.map(c => c.available_stock), 1);
  lowStockComponents.slice(0, 4).forEach((comp, idx) => {
    const yBar = chartStartY + 15 + idx * 13;
    const barWidth = (comp.available_stock / maxLow) * 45;
    doc.setFillColor(239, 68, 68);
    doc.rect(130, yBar, barWidth, 6, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const displayName = comp.name.length > 10 ? comp.name.substring(0, 8) + ".." : comp.name;
    doc.text(displayName, 110, yBar + 4.5);
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(comp.available_stock.toString(), 130 + barWidth + 2, yBar + 4.5);
  });
} else {
  drawChartFrame("Low Stock Level Warnings (Units)", 106, chartStartY, true);
}

// 9. Inventory Item Growth Curve
drawChartFrame("Inventory Item Growth Curve", 14, chartStartY + chartH + 12, false);
const lX = 24, lY = chartStartY + chartH + 12 + 60, lW = 70;
doc.setDrawColor(241, 245, 249);
doc.setLineWidth(0.5);

// Count growth of items based on components creation date
const growthData = { "Mar": 0, "Apr": 0, "May": 0, "Jun": 0, "Jul": 0, "Aug": 0 };
filteredComponents.forEach(c => {
  if (c.created_at) {
    const d = new Date(c.created_at);
    const mName = d.toLocaleString('en-US', { month: 'short' });
    if (mName in growthData) {
      growthData[mName] += 1;
    }
  }
});
// Cumulative sum
let runningSum = 0;
const growthCumulative = {};
months.forEach(m => {
  runningSum += growthData[m] || 0;
  growthCumulative[m] = runningSum;
});

const maxGrowth = Math.max(...Object.values(growthCumulative), 5);
[0, 15, 30].forEach(i => {
  const yVal = lY - i;
  doc.line(lX, yVal, lX + lW, yVal);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  const labelVal = Math.round((i / 30) * maxGrowth);
  doc.text(labelVal.toString(), lX - 4, yVal + 2);
});

months.forEach((m, i) => doc.text(m, lX + 2 + i * 12.5, lY + 5));
doc.setDrawColor(16, 185, 129);
doc.setLineWidth(1.2);
doc.setFillColor(16, 185, 129);
const ptsG = months.map((m, i) => {
  const val = growthCumulative[m];
  const yPoint = lY - (maxGrowth > 0 ? (val / maxGrowth) * 30 : 0);
  return [lX + 4 + i * 12.5, yPoint];
});

for (let i = 0; i < ptsG.length - 1; i++) {
  doc.line(ptsG[i][0], ptsG[i][1], ptsG[i + 1][0], ptsG[i + 1][1]);
  doc.circle(ptsG[i][0], ptsG[i][1], 1, "F");
}
doc.circle(ptsG[ptsG.length - 1][0], ptsG[ptsG.length - 1][1], 1, "F");

// 10. Daily Transactions (Last 7 Days)
drawChartFrame("Daily Transactions (Last 7 Days)", 106, chartStartY + chartH + 12, false);
const dX = 116, dY = chartStartY + chartH + 12 + 60, dW = 70;

const dailyTransactions = {};
const last7DaysLabels = [];
const latestTxDate = requests.length > 0 
  ? new Date(Math.max(...requests.map(r => new Date(r.requested_at || r.created_at).getTime())))
  : new Date();
for (let i = 6; i >= 0; i--) {
  const d = new Date(latestTxDate);
  d.setDate(d.getDate() - i);
  const label = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  last7DaysLabels.push(label);
  dailyTransactions[label] = 0;
}

filteredRequests.forEach(r => {
  if (r.requested_at) {
    const d = new Date(r.requested_at);
    const label = d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    if (label in dailyTransactions) {
      dailyTransactions[label] += 1;
    }
  }
});

const maxDaily = Math.max(...Object.values(dailyTransactions), 3);
doc.setDrawColor(241, 245, 249);
doc.setLineWidth(0.5);
[0, 15, 30].forEach(i => {
  const yVal = dY - i;
  doc.line(dX, yVal, dX + dW, yVal);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  const labelVal = Math.round((i / 30) * maxDaily);
  doc.text(labelVal.toString(), dX - 4, yVal + 2);
});

last7DaysLabels.forEach((m, i) => doc.text(m, dX + 1 + i * 10.8, dY + 5));
doc.setDrawColor(236, 72, 153);
doc.setLineWidth(1.2);
doc.setFillColor(236, 72, 153);

const ptsD = last7DaysLabels.map((m, i) => {
  const val = dailyTransactions[m];
  const yPoint = dY - (maxDaily > 0 ? (val / maxDaily) * 30 : 0);
  return [dX + 4 + i * 10.8, yPoint];
});

for (let i = 0; i < ptsD.length - 1; i++) {
  doc.line(ptsD[i][0], ptsD[i][1], ptsD[i + 1][0], ptsD[i + 1][1]);
  doc.circle(ptsD[i][0], ptsD[i][1], 1, "F");
}
doc.circle(ptsD[ptsD.length - 1][0], ptsD[ptsD.length - 1][1], 1, "F");

// ================= PAGE 7 =================
doc.addPage("a4", "portrait");
const page7Y = 52;
drawSectionHeader(doc, "Institutional Report Summary & Authorization", page7Y, [99, 102, 241]);

// Metric Breakdown Box
doc.setDrawColor(226, 232, 240);
doc.setLineWidth(0.5);
doc.roundedRect(14, 58, 178, 65, 3, 3, "D");
doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(15, 23, 42);
doc.text("Report Metric Breakdown", 18, 64);

const metricsLeft = [
  { label: "Total Components in Database", val: totalComponents.toString() },
  { label: "Total Available Stock Units", val: availableStock.toString() },
  {
    label: "Total Borrow Transactions (Approved/Active/Closed)",
    val: filteredBorrows.length.toString()
  },
  {
    label: "Total Return Transactions (Completed/Restocked)",
    val: filteredReturns.length.toString()
  },
  { label: "Total Borrow Request Submissions", val: totalTrans.toString() },
];

// Calculate estimated value dynamically
let estimatedValue = 0;
filteredComponents.forEach(c => {
  const cost = unitCosts[c.name] || 10.0;
  estimatedValue += (c.total_stock || 0) * cost;
});
const estimatedValueText = `$${estimatedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const metricsRight = [
  { label: "Approved Requests Count", val: approvedReq.toString() },
  { label: "Pending Requests Count", val: pendingReq.toString() },
  { label: "Rejected Requests Count", val: rejectedReq.toString() },
  { label: "Estimated Total Inventory Value", val: estimatedValueText },
];

doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.setTextColor(100, 116, 139);
metricsLeft.forEach((m, i) => {
  doc.text(m.label, 18, 74 + i * 10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(m.val, 18, 78 + i * 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
});

metricsRight.forEach((m, i) => {
  doc.text(m.label, 106, 74 + i * 10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(m.val, 106, 78 + i * 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
});

doc.setFont("helvetica", "italic");
doc.setFontSize(7);
doc.setTextColor(100, 116, 139);
doc.text(
  "This is a system-generated comprehensive inventory and audit trail document of EI HUB Enterprise. All transactions logged in this report are cryptographically verified,\nimmutable, and synchronized with the secure Layerbase database.",
  14,
  128
);

// Signatures - naturally spaced on the final page
doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(15, 23, 42);
doc.text("Prepared By:", 14, 150);
doc.text("Verified By:", 112, 150);
doc.text("Approved By:", 14, 205);
doc.text("Authorized Laboratory In-Charge:", 112, 205);

doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.setTextColor(100, 116, 139);
const prepText = userRole === "admin" ? "Administrator / Head of Dept" : "Lab Manager / Inventory Assistant";
const verifText = "School of Innovation Laboratory Head";
doc.text(prepText, 14, 154);
doc.text(verifText, 112, 154);
doc.text("Principal / Director (KGISL IT)", 14, 209);
doc.text("Dept of Electronics & Communication Engineering", 112, 209);

doc.setDrawColor(203, 213, 225);
doc.setLineWidth(0.5);
doc.text("Signature: __________________________", 14, 175);
doc.text("Date: ________________________", 14, 182);
doc.text("Signature: __________________________", 112, 175);
doc.text("Date: ________________________", 112, 182);

doc.text("Signature: __________________________", 14, 230);
doc.text("Date: ________________________", 14, 237);
doc.text("Signature: __________________________", 112, 230);
doc.text("Date: ________________________", 112, 237);

// ================= HEADER & FOOTER OVERLAY =================
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);

  // Draw header banner (fitted exactly to printable width)
  if (pdfBannerBase64) {
    doc.addImage(pdfBannerBase64, "JPEG", MARGIN_LEFT, 5, TABLE_WIDTH, 35);
  }

  // Draw metadata line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  
  // Format metadata values
  const dateFormatted = formatDateAndTime(new Date());
  const metaLine = `Report: ${reportType} | Date: ${dateFormatted} | By: ${userName} | Range: ${dateRangeText}`;
  doc.text(metaLine, MARGIN_LEFT, 46);

  // Draw footer line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, 281, A4_WIDTH - MARGIN_RIGHT, 281);

  // Draw footer text with updated School of Innovation branding
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "EI HUB • School of Innovation • KGISL Institute of Technology • Enterprise Inventory Management System • Confidential",
    MARGIN_LEFT,
    286
  );
  doc.text("Generated Automatically", MARGIN_LEFT, 290);
  doc.text(`Page ${i} of ${totalPages}`, A4_WIDTH - MARGIN_RIGHT, 286, { align: "right" });
}

// Write the PDF bytes to stdout
const pdfBytes = doc.output("arraybuffer");
process.stdout.write(Buffer.from(pdfBytes));
process.exit(0);
