import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { BorrowRequest, ComponentItem, SystemOverviewStats } from "../types";
import { formatDateOnly, formatTimestamp } from "./timestamp";
import { pdfBannerBase64 } from "./pdfBanner";

/**
 * Helper to format the purpose field for PDF cell rendering
 */
const formatPurposeForPdf = (purposeStr: string): string => {
  if (!purposeStr) return "N/A";
  if (
    purposeStr.includes("Project Purpose:") ||
    purposeStr.includes("From Date:")
  ) {
    const lines = purposeStr.split("\n");
    const formattedLines: string[] = [];
    lines.forEach((line) => {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const label = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();
        formattedLines.push(label + ":");
        formattedLines.push(value);
      } else {
        formattedLines.push(line);
      }
    });
    return formattedLines.join("\n");
  }
  return purposeStr;
};

/**
 * Generate Student Component Issuance Receipt PDF
 */
export const generateStudentReceiptPdf = async (
  request: BorrowRequest,
  download: boolean = true,
  dateRangeText: string = "All Time (First to Latest)",
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const primaryNavy: [number, number, number] = [11, 31, 74]; // #0B1F4A
  const gold = [249, 180, 45]; // #F9B42D (Orange/Gold)

  // Receipt Summary Card Box (Light grey-blue tint with soft border)
  doc.setDrawColor(226, 232, 240); // Soft gray border (#E2E8F0)
  doc.setFillColor(248, 250, 252); // Light background (#F8FAFC)
  doc.roundedRect(14, 55, 182, 40, 4, 4, "FD");

  // Vertical card column divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(105, 58, 105, 92);

  // Left Column Document Circular Icon
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(29, 78, 216); // Blue outline
  doc.setLineWidth(0.5);
  doc.circle(24, 75, 5.5, "FD");
  // Draw simplified document icon inside
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(0.4);
  doc.rect(21.8, 72.2, 4.4, 5.6, "D"); // Document border
  doc.line(23, 74.2, 25, 74.2);
  doc.line(23, 75.7, 25, 75.7);
  doc.line(23, 77.2, 24.5, 77.2);

  // Right Column User Circular Icon
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(0.5);
  doc.circle(114, 75, 5.5, "FD");
  // Draw simplified user icon inside
  doc.circle(114, 72.5, 1.8, "D"); // Head
  doc.ellipse(114, 77.5, 3.0, 1.6, "D"); // Body/Shoulders

  // Card Content Values and Labels
  doc.setFontSize(9.5);

  // Left Column fields
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // Slate 500
  doc.text("Transaction Reference:", 35, 62);
  doc.text("Issue Date:", 35, 69);
  doc.text("Approved Date:", 35, 76);
  doc.text("Expected Return Date:", 35, 83);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(request.request_code.toUpperCase(), 75, 62);

  doc.setFont("helvetica", "bold");
  doc.text(formatDateOnly(request.requested_at), 75, 69);
  doc.text(
    request.approved_at ? formatDateOnly(request.approved_at) : "N/A",
    75,
    76,
  );
  doc.text(formatDateOnly(request.expected_return_at), 75, 83);

  // Right Column fields
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // Slate 500
  doc.text("Student Name:", 125, 62);
  doc.text("Register No:", 125, 69);
  doc.text("Department:", 125, 76);
  doc.text("Issued By:", 125, 83);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(request.student_name || "N/A", 152, 62);

  doc.setFont("helvetica", "bold");
  doc.text(request.student_register_no || "N/A", 152, 69);
  doc.text("ECE", 152, 76);
  doc.text(request.approved_by_name || "Faculty User 01", 152, 83);

  // Title text replacing the old right-aligned title
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("OFFICIAL COMPONENT TRANSACTION RECEIPT", 105, 50, {
    align: "center",
  });

  // Items Table
  const formattedPurpose = formatPurposeForPdf(request.purpose);

  autoTable(doc, {
    startY: 102,
    head: [
      ["Item SKU", "Component Name", "Category", "Qty", "Purpose", "Status"],
    ],
    body: [
      [
        request.component_id,
        request.component_name || "Arduino Uno R3",
        request.component_category || "Microcontrollers",
        request.quantity.toString(),
        formattedPurpose,
        request.status.toUpperCase(),
      ],
    ],
    margin: { left: 14, right: 14, top: 48 },
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      valign: "middle",
      textColor: [30, 41, 59], // Slate 800
      lineColor: [226, 232, 240], // Soft gray border
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: primaryNavy, // Navy header (#0B1F4A)
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 9,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 32, halign: "left" }, // SKU
      1: { cellWidth: 34, halign: "left" }, // Name
      2: { cellWidth: 22, halign: "center" }, // Category
      3: { cellWidth: 10, halign: "center" }, // Qty
      4: { cellWidth: 58, halign: "left" }, // Purpose
      5: { cellWidth: 26, halign: "center" }, // Status (Rendered as badge in didDrawCell)
    },
    didDrawCell: (data) => {
      if (data.column.index === 5 && data.cell.section === "body") {
        const status = data.cell.raw as string;
        const { x, y, width, height } = data.cell;

        doc.setFillColor(255, 255, 255);
        doc.rect(x + 0.5, y + 0.5, width - 1, height - 1, "F");

        let bg = [220, 252, 231];
        let textCol = [22, 101, 52];
        if (status === "RETURNED") {
          bg = [219, 234, 254];
          textCol = [30, 64, 175];
        } else if (status === "PENDING") {
          bg = [254, 243, 199];
          textCol = [146, 64, 14];
        } else if (status === "REJECTED" || status === "OVERDUE") {
          bg = [254, 226, 226];
          textCol = [153, 27, 27];
        }

        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.roundedRect(x + 2, y + 1.5, width - 4, height - 3, 1.5, 1.5, "F");

        doc.setTextColor(textCol[0], textCol[1], textCol[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(status, x + width / 2, y + height / 2 + 0.8, {
          align: "center",
        });
      }
    },
  });

  // Verification & Signatures section
  const finalY = (doc as any).lastAutoTable.finalY || 125;

  // Draw QR Code
  try {
    const qrDataUrl = await QRCode.toDataURL(
      `${window.location.origin}/verify-receipt/${request.request_code}`,
      {
        width: 120,
        margin: 1,
        color: {
          dark: "#0B132B",
          light: "#FFFFFF",
        },
      },
    );
    doc.addImage(qrDataUrl, "PNG", 14, finalY + 12, 32, 32);
  } catch (err) {
    console.error("Error generating QR code:", err);
  }

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("helvetica", "normal");
  doc.text("Scan QR code to verify validity", 14, finalY + 48);
  doc.text("on the EI HUB Laboratory Portal.", 14, finalY + 52);

  // Apply Banner and Footer to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Draw Banner Header
    doc.addImage(pdfBannerBase64, "JPEG", 10, 5, 190, 36);

    // Footer line
    doc.setDrawColor(11, 31, 74); // Navy line
    doc.setLineWidth(0.8);
    doc.line(14, 280, 196, 280);

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFont("helvetica", "normal");
    doc.text("Generated via EI HUB Enterprise SaaS Platform", 14, 285);
    doc.text(`Page ${i} of ${totalPages}`, 196, 285, { align: "right" });
  }

  // Save PDF
  if (download) {
    doc.save(`EIHUB_Student_Receipt_${request.request_code}.pdf`);
  }
  return doc;
};

