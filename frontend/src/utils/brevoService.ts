import { toast } from "sonner";
import { apiRequest } from "./api";
import { formatDateOnly } from "./timestamp";

/**
 * Sends a 6-digit OTP verification email to the user via backend.
 */
export const sendBrevoOtp = async (
  email: string,
  code: string,
): Promise<void> => {
  try {
    await apiRequest(`/api/auth/otp`, {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    console.log("[Brevo Tech] OTP email successfully dispatched via backend!");
  } catch (error) {
    console.error("[Brevo Error Response]", error);
    throw new Error("Failed to send OTP email.");
  }
};

/**
 * The backend handles borrowing alerts directly in /approve, /reject, /submit endpoints.
 * This is left here as a no-op just in case it's still called synchronously.
 */
export const sendBrevoAlertAndPdf = async (
  email: string,
  request: any,
  status: "approved" | "rejected" | "pending" | "returned" | "reminder",
  pdfBase64?: string,
): Promise<void> => {
  console.log(`[Brevo Tech] Email alert for ${status} is handled by the backend.`);
  return;
};

/**
 * Sends an inventory report email via backend.
 */
export const sendBrevoReportEmail = async (
  email: string,
  pdfBase64: string,
  reportType: string = "Inventory Report",
): Promise<void> => {
  try {
    await apiRequest(`/api/admin/reports/email-pdf`, {
      method: "POST",
      body: JSON.stringify({
        email: email,
        reportType: reportType,
        pdfBase64: pdfBase64
      }),
    });
    toast.success("Report emailed successfully!");
  } catch (error) {
    console.error("[Brevo Error]", error);
    toast.error("Failed to email report.");
  }
};

/**
 * Sends a consolidated return reminder via backend.
 */
export const sendBrevoConsolidatedReminder = async (
  email: string,
  studentName: string,
  items: any[],
): Promise<void> => {
  // Reminders are triggered by the cron job on the backend. No-op here.
  console.log(`[Brevo Tech] Reminders are handled by the backend cron job.`);
};

/**
 * Sends a password reset link to the user via backend.
 */
export const sendBrevoPasswordReset = async (
  email: string,
  token: string,
): Promise<void> => {
  // Handled by sendBrevoPasswordResetLink below
};

export const sendBrevoPasswordResetLink = async (
  email: string,
  name?: string,
  link?: string,
): Promise<void> => {
  try {
    await apiRequest(`/api/auth/reset-link`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    console.log("[Brevo Tech] Password reset email successfully dispatched via backend!");
  } catch (error: any) {
    console.error("[Brevo Error Response]", error);
    throw error;
  }
};

export const sendBrevoLowStockAlert = async (component: any) => {};
export const sendBrevoPurchaseAlert = async (po: any, status: string) => {};
