import { getAuthHeaders, apiRequest } from "../utils/api";

export interface EmailPayload {
  report_type: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
  from_date?: string | null;
  to_date?: string | null;
  attachments?: Array<{ name: string; content: string }>;
}

/**
 * Fetches the report PDF from the backend and returns an Object URL.
 */
export const previewReport = async (reportType: string, filters?: any): Promise<string> => {
  const headers = await getAuthHeaders();
  
  // Build query string
  const query = new URLSearchParams();
  query.append("reportType", reportType);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
  }

  const response = await fetch(`/api/admin/reports/preview-pdf?${query.toString()}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Failed to preview report: ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.detail || errorMsg;
    } catch {
      const textData = await response.text();
      errorMsg = textData || errorMsg;
    }
    throw new Error(errorMsg);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Fetches the report CSV from the backend and returns an Object URL.
 */
export const downloadReportCsv = async (reportType: string, filters?: any): Promise<string> => {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  const apiReportType = reportType === "Transaction Report" ? "Transaction Log" : reportType;
  query.append("reportType", apiReportType);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
  }
  const response = await fetch(`/api/admin/reports/download-csv?${query.toString()}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.status}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Fetches the report SQL from the backend and returns an Object URL.
 */
export const downloadReportSql = async (reportType: string, filters?: any): Promise<string> => {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  const apiReportType = reportType === "Transaction Report" ? "Transaction Log" : reportType;
  query.append("reportType", apiReportType);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
  }
  const response = await fetch(`/api/admin/reports/download-sql?${query.toString()}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to download SQL: ${response.status}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * Sends a request to the backend to generate and email a report.
 */
export const sendReportEmail = async (payload: EmailPayload): Promise<void> => {
  await apiRequest("/api/admin/reports/email-pdf", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