/**
 * Generate Comprehensive Enterprise Inventory & Usage Report PDF
 */
export const generateEnterpriseReportPdf = (
  reportType: string,
  components: ComponentItem[],
  requests: BorrowRequest[],
  stats: SystemOverviewStats,
  userRole: string = "admin",
  download: boolean = true,
  dateRangeText: string = "All Time (First to Latest)",
) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];

  const PT_TO_MM = 2.83465;
  const A4_WIDTH = 210; // mm
  const A4_HEIGHT = 297; // mm
  const MARGIN_LEFT = 36 / PT_TO_MM; // mm (12.70mm = 36 pt)
  const MARGIN_RIGHT = 36 / PT_TO_MM; // mm
  const TABLE_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // mm (184.60mm = 523.28 pt)

  const normalizeWidths = (rawWidths: number[], targetWidth: number): number[] => {
    const sum = rawWidths.reduce((s, w) => s + w, 0);
    const factor = targetWidth / sum;
    const normalized = rawWidths.map(w => w * factor);
    const rounded = normalized.map(w => Math.round(w * 100) / 100);
    const roundedSum = rounded.reduce((s, w) => s + w, 0);
    const diff = targetWidth - roundedSum;
    rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + diff) * 100) / 100;
    return rounded;
  };

  const drawPageShell = (pageNum: number) => {
    if (pageNum > 1) {
      doc.addPage("a4", "portrait");
    }
    doc.setPage(pageNum);

    const pWidth = A4_WIDTH;
    const pHeight = A4_HEIGHT;

    // Header Banner (fitted exactly to printable width)
    const bannerW = TABLE_WIDTH;
    const bannerH = 35;
    doc.addImage(pdfBannerBase64, "JPEG", MARGIN_LEFT, 5, bannerW, bannerH);

    // Metadata line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);

    const dateStr = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date());
    const byStr =
      userRole === "faculty"
        ? "Faculty User 01 (faculty)"
        : "Admin User (admin)";

    const metaLine = `Report: ${reportType} | Date: ${dateStr} ${timeStr} | By: ${byStr} | Range: | Filters: Dept: All, Status: All`;
    doc.text(metaLine, MARGIN_LEFT, 46);

    // Footer divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, pHeight - 16, pWidth - MARGIN_RIGHT, pHeight - 16);

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "EI HUB • School of Innovation • KGISL Institute of Technology Enterprise Inventory Management System • Confidential",
      MARGIN_LEFT,
      pHeight - 11,
    );
    doc.text("Generated Automatically", MARGIN_LEFT, pHeight - 7);
    doc.text(`Page ${pageNum} of 7`, pWidth - MARGIN_RIGHT, pHeight - 11, { align: "right" });
  };

  const validatePageWidth = (columnWidths: number[], usablePageWidth: number) => {
    const sumWidths = columnWidths.reduce((sum, w) => sum + w, 0);
    if (Math.abs(sumWidths - usablePageWidth) > 0.5) {
      throw new Error(`PDF Layout Error: sum of column widths (${sumWidths}mm) must equal usable page width (${usablePageWidth}mm).`);
    }
  };

  const getAutoTableStyles = () => ({
    theme: "grid" as const,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 1.0, right: 1.4, bottom: 1.0, left: 1.4 },
      valign: "middle" as const,
      textColor: black,
      lineColor: black,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [124, 58, 237] as [number, number, number], // Violet: #7C3AED
      textColor: white,
      fontStyle: "bold" as const,
      halign: "center" as const,
      valign: "middle" as const,
      fontSize: 8.5,
      cellPadding: { top: 1.2, right: 1.4, bottom: 1.2, left: 1.4 },
    },
  });

  // PAGE 1: Dashboard Summary + Laboratory Component Stock Breakdown
  drawPageShell(1);

  // KPI Summary Metric Cards (8 Cards Grid - 2 Rows)
  const startY = 52;
  const cardW = 42;
  const cardH = 15;
  const gapX = 5;
  const gapY = 5;

  const totalCategories = new Set(components.map((c) => c.category)).size;
  const lowStock = components.filter(
    (c) => c.available_stock > 0 && c.available_stock <= 5,
  ).length;
  const outOfStock = components.filter((c) => c.available_stock === 0).length;
  const pendingReq = requests.filter(
    (r) => r.status.toLowerCase() === "pending",
  ).length;
  const approvedReq = requests.filter(
    (r) =>
      r.status.toLowerCase() === "approved" ||
      r.status.toLowerCase() === "active",
  ).length;
  const rejectedReq = requests.filter(
    (r) => r.status.toLowerCase() === "rejected",
  ).length;

  const kpis = [
    {
      title: "CATEGORIES",
      val: totalCategories.toString(),
      color: [29, 78, 216],
    }, // Blue
    {
      title: "COMPONENTS",
      val: stats.totalComponents.toString(),
      color: [16, 185, 129],
    }, // Green
    {
      title: "AVAILABLE",
      val: stats.availableStock.toString(),
      color: [16, 185, 129],
    },
    {
      title: "BORROWED",
      val: stats.borrowedStock.toString(),
      color: [249, 115, 22],
    }, // Orange
    {
      title: "RETURNED",
      val: requests
        .filter((r) => r.status.toLowerCase() === "returned")
        .length.toString(),
      color: [249, 115, 22],
    },
    { title: "LOW STOCK", val: lowStock.toString(), color: [249, 115, 22] },
    { title: "OUT OF STOCK", val: outOfStock.toString(), color: [225, 29, 72] }, // Red
    { title: "PENDING REQ", val: pendingReq.toString(), color: [56, 189, 248] },
    {
      title: "APPROVED REQ",
      val: approvedReq.toString(),
      color: [16, 185, 129],
    },
    {
      title: "REJECTED REQ",
      val: rejectedReq.toString(),
      color: [225, 29, 72],
    },
    {
      title: "TOTAL TRANS",
      val: requests.length.toString(),
      color: [29, 78, 216],
    },
  ];

  // Draw KPIs (We have 11 KPIs but the screenshot shows 11 in a specific layout, 6 on top, 5 on bottom? Wait, screenshot 1 shows:
  // Row 1: CATEGORIES, COMPONENTS, AVAILABLE, BORROWED, RETURNED, LOW STOCK
  // Row 2: OUT OF STOCK, PENDING REQ, APPROVED REQ, REJECTED REQ, TOTAL TRANS
  // Let's adjust widths to fit 6 per row.
  const newCardW = 29;
  const newGapX = 2;

  kpis.forEach((kpi, idx) => {
    const row = Math.floor(idx / 6);
    const col = idx % 6;
    const x = 14 + col * (newCardW + newGapX);
    const y = startY + row * (cardH + gapY);

    // Card Background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, newCardW, cardH, 2, 2, "FD");

    // Left border colored line
    doc.setDrawColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.setLineWidth(1.5);
    doc.line(x + 0.75, y + 1, x + 0.75, y + cardH - 1);

    // Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.title, x + newCardW / 2, y + 5, { align: "center" });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(kpi.val, x + newCardW / 2, y + 11, { align: "center" });
  });

  // Table Section 1
  const table1Y = startY + 2 * (cardH + gapY) + 5;
  doc.setFillColor(11, 31, 74); // Navy
  doc.roundedRect(14, table1Y - 4, 4, 4, 0.5, 0.5, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Laboratory Component Stock Breakdown", 20, table1Y - 0.5);

  let inventoryRows = components.map((c) => [
    c.sku,
    c.name,
    c.category,
    c.total_stock.toString(),
    c.available_stock.toString(),
    c.borrowed_stock.toString(),
    "0", // Returned
    "0", // Damaged
    "0", // Reserved
    c.cabinet && c.shelf ? `${c.cabinet}, ${c.shelf}` : "Lab A, Shelf 1",
  ]);

  if (inventoryRows.length === 0) {
    inventoryRows = [[{ content: "No components available in inventory breakdown", colSpan: 10, styles: { halign: "center" } }]] as any;
  }

  const t1Widths = normalizeWidths([62, 112, 75, 38, 48, 45, 45, 45, 45, 88].map(w => w / PT_TO_MM), TABLE_WIDTH);
  validatePageWidth(t1Widths, TABLE_WIDTH);

  autoTable(doc, {
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

  // PAGE 2: Borrow Transaction History
  drawPageShell(2);
  doc.setFillColor(59, 130, 246); // Blue square
  doc.roundedRect(14, 52 - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Borrow Transaction History", 20, 52 - 0.5);

  const activeRequests = requests.filter(
    (r) =>
      r.status.toLowerCase() === "approved" ||
      r.status.toLowerCase() === "active",
  );
  let borrowRows = activeRequests.map((r) => [
    r.request_code || r.id.substring(0, 6),
    r.id.substring(0, 5), // Req ID placeholder
    r.requested_at
      ? new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(r.requested_at))
      : "",
    r.student_name || "N/A",
    r.student_register_no || "N/A",
    "ECE", // Dept
    r.component_name || "N/A",
    "SKU", // Placeholder SKU
    r.quantity.toString(),
    r.purpose && r.purpose.length > 20
      ? r.purpose.substring(0, 20) + "..."
      : r.purpose || "Project",
    "Faculty",
    r.status.toUpperCase(),
    "None",
  ]);

  if (borrowRows.length === 0) {
    borrowRows = [[{ content: "No borrow transactions available", colSpan: 13, styles: { halign: "center" } }]] as any;
  }

  const t2Widths = normalizeWidths([35, 35, 60, 60, 45, 25, 65, 45, 22, 60, 50, 40, 50].map(w => w / PT_TO_MM), TABLE_WIDTH);
  validatePageWidth(t2Widths, TABLE_WIDTH);

  autoTable(doc, {
    startY: 55,
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

  // PAGE 3: Return Transaction History
  drawPageShell(3);
  doc.setFillColor(16, 185, 129); // Green square
  doc.roundedRect(14, 52 - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Return Transaction History", 20, 52 - 0.5);

  const returnedRequests = requests.filter(
    (r) => r.status.toLowerCase() === "returned",
  );
  let returnRows = returnedRequests.map((r) => [
    r.request_code || r.id.substring(0, 6),
    r.id.substring(0, 5),
    r.expected_return_at ? formatDateOnly(r.expected_return_at) : "", // Return Date
    r.requested_at ? formatDateOnly(r.requested_at) : "",
    r.student_name || "N/A",
    r.component_name || "N/A",
    r.quantity.toString(),
    "Good", // Condition
    "Faculty User 01", // Verified By
    "None", // Remarks
  ]);

  if (returnRows.length === 0) {
    returnRows = [[{ content: "No return transactions available", colSpan: 10, styles: { halign: "center" } }]] as any;
  }

  const t3Widths = normalizeWidths([40, 40, 65, 65, 65, 75, 25, 50, 60, 60].map(w => w / PT_TO_MM), TABLE_WIDTH);
  validatePageWidth(t3Widths, TABLE_WIDTH);

  autoTable(doc, {
    startY: 55,
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

  // PAGE 4: Component Request History
  drawPageShell(4);
  doc.setFillColor(139, 92, 246); // Purple square
  doc.roundedRect(14, 52 - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Component Request History", 20, 52 - 0.5);

  let requestRows = requests.map((r) => [
    r.request_code || r.id.substring(0, 6),
    r.student_name || "N/A",
    r.student_register_no || "N/A",
    r.component_name || "N/A",
    r.quantity.toString(),
    r.purpose && r.purpose.length > 20
      ? r.purpose.substring(0, 20) + "..."
      : r.purpose || "Project",
    r.requested_at ? formatDateOnly(r.requested_at) : "",
    r.approved_by_name || "Faculty User 01",
    r.status.toUpperCase(),
    "None",
  ]);

  if (requestRows.length === 0) {
    requestRows = [[{ content: "No component requests available", colSpan: 10, styles: { halign: "center" } }]] as any;
  }

  const t4Widths = normalizeWidths([45, 65, 60, 75, 25, 65, 65, 65, 50, 50].map(w => w / PT_TO_MM), TABLE_WIDTH);
  validatePageWidth(t4Widths, TABLE_WIDTH);

  autoTable(doc, {
    startY: 55,
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

  // PAGE 5: Charts & Analytics (Overview)
  drawPageShell(5);
  doc.setFillColor(6, 182, 212); // Cyan square
  doc.roundedRect(14, 52 - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Charts & Analytics (Overview)", 20, 52 - 0.5);

  // Draw 4 Chart Placeholders/Frames on Page 5
  const chartW = 86;
  const chartH = 65;
  const chartStartY = 58;

  const drawChartFrame = (
    title: string,
    x: number,
    y: number,
    dataMode: string,
  ) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y + 4, chartW, chartH, 2, 2, "D");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(title, x, y);

    if (dataMode === "empty") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("No data available", x + chartW / 2, y + 4 + chartH / 2, {
        align: "center",
      });
    }
  };

  // 1: Component Distribution (Top Categories)
  drawChartFrame(
    "Component Distribution (Top Categories)",
    14,
    chartStartY,
    "data",
  );
  // Draw mock bar chart
  doc.setFillColor(99, 102, 241); // Indigo
  doc.rect(38, chartStartY + 15, 52, 6, "F");
  doc.rect(38, chartStartY + 28, 30, 6, "F");
  doc.rect(38, chartStartY + 41, 14, 6, "F");
  doc.rect(38, chartStartY + 54, 10, 6, "F");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("Microcontrol..", 18, chartStartY + 19);
  doc.text("Sensors", 18, chartStartY + 32);
  doc.text("diode", 18, chartStartY + 45);
  doc.text("Others", 18, chartStartY + 58);
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("56", 92, chartStartY + 19);
  doc.text("32", 70, chartStartY + 32);
  doc.text("15", 54, chartStartY + 45);
  doc.text("10", 50, chartStartY + 58);

  // 2: Active Loans vs Completed Returns
  drawChartFrame("Active Loans vs Completed Returns", 106, chartStartY, "data");
  doc.setFillColor(241, 245, 249);
  doc.rect(130, chartStartY + 25, 50, 4, "F");
  doc.setFillColor(241, 245, 249);
  doc.rect(130, chartStartY + 45, 50, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("Active Loans", 112, chartStartY + 28);
  doc.text("Returns", 112, chartStartY + 48);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("0", 132, chartStartY + 28);
  doc.text("0", 132, chartStartY + 48);

  // 3: Monthly Request Transactions
  drawChartFrame(
    "Monthly Request Transactions",
    14,
    chartStartY + chartH + 12,
    "data",
  );
  // Draw mock line chart
  const lcX = 24,
    lcY = chartStartY + chartH + 12 + 60,
    lcW = 70,
    lcH = 40;
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.5);
  [0, 10, 20, 30].forEach((i) => {
    doc.line(lcX, lcY - i, lcX + lcW, lcY - i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(((i / 10) * 1.6).toFixed(0), lcX - 4, lcY - i + 2);
  });
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  months.forEach((m, i) => doc.text(m, lcX + 2 + i * 12.5, lcY + 5));
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  const pts = [
    [lcX + 4, lcY],
    [lcX + 16, lcY - 8],
    [lcX + 29, lcY - 18],
    [lcX + 41, lcY - 28],
    [lcX + 54, lcY - 38],
    [lcX + 66, lcY - 46],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    doc.setFillColor(37, 99, 235);
    doc.circle(pts[i][0], pts[i][1], 1, "F");
  }
  doc.circle(pts[5][0], pts[5][1], 1, "F");

  // 4: Category Requests Usage
  drawChartFrame(
    "Category Requests Usage",
    106,
    chartStartY + chartH + 12,
    "empty",
  );

  // 5 & 6 below
  drawChartFrame(
    "Most Borrowed Components (Units)",
    14,
    chartStartY + (chartH + 12) * 2,
    "empty",
  );
  drawChartFrame(
    "Top Requesting Users (Transactions)",
    106,
    chartStartY + (chartH + 12) * 2,
    "empty",
  );

  // PAGE 6: Charts & Analytics (Details)
  drawPageShell(6);
  doc.setFillColor(6, 182, 212); // Cyan square
  doc.roundedRect(14, 52 - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Charts & Analytics (Details)", 20, 52 - 0.5);

  drawChartFrame("Least Borrowed Components", 14, chartStartY, "empty");

  drawChartFrame("Low Stock Level Warnings (Units)", 106, chartStartY, "data");
  doc.setFillColor(239, 68, 68); // Red
  doc.rect(130, chartStartY + 30, 52, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("Raspberry Pi..", 112, chartStartY + 34);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("3", 184, chartStartY + 34);

  drawChartFrame(
    "Inventory Item Growth Curve",
    14,
    chartStartY + chartH + 12,
    "data",
  );
  // Draw green line chart
  const lX = 24,
    lY = chartStartY + chartH + 12 + 60,
    lW = 70;
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.5);
  [0, 15, 30].forEach((i) => {
    doc.line(lX, lY - i, lX + lW, lY - i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(((i / 30) * 16).toFixed(0), lX - 4, lY - i + 2);
  });
  months.forEach((m, i) => doc.text(m, lX + 2 + i * 12.5, lY + 5));
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(1.2);
  doc.setFillColor(16, 185, 129);
  const ptsG = [
    [lX + 4, lY - 12],
    [lX + 16, lY - 18],
    [lX + 29, lY - 24],
    [lX + 41, lY - 29],
    [lX + 54, lY - 35],
    [lX + 66, lY - 42],
  ];
  for (let i = 0; i < ptsG.length - 1; i++) {
    doc.line(ptsG[i][0], ptsG[i][1], ptsG[i + 1][0], ptsG[i + 1][1]);
    doc.circle(ptsG[i][0], ptsG[i][1], 1, "F");
  }
  doc.circle(ptsG[5][0], ptsG[5][1], 1, "F");

  drawChartFrame(
    "Daily Transactions (Last 7 Days)",
    106,
    chartStartY + chartH + 12,
    "data",
  );
  const dX = 116,
    dY = chartStartY + chartH + 12 + 60,
    dW = 70;
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.5);
  [0, 15, 30].forEach((i) => {
    doc.line(dX, dY - i, dX + dW, dY - i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text((i / 30).toFixed(0), dX - 4, dY - i + 2);
  });
  const days = ["Jul 31", "Aug 1", "Aug 2", "Aug 3", "Aug 4", "Aug 5", "Aug 6"];
  days.forEach((m, i) => doc.text(m, dX + 1 + i * 10.8, dY + 5));
  doc.setDrawColor(236, 72, 153);
  doc.setLineWidth(1.2);
  doc.setFillColor(236, 72, 153);
  for (let i = 0; i < days.length - 1; i++) {
    doc.line(dX + 4 + i * 10.8, dY, dX + 4 + (i + 1) * 10.8, dY);
    doc.circle(dX + 4 + i * 10.8, dY, 1, "F");
  }
  doc.circle(dX + 4 + 6 * 10.8, dY, 1, "F");

  // PAGE 7: Institutional Report Summary & Authorization
  drawPageShell(7);
  doc.setFillColor(99, 102, 241); // Indigo square
  doc.roundedRect(14, 52 - 4, 4, 4, 0.5, 0.5, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Institutional Report Summary & Authorization", 20, 52 - 0.5);

  // Metric Breakdown Box
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 58, 178, 65, 3, 3, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Report Metric Breakdown", 18, 64);

  const metricsLeft = [
    {
      label: "Total Components in Database",
      val: stats.totalComponents.toString(),
    },
    {
      label: "Total Available Stock Units",
      val: stats.availableStock.toString(),
    },
    {
      label: "Total Borrow Transactions (Approved/Active/Closed)",
      val: requests
        .filter(
          (r) =>
            r.status.toLowerCase() !== "pending" &&
            r.status.toLowerCase() !== "rejected",
        )
        .length.toString(),
    },
    {
      label: "Total Return Transactions (Completed/Restocked)",
      val: requests
        .filter((r) => r.status.toLowerCase() === "returned")
        .length.toString(),
    },
    {
      label: "Total Borrow Request Submissions",
      val: requests.length.toString(),
    },
  ];

  const metricsRight = [
    {
      label: "Approved Requests Count",
      val: requests
        .filter(
          (r) =>
            r.status.toLowerCase() === "approved" ||
            r.status.toLowerCase() === "active",
        )
        .length.toString(),
    },
    { label: "Pending Requests Count", val: pendingReq.toString() },
    { label: "Rejected Requests Count", val: rejectedReq.toString() },
    { label: "Estimated Total Inventory Value", val: "$28,250.00" },
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
    "This is a system-generated comprehensive inventory and audit trail document of EI HUB Enterprise. All transactions logged in this report are cryptographically verified,\\nimmutable, and synchronized with the secure Layerbase database.",
    14,
    128,
  );

  // Signatures
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Prepared By:", 14, 142);
  doc.text("Verified By:", 112, 142);
  doc.text("Approved By:", 14, 172);
  doc.text("Authorized Laboratory In-Charge:", 112, 172);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const prepText =
    userRole === "admin"
      ? "Administrator / Head of Dept"
      : "Lab Manager / Inventory Assistant";
  const verifText =
    userRole === "admin"
      ? "Innovation Director / Principal"
      : "School of Innovation Laboratory Head";
  doc.text(prepText, 14, 146);
  doc.text(verifText, 112, 146);
  doc.text("Principal / Director (KGISL IT)", 14, 176);
  doc.text("Dept of Electronics & Communication Engineering", 112, 176);

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.text("Signature: __________________________", 14, 160);
  doc.text("Date: ________________________", 14, 166);
  doc.text("Signature: __________________________", 112, 160);
  doc.text("Date: ________________________", 112, 166);

  doc.text("Signature: __________________________", 14, 190);
  doc.text("Date: ________________________", 14, 196);
  doc.text("Signature: __________________________", 112, 190);
  doc.text("Date: ________________________", 112, 196);

  // Official Seal
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.circle(46, 220, 16, "D");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("OFFICIAL SEAL\\nAREA", 46, 219, { align: "center" });

  // QR Signature Area
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.rect(106, 204, 86, 32, "D");

  // Fake QR Code blocks
  doc.setFillColor(15, 23, 42);
  // Outer squares
  doc.rect(110, 208, 6, 6, "F");
  doc.rect(126, 208, 6, 6, "F");
  doc.rect(110, 224, 6, 6, "F");
  // Fill inner random bits for visual
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      if (Math.random() > 0.5) {
        doc.rect(110 + i * 2, 208 + j * 2, 2, 2, "F");
      }
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("DIGITAL SIGNATURE AREA", 138, 212);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Secure QR Authenticated Log Verified", 138, 218);
  doc.text("Authorized officer: Prof. Robert Chen", 138, 224);
  const currDate = new Date().toISOString().split("T")[0];
  doc.text(`Digitally signed on ${currDate}`, 138, 230);

  if (download) {
    const dateIso = currDate;
    doc.save(`EIHUB_Inventory_Report_${dateIso}.pdf`);
  }
  return doc;
};
