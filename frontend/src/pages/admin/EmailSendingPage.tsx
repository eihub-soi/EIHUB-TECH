import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  Send,
  ArrowLeft,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Upload,
  AlertCircle,
  CheckCircle2,
  Mail,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { mockEngine } from "../../services/mockEngine";
import { previewReport, sendReportEmail } from "../../services/reportService";
import { getAuthHeaders } from "../../utils/api";
import { formatTimestamp } from "../../utils/timestamp";

interface EmailAttachment {
  name: string;
  content: string; // Base64 encoded
  size: number; // In bytes
  type: "pdf" | "csv" | "sql" | "other";
}

// Convert base64 string to Blob
const base64ToBlob = (base64: string, type: string) => {
  const binStr = window.atob(base64);
  const len = binStr.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = binStr.charCodeAt(i);
  }
  return new Blob([arr], { type });
};

// Basic CSV parser that respects quotes
const parseCSV = (csvText: string) => {
  const lines = csvText.split(/\r?\n/);
  const rows: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row: string[] = [];
    let inQuotes = false;
    let currentVal = "";
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());
    rows.push(row);
  }
  
  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0];
  const data = rows.slice(1);
  return { headers, data };
};

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

export const EmailSendingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Query Params
  const reportType = searchParams.get("reportType") || "Transaction Report";
  const rawFrom = searchParams.get("from_date");
  const rawTo = searchParams.get("to_date");
  const fromDateParam = rawFrom === "null" || rawFrom === "undefined" ? "" : rawFrom || "";
  const toDateParam = rawTo === "null" || rawTo === "undefined" ? "" : rawTo || "";
  const attachPdf = searchParams.get("attach_pdf") !== "0";
  const attachCsv = searchParams.get("attach_csv") !== "0";
  const attachSql = false; // Disabled for automated email attachments workflow

  // Component State
  const [rawRequests, setRawRequests] = useState<any[]>([]);
  const [rawComponents, setRawComponents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [preparingFiles, setPreparingFiles] = useState(true);

  // Email form fields
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  
  // Input fields for adding emails
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");

  const [toError, setToError] = useState("");
  const [ccError, setCcError] = useState("");
  const [bccError, setBccError] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Preview content state
  const [previewContent, setPreviewContent] = useState<{
    name: string;
    type: string;
    url?: string;
    text?: string;
    headers?: string[];
    rows?: string[][];
    error?: string;
  } | null>(null);

  useEscapeKey(() => {
    if (previewContent?.url) {
      URL.revokeObjectURL(previewContent.url);
    }
    setPreviewContent(null);
  }, !!previewContent);

  const handlePreviewClick = (att: EmailAttachment) => {
    const name = att.name.toLowerCase();
    const ext = name.split(".").pop() || "";
    
    if (previewContent?.url) {
      URL.revokeObjectURL(previewContent.url);
    }
    
    try {
      if (ext === "pdf") {
        const blob = base64ToBlob(att.content, "application/pdf");
        const url = URL.createObjectURL(blob);
        setPreviewContent({ name: att.name, type: "pdf", url });
      } else if (ext === "csv") {
        const csvText = window.atob(att.content);
        const { headers, data } = parseCSV(csvText);
        setPreviewContent({ name: att.name, type: "csv", headers, rows: data });
      } else if (ext === "sql" || ext === "txt" || ext === "log") {
        const text = window.atob(att.content);
        setPreviewContent({ name: att.name, type: "text", text });
      } else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
        const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const blob = base64ToBlob(att.content, mimeType);
        const url = URL.createObjectURL(blob);
        setPreviewContent({ name: att.name, type: "image", url });
      } else {
        setPreviewContent({ name: att.name, type: "unsupported", error: "Preview not available for this file type." });
      }
    } catch (err) {
      setPreviewContent({ name: att.name, type: "unsupported", error: "Failed to load preview for this file." });
    }
  };

  // Helper: check if valid email
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Convert blob to base64 helper
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // String to base64 helper
  const stringToBase64 = (str: string) => {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Date Formatter: "01 Aug 2026"
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const dateRangeText =
    fromDateParam && toDateParam
      ? `${formatDateLabel(fromDateParam)} to ${formatDateLabel(toDateParam)}`
      : reportType === "Inventory Report"
      ? "All Time (First to Latest)"
      : "All Transactions";

  // 1. Fetch transaction requests and components on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setRawRequests(mockEngine.getRequests());
        setRawComponents(mockEngine.getComponents());
        await mockEngine.syncWithD1();
        setRawRequests(mockEngine.getRequests());
        setRawComponents(mockEngine.getComponents());
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  // 2. Filter data by date range
  const filterByDate = (items: any[], dateField: string) => {
    if (!fromDateParam && !toDateParam) return items;
    return items.filter((item) => {
      const val = item[dateField];
      if (!val) return false;
      const itemDate = new Date(val);
      if (isNaN(itemDate.getTime())) return false;

      if (fromDateParam) {
        const from = new Date(fromDateParam);
        from.setHours(0, 0, 0, 0);
        if (itemDate < from) return false;
      }
      if (toDateParam) {
        const to = new Date(toDateParam);
        to.setHours(23, 59, 59, 999);
        if (itemDate > to) return false;
      }
      return true;
    });
  };

  const filteredRequests = filterByDate(rawRequests, "requested_at");
  const filteredComps = filterByDate(rawComponents, "created_at");

  // Compute components with accurate stock metrics
  const components = filteredComps.map((c) => {
    const activeBorrowedQty = filteredRequests
      .filter(
        (r) =>
          r.component_id === c.id &&
          r.status === "approved" &&
          !r.returned_at
      )
      .reduce((acc, r) => acc + r.quantity, 0);

    return {
      ...c,
      borrowed_stock: activeBorrowedQty,
      available_stock: Math.max(0, c.total_stock - activeBorrowedQty),
    };
  });

  // Compute metrics
  const totalTransactions = filteredRequests.length;
  const totalBorrowed = filteredRequests.filter(
    (r) => r.status === "approved" || r.status === "active"
  ).length;
  const totalReturned = filteredRequests.filter(
    (r) => r.status === "returned"
  ).length;
  const totalPending = filteredRequests.filter(
    (r) => r.status === "pending"
  ).length;

  const totalCategories = new Set(components.map((c) => c.category)).size;
  const totalUnits = components.reduce((acc, c) => acc + c.total_stock, 0);
  const availableUnits = components.reduce(
    (acc, c) => acc + c.available_stock,
    0
  );
  const borrowedUnits = components.reduce(
    (acc, c) => acc + c.borrowed_stock,
    0
  );
  const lowStockCount = components.filter(
    (c) => c.available_stock > 0 && c.available_stock <= 5
  ).length;
  const outOfStockCount = components.filter(
    (c) => c.available_stock === 0
  ).length;

  // 3. Auto-populate subject, message & attachments
  useEffect(() => {
    if (loadingData) return;

    // Generate Subject & Message dynamically based on Report Type
    let generatedSubject = "";
    let generatedMessage = "";

    if (reportType === "Inventory Report") {
      generatedSubject = `Inventory Report - ${dateRangeText}`;
      generatedMessage = `Dear Team,\n\nPlease find attached the Inventory Report generated from EI HUB Innoventry.\n\nReport details:\n- Report Type: Inventory Report\n- Date Range: ${dateRangeText}\n- Total Categories: ${totalCategories}\n- Total Components: ${totalUnits}\n- Available Stock: ${availableUnits}\n- Borrowed Stock: ${borrowedUnits}\n- Low Stock Items: ${lowStockCount}\n- Out of Stock Items: ${outOfStockCount}\n- Generated On: ${formatTimestamp(new Date())}\n\nRegards,\nEI HUB Innoventry System`;
    } else {
      generatedSubject = `${reportType} - ${dateRangeText}`;
      generatedMessage = `Dear Team,\n\nPlease find attached the ${reportType} generated from EI HUB Innoventry.\n\nReport details:\n- Report Type: ${reportType}\n- Date Range: ${dateRangeText}\n- Total Transactions: ${totalTransactions}\n- Total Borrowed: ${totalBorrowed}\n- Total Returned: ${totalReturned}\n- Total Pending: ${totalPending}\n- Generated On: ${formatTimestamp(new Date())}\n\nRegards,\nEI HUB Innoventry System`;
    }

    setSubject(generatedSubject);
    setMessage(generatedMessage);

    // Prepare Auto Attachments
    const prepareAttachments = async () => {
      setPreparingFiles(true);
      const list: EmailAttachment[] = [];

      // A. Generate CSV (if attachCsv is true)
      if (attachCsv) {
        try {
          let csvContent = "";
          if (reportType === "Inventory Report") {
            csvContent +=
              "ID,SKU,Name,Category,Description,Total Stock,Available Stock,Borrowed Stock,Cabinet,Shelf,Location Details,Unit Cost\n";
            components.forEach((c) => {
              const row = [
                c.id,
                `"${c.sku}"`,
                `"${c.name.replace(/"/g, '""')}"`,
                `"${c.category.replace(/"/g, '""')}"`,
                `"${c.description.replace(/"/g, '""')}"`,
                c.total_stock,
                c.available_stock,
                c.borrowed_stock,
                `"${c.cabinet.replace(/"/g, '""')}"`,
                `"${c.shelf.replace(/"/g, '""')}"`,
                `"${c.location_details?.replace(/"/g, '""') || ""}"`,
                c.unit_cost,
              ].join(",");
              csvContent += row + "\n";
            });
          } else {
            csvContent +=
              "Transaction ID,Request Code,Transaction Type,Student ID,Student Name,Student Email,Student Register Number,Student Roll Number,Student Phone,Student Department,Student Year of Study,Institution,Component ID,Component Name,Component Category,Component SKU,Quantity,Purpose,Status,Requested At,Approved/Rejected By ID,Approved/Rejected By Name,Approved/Rejected At,Approved/Rejected Notes / Reason,Expected Return At,Return Requested At,Returned At,Return Reviewed By ID,Return Reviewed By Name,Return Condition,Return Description,Return Remarks\n";
            filteredRequests.forEach((r) => {
              const row = [
                r.id,
                `"${r.request_code || ""}"`,
                `"${r.returned_at ? "Return" : "Borrow"}"`,
                `"${r.student_id || ""}"`,
                `"${(r.student_name || "").replace(/"/g, '""')}"`,
                `"${r.student_email || ""}"`,
                `"${r.student_register_no || ""}"`,
                `"${r.student_roll_no || ""}"`,
                `"${r.student_phone || ""}"`,
                `"${r.student_department || ""}"`,
                `"${r.student_year || ""}"`,
                `"${r.student_institution || ""}"`,
                `"${r.component_id || ""}"`,
                `"${(r.component_name || "").replace(/"/g, '""')}"`,
                `"${r.component_category || ""}"`,
                `"${r.component_sku || ""}"`,
                r.quantity,
                `"${(r.purpose || "").replace(/"/g, '""')}"`,
                `"${r.status || ""}"`,
                `"${r.requested_at || ""}"`,
                `"${r.approved_by || ""}"`,
                `"${(r.approved_by_name || r.approver_name || "").replace(/"/g, '""')}"`,
                `"${r.approved_at || ""}"`,
                `"${(r.rejection_reason || "").replace(/"/g, '""')}"`,
                `"${r.expected_return_at || ""}"`,
                `"${r.return_requested_at || ""}"`,
                `"${r.returned_at || ""}"`,
                `"${r.return_reviewed_by || ""}"`,
                `"${(r.return_reviewed_by_name || "").replace(/"/g, '""')}"`,
                `"${(r.return_condition || "").replace(/"/g, '""')}"`,
                `"${(r.return_description || "").replace(/"/g, '""')}"`,
                `"${(r.return_remarks || "").replace(/"/g, '""')}"`,
              ].join(",");
              csvContent += row + "\n";
            });
          }
          const filename = getReportFilename(reportType, "csv", fromDateParam, toDateParam);
          const csvBlob = new Blob([csvContent], { type: "text/csv" });
          list.push({
            name: filename,
            content: stringToBase64(csvContent),
            size: csvBlob.size,
            type: "csv",
          });
        } catch (err) {
          console.error("Failed to generate CSV attachment:", err);
        }
      }

      // B. Generate SQL (if attachSql is true)
      if (attachSql) {
        try {
          let sqlContent = `-- EI HUB ENTERPRISE SYSTEM EXPORT\n`;
          sqlContent += `-- Generated On: ${formatTimestamp(new Date())}\n`;
          sqlContent += `-- Report Type: ${reportType}\n`;
          sqlContent += `-- Date Range: ${dateRangeText}\n\n`;

          const esc = (val: any) => {
            if (val === null || val === undefined || val === "") return "NULL";
            return `'${String(val).replace(/'/g, "''")}'`;
          };

          const escNum = (val: any) => {
            if (val === null || val === undefined || val === "") return "NULL";
            return String(val);
          };

          if (reportType === "Inventory Report") {
            sqlContent += `CREATE TABLE IF NOT EXISTS components (\n`;
            sqlContent += ` id VARCHAR(255) PRIMARY KEY,\n`;
            sqlContent += ` sku VARCHAR(255),\n`;
            sqlContent += ` name VARCHAR(255),\n`;
            sqlContent += ` category VARCHAR(255),\n`;
            sqlContent += ` description TEXT,\n`;
            sqlContent += ` total_stock INT,\n`;
            sqlContent += ` available_stock INT,\n`;
            sqlContent += ` borrowed_stock INT,\n`;
            sqlContent += ` cabinet VARCHAR(255),\n`;
            sqlContent += ` shelf VARCHAR(255),\n`;
            sqlContent += ` location_details VARCHAR(255),\n`;
            sqlContent += ` unit_cost DECIMAL(10, 2)\n`;
            sqlContent += `);\n\n`;

            components.forEach((c) => {
              sqlContent += `INSERT INTO components (id, sku, name, category, description, total_stock, available_stock, borrowed_stock, cabinet, shelf, location_details, unit_cost) VALUES (\n`;
              sqlContent += `  ${esc(c.id)}, ${esc(c.sku)}, ${esc(c.name)}, ${esc(c.category)}, ${esc(c.description)}, \n`;
              sqlContent += `  ${escNum(c.total_stock)}, ${escNum(c.available_stock)}, ${escNum(c.borrowed_stock)}, ${esc(c.cabinet)}, ${esc(c.shelf)}, ${esc(c.location_details)}, ${escNum(c.unit_cost)}\n`;
              sqlContent += `);\n`;
            });
          } else {
            sqlContent += `CREATE TABLE IF NOT EXISTS borrow_requests (\n`;
            sqlContent += ` id VARCHAR(255) PRIMARY KEY,\n`;
            sqlContent += ` request_code VARCHAR(255),\n`;
            sqlContent += ` transaction_type VARCHAR(255),\n`;
            sqlContent += ` student_id VARCHAR(255),\n`;
            sqlContent += ` student_name VARCHAR(255),\n`;
            sqlContent += ` student_email VARCHAR(255),\n`;
            sqlContent += ` student_register_no VARCHAR(255),\n`;
            sqlContent += ` student_roll_no VARCHAR(255),\n`;
            sqlContent += ` student_phone VARCHAR(255),\n`;
            sqlContent += ` student_department VARCHAR(255),\n`;
            sqlContent += ` student_year VARCHAR(255),\n`;
            sqlContent += ` institution VARCHAR(255),\n`;
            sqlContent += ` component_id VARCHAR(255),\n`;
            sqlContent += ` component_name VARCHAR(255),\n`;
            sqlContent += ` component_category VARCHAR(255),\n`;
            sqlContent += ` component_sku VARCHAR(255),\n`;
            sqlContent += ` quantity INT,\n`;
            sqlContent += ` purpose TEXT,\n`;
            sqlContent += ` status VARCHAR(255),\n`;
            sqlContent += ` requested_at TIMESTAMP,\n`;
            sqlContent += ` approved_by_id VARCHAR(255),\n`;
            sqlContent += ` approved_by_name VARCHAR(255),\n`;
            sqlContent += ` approved_at TIMESTAMP,\n`;
            sqlContent += ` approved_rejected_notes TEXT,\n`;
            sqlContent += ` expected_return_at TIMESTAMP,\n`;
            sqlContent += ` return_requested_at TIMESTAMP,\n`;
            sqlContent += ` returned_at TIMESTAMP,\n`;
            sqlContent += ` return_reviewed_by_id VARCHAR(255),\n`;
            sqlContent += ` return_reviewed_by_name VARCHAR(255),\n`;
            sqlContent += ` return_condition VARCHAR(255),\n`;
            sqlContent += ` return_description TEXT,\n`;
            sqlContent += ` return_remarks TEXT\n`;
            sqlContent += `);\n\n`;

            filteredRequests.forEach((r) => {
              sqlContent += `INSERT INTO borrow_requests (id, request_code, transaction_type, student_id, student_name, student_email, student_register_no, student_roll_no, student_phone, student_department, student_year, institution, component_id, component_name, component_category, component_sku, quantity, purpose, status, requested_at, approved_by_id, approved_by_name, approved_at, approved_rejected_notes, expected_return_at, return_requested_at, returned_at, return_reviewed_by_id, return_reviewed_by_name, return_condition, return_description, return_remarks) VALUES (\n`;
              sqlContent += `  ${esc(r.id)}, ${esc(r.request_code)}, ${esc(r.returned_at ? "Return" : "Borrow")}, ${esc(r.student_id)}, ${esc(r.student_name)}, ${esc(r.student_email)}, ${esc(r.student_register_no)}, ${esc(r.student_roll_no)}, ${esc(r.student_phone)}, ${esc(r.student_department)}, ${esc(r.student_year)}, ${esc(r.student_institution)}, ${esc(r.component_id)}, ${esc(r.component_name)}, ${esc(r.component_category)}, ${esc(r.component_sku)}, ${escNum(r.quantity)}, ${esc(r.purpose)}, ${esc(r.status)}, ${esc(r.requested_at)}, ${esc(r.approved_by)}, ${esc(r.approved_by_name || r.approver_name)}, ${esc(r.approved_at)}, ${esc(r.rejection_reason)}, ${esc(r.expected_return_at)}, ${esc(r.return_requested_at)}, ${esc(r.returned_at)}, ${esc(r.return_reviewed_by)}, ${esc(r.return_reviewed_by_name)}, ${esc(r.return_condition)}, ${esc(r.return_description)}, ${esc(r.return_remarks)}\n`;
              sqlContent += `);\n`;
            });
          }
          const filename = getReportFilename(reportType, "sql", fromDateParam, toDateParam);
          const sqlBlob = new Blob([sqlContent], { type: "text/plain" });
          list.push({
            name: filename,
            content: stringToBase64(sqlContent),
            size: sqlBlob.size,
            type: "sql",
          });
        } catch (err) {
          console.error("Failed to generate SQL attachment:", err);
        }
      }

      // C. Fetch PDF (if attachPdf is true)
      if (attachPdf) {
        try {
          const headers = await getAuthHeaders();
          const query = new URLSearchParams();
          const apiReportType = reportType === "Transaction Report" ? "Transaction Log" : reportType;
          query.append("reportType", apiReportType);
          if (fromDateParam) query.append("from_date", fromDateParam);
          if (toDateParam) query.append("to_date", toDateParam);

          const res = await fetch(
            `/api/admin/reports/preview-pdf?${query.toString()}`,
            { headers }
          );
          if (res.ok) {
            const pdfBlob = await res.blob();
            const base64Pdf = await blobToBase64(pdfBlob);
            const filename = getReportFilename(reportType, "pdf", fromDateParam, toDateParam);
            list.unshift({
              name: filename,
              content: base64Pdf,
              size: pdfBlob.size,
              type: "pdf",
            });
          } else {
            console.error("Failed to fetch PDF preview blob");
          }
        } catch (err) {
          console.error("Failed to prepare PDF attachment:", err);
        }
      }

      setAttachments(list);
      setPreparingFiles(false);
    };

    prepareAttachments();
  }, [loadingData, rawRequests, rawComponents]);

  // Handle email adding tag behavior
  const handleAddEmail = (
    type: "to" | "cc" | "bcc",
    inputVal: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setError: React.Dispatch<React.SetStateAction<string>>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const val = inputVal.trim().replace(",", "");
    if (!val) return;
    if (!validateEmail(val)) {
      setError(`Invalid email address: ${val}`);
      return;
    }
    if (!list.includes(val)) {
      setList([...list, val]);
    }
    setInput("");
    setError("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: "to" | "cc" | "bcc",
    inputVal: string,
    setInput: React.Dispatch<React.SetStateAction<string>>,
    setError: React.Dispatch<React.SetStateAction<string>>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddEmail(type, inputVal, setInput, setError, list, setList);
    } else if (e.key === "Backspace" && inputVal === "" && list.length > 0) {
      setList(list.slice(0, -1));
    }
  };

  const handleRemoveEmail = (
    index: number,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(list.filter((_, idx) => idx !== index));
  };

  // Handle manual file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await processUploadedFiles(files);
  };

  const processUploadedFiles = async (files: FileList) => {
    const list = [...attachments];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64Data = await blobToBase64(file);
        const extension = file.name.split(".").pop()?.toLowerCase();
        let attType: EmailAttachment["type"] = "other";
        if (extension === "pdf") attType = "pdf";
        else if (extension === "csv") attType = "csv";
        else if (extension === "sql") attType = "sql";

        list.push({
          name: file.name,
          content: base64Data,
          size: file.size,
          type: attType,
        });
      } catch (err) {
        toast.error(`Failed to process file: ${file.name}`);
      }
    }
    setAttachments(list);
  };

  // Drag and drop events
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => {
    setDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  };

  // Format file size helper
  const getFileSizeString = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Remove attachment helper
  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments(attachments.filter((_, idx) => idx !== indexToRemove));
  };

  // Send Email Action
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Process lingering inputs
    let activeTo = [...to];
    if (toInput.trim()) {
      const val = toInput.trim().replace(",", "");
      if (validateEmail(val)) {
        activeTo.push(val);
        setTo([...to, val]);
        setToInput("");
      } else {
        toast.error(`Invalid email in 'To' field: ${val}`);
        return;
      }
    }

    let activeCc = [...cc];
    if (ccInput.trim()) {
      const val = ccInput.trim().replace(",", "");
      if (validateEmail(val)) {
        activeCc.push(val);
        setCc([...cc, val]);
        setCcInput("");
      } else {
        toast.error(`Invalid email in 'CC' field: ${val}`);
        return;
      }
    }

    let activeBcc = [...bcc];
    if (bccInput.trim()) {
      const val = bccInput.trim().replace(",", "");
      if (validateEmail(val)) {
        activeBcc.push(val);
        setBcc([...bcc, val]);
        setBccInput("");
      } else {
        toast.error(`Invalid email in 'BCC' field: ${val}`);
        return;
      }
    }

    // 2. Validate fields
    if (activeTo.length === 0) {
      toast.error("Please specify at least one recipient in the 'To' field.");
      setToError("At least one recipient is required.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!message.trim()) {
      toast.error("Message body is required.");
      return;
    }
    if (attachments.length === 0) {
      toast.error("Please select at least one report attachment before sending.");
      return;
    }

    setIsSending(true);
    try {
      // Map frontend attachments array matching API schemas
      const backendAttachments = attachments.map((att) => ({
        name: att.name,
        content: att.content,
      }));

      await sendReportEmail({
        report_type: reportType === "Transaction Report" ? "Transaction Log" : reportType,
        to: activeTo,
        cc: activeCc,
        bcc: activeBcc,
        subject,
        message,
        from_date: fromDateParam || null,
        to_date: toDateParam || null,
        attachments: backendAttachments,
      });

      setIsSuccess(true);
      toast.success("Email sent successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send email. Please check your configuration.");
    } finally {
      setIsSending(false);
    }
  };

  const getAttachmentIcon = (type: EmailAttachment["type"]) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-5 h-5 text-red-500" />;
      case "csv":
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case "sql":
        return <FileCode className="w-5 h-5 text-amber-500" />;
      default:
        return <File className="w-5 h-5 text-blue-500" />;
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-black">Email Sent Successfully</h2>
            <p className="text-xs text-gray-500">
              The {reportType.toLowerCase()} has been emailed to {to.join(", ")}.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left text-xs space-y-2 border border-[#E5E7EB]">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-semibold">Sender Profile</span>
              <span className="text-black font-bold">eihubsoi@gmail.com</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-semibold">Subject</span>
              <span className="text-black font-bold truncate max-w-[250px]">{subject}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-semibold">Date Range</span>
              <span className="text-black font-bold">{dateRangeText}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-semibold">Attachments Sent</span>
              <span className="text-black font-bold">{attachments.length} files</span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setIsSuccess(false)}
              className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all"
            >
              Compose Another
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
            >
              Return to Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-bold transition-all focus:outline-none"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Reports
      </button>

      {/* Title Header Section */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Send className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-black tracking-tight">
            Email Sending
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Compose and send an email
          </p>
        </div>
      </div>

      {/* Compact Report Details Card */}
      <div className="p-4 rounded-2xl bg-[#F0F6FF]/60 border border-blue-100/70 space-y-3">
        <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
          Report Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-gray-500">Report Type</p>
            <p className="font-bold text-black">{reportType}</p>
          </div>
          <div>
            <p className="text-gray-500">Date Range</p>
            <p className="font-bold text-black">{dateRangeText}</p>
          </div>
          <div>
            <p className="text-gray-500">Generated On</p>
            <p className="font-bold text-black">
              {loadingData ? "Loading..." : new Date().toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Summary Statistics</p>
            <p className="font-bold text-black">
              {loadingData ? (
                "Loading..."
              ) : reportType === "Inventory Report" ? (
                <span>
                  {totalUnits} Units ({availableUnits} Available, {borrowedUnits} Borrowed, {lowStockCount} Low Stock)
                </span>
              ) : (
                <span>
                  {totalTransactions} Total ({totalBorrowed} Borrowed, {totalReturned} Returned, {totalPending} Pending)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Single Column Form */}
      <form
        onSubmit={handleSendEmail}
        className="p-8 rounded-3xl bg-white border border-[#E5E7EB] space-y-6 shadow-sm"
      >
        {/* From Email Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0">
            From Email
          </label>
          <div className="flex-1">
            <input
              type="email"
              value="eihubsoi@gmail.com"
              disabled
              className="w-full p-2.5 rounded-xl bg-slate-100 border border-transparent text-xs text-gray-600 font-semibold cursor-not-allowed"
            />
          </div>
        </div>

        {/* To Email Field */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0 pt-2.5">
            To <span className="text-red-500">*</span>
          </label>
          <div className="flex-1 space-y-2">
            <div
              className={`p-2 rounded-xl bg-slate-50 border ${
                toError
                  ? "border-red-300 focus-within:border-red-500"
                  : "border-[#E5E7EB] focus-within:border-blue-500"
              } transition-colors flex flex-wrap gap-2 items-center`}
            >
              {to.map((email, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-blue-200"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(idx, to, setTo)}
                    className="hover:text-red-600 focus:outline-none transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={toInput}
                onChange={(e) => {
                  setToInput(e.target.value);
                  setToError("");
                }}
                onKeyDown={(e) =>
                  handleKeyDown(e, "to", toInput, setToInput, setToError, to, setTo)
                }
                onBlur={() =>
                  handleAddEmail("to", toInput, setToInput, setToError, to, setTo)
                }
                placeholder={to.length === 0 ? "Enter recipient email(s)..." : ""}
                className="flex-1 min-w-[150px] bg-transparent outline-none text-xs text-black placeholder:text-gray-400"
              />
            </div>
            {toError && (
              <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {toError}
              </p>
            )}
          </div>
        </div>

        {/* CC Field */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0 pt-2.5">
            CC
          </label>
          <div className="flex-1 space-y-2">
            <div
              className={`p-2 rounded-xl bg-slate-50 border ${
                ccError
                  ? "border-red-300 focus-within:border-red-500"
                  : "border-[#E5E7EB] focus-within:border-blue-500"
              } transition-colors flex flex-wrap gap-2 items-center`}
            >
              {cc.map((email, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-blue-200"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(idx, cc, setCc)}
                    className="hover:text-red-600 focus:outline-none transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={ccInput}
                onChange={(e) => {
                  setCcInput(e.target.value);
                  setCcError("");
                }}
                onKeyDown={(e) =>
                  handleKeyDown(e, "cc", ccInput, setCcInput, setCcError, cc, setCc)
                }
                onBlur={() =>
                  handleAddEmail("cc", ccInput, setCcInput, setCcError, cc, setCc)
                }
                placeholder={cc.length === 0 ? "Enter CC email(s)..." : ""}
                className="flex-1 min-w-[150px] bg-transparent outline-none text-xs text-black placeholder:text-gray-400"
              />
            </div>
            {ccError && (
              <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {ccError}
              </p>
            )}
          </div>
        </div>

        {/* BCC Field */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0 pt-2.5">
            BCC
          </label>
          <div className="flex-1 space-y-2">
            <div
              className={`p-2 rounded-xl bg-slate-50 border ${
                bccError
                  ? "border-red-300 focus-within:border-red-500"
                  : "border-[#E5E7EB] focus-within:border-blue-500"
              } transition-colors flex flex-wrap gap-2 items-center`}
            >
              {bcc.map((email, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-blue-200"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(idx, bcc, setBcc)}
                    className="hover:text-red-600 focus:outline-none transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={bccInput}
                onChange={(e) => {
                  setBccInput(e.target.value);
                  setBccError("");
                }}
                onKeyDown={(e) =>
                  handleKeyDown(e, "bcc", bccInput, setBccInput, setBccError, bcc, setBcc)
                }
                onBlur={() =>
                  handleAddEmail("bcc", bccInput, setBccInput, setBccError, bcc, setBcc)
                }
                placeholder={bcc.length === 0 ? "Enter BCC email(s)..." : ""}
                className="flex-1 min-w-[150px] bg-transparent outline-none text-xs text-black placeholder:text-gray-400"
              />
            </div>
            {bccError && (
              <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> {bccError}
              </p>
            )}
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0">
            Subject <span className="text-red-500">*</span>
          </label>
          <div className="flex-1">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-[#E5E7EB] focus:border-blue-500 text-xs text-black focus:outline-none transition-colors font-semibold"
              placeholder="Report subject..."
            />
          </div>
        </div>

        {/* Message Field */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0 pt-2.5">
            Message <span className="text-red-500">*</span>
          </label>
          <div className="flex-1">
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full p-3 rounded-xl bg-slate-50 border border-[#E5E7EB] focus:border-blue-500 text-xs text-black focus:outline-none transition-colors resize-none font-medium leading-relaxed"
              placeholder="Email body content..."
            />
          </div>
        </div>

        {/* Attached Files Section */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 animate-in fade-in duration-200">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0 pt-2.5">
            Attached Files
          </label>
          <div className="flex-1 space-y-4">
            {preparingFiles ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-[#E5E7EB] text-xs font-bold text-gray-700">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                Preparing {reportType} attachments...
              </div>
            ) : (
              attachments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-[#E5E7EB] flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start gap-3 overflow-hidden">
                        <div className="p-2 bg-slate-50 rounded-xl shrink-0">
                          {getAttachmentIcon(att.type)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-extrabold text-black truncate text-xs">
                            {att.name}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {getFileSizeString(att.size)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 text-xs font-extrabold border-t border-slate-100 pt-2.5">
                        <button
                          type="button"
                          onClick={() => handlePreviewClick(att)}
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 focus:outline-none transition-colors"
                        >
                          Preview 👁
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="text-red-500 hover:text-red-600 flex items-center gap-1 focus:outline-none transition-colors"
                        >
                          Remove ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-red-500 font-bold flex items-center gap-1 bg-red-50 p-3 rounded-xl border border-red-100">
                  <AlertCircle className="w-4 h-4" /> No attachments selected. Please select at least one attachment before sending.
                </p>
              )
            )}
          </div>
        </div>

        {/* Additional Local Attachments */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <label className="w-full sm:w-28 text-xs font-bold text-gray-700 sm:text-right shrink-0 pt-2.5">
            Add Files
          </label>
          <div className="flex-1">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-[#E5E7EB] hover:border-blue-400 bg-slate-50"
              }`}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-black">
                Drag and drop files here or click to browse
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                Attach additional images, text, or verification files.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSending}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSending || preparingFiles}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-xs transition-all shadow-sm"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Sending...
              </>
            ) : (
              <>
                <span>✈</span> Send Email
              </>
            )}
          </button>
        </div>
      </form>

      {/* Preview Modal Overlay */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 text-left">
          <div className="bg-white rounded-[32px] max-w-4xl w-full p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-black truncate max-w-[280px] md:max-w-lg">{previewContent.name}</h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">File Preview</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (previewContent.url) {
                    URL.revokeObjectURL(previewContent.url);
                  }
                  setPreviewContent(null);
                }}
                className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors focus:outline-none border border-transparent"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {previewContent.type === "pdf" && (
                <iframe
                  src={previewContent.url}
                  title="PDF Preview"
                  className="w-full h-[60vh] border border-slate-200 rounded-2xl bg-slate-100"
                />
              )}

              {previewContent.type === "image" && (
                <div className="flex items-center justify-center bg-slate-50 p-8 rounded-2xl border border-slate-200">
                  <img
                    src={previewContent.url}
                    alt={previewContent.name}
                    className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-sm"
                  />
                </div>
              )}

              {previewContent.type === "csv" && (
                <div className="overflow-auto max-h-[60vh] border border-slate-200 rounded-2xl">
                  <table className="w-full border-collapse text-left text-xs bg-white text-black">
                    <thead className="bg-slate-100 font-bold sticky top-0">
                      <tr>
                        {previewContent.headers?.map((h, idx) => (
                          <th key={idx} className="p-3 border-b border-slate-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewContent.rows?.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50 border-b border-slate-100">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="p-3 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {previewContent.type === "text" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewContent.text || "");
                      toast.success("Content copied to clipboard!");
                    }}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all shadow"
                  >
                    Copy Text
                  </button>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl overflow-auto max-h-[60vh] text-xs font-mono whitespace-pre-wrap leading-relaxed">
                    {previewContent.text}
                  </pre>
                </div>
              )}

              {previewContent.type === "unsupported" && (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                  <h4 className="font-extrabold text-black text-sm">{previewContent.error}</h4>
                  <p className="text-xs text-gray-500 mt-1">Preview is not supported for this specific file format.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-[#E5E7EB] pt-4 mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (previewContent.url) {
                    URL.revokeObjectURL(previewContent.url);
                  }
                  setPreviewContent(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
