# Email Flow

## Overview
Email communications are sent using the **Brevo (Sendinblue)** transactional email API.

## Services
1. **Password Reset Emails**
   - Triggered by user request.
   - Generates a Firebase reset link.
   - Injected into a custom HTML template.
   - Sent via Brevo API.

2. **Notifications & Alerts**
   - e.g., "Low Stock Alert" or "Request Approved".
   - Dispatched asynchronously using the `email_worker` background task queue to avoid blocking API responses.

3. **PDF Reports**
   - `POST /api/reports/email`
   - Generates a PDF byte stream using `reportlab` or `jsPDF` equivalents.
   - Base64 encodes the PDF.
   - Attaches it to the Brevo API payload as an attachment.
