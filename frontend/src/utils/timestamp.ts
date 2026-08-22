/**
 * Safely parses any date string (including SQLite UTC dates without 'Z') into a JavaScript Date object.
 */
export function parseUTCDate(dateVal: Date | string | number): Date {
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === "number") return new Date(dateVal);
  if (typeof dateVal === "string") {
    let normalized = dateVal.trim();
    // SQLite datetime('now') returns YYYY-MM-DD HH:MM:SS in UTC.
    // If it has no timezone indicator, assume it's UTC and append Z.
    if (
      /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2}(\.\d{3})?)?$/.test(normalized)
    ) {
      normalized = normalized.replace(" ", "T") + "Z";
    } else if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(normalized)
    ) {
      normalized = normalized + "Z";
    }
    const parsed = new Date(normalized);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date(dateVal);
}

/**
 * Formats a date to: DD MMM YYYY, HH:mm:ss IST (Asia/Kolkata) | UTC+05:30 | Coimbatore, Tamil Nadu, India
 * E.g., "02 Aug 2026, 11:35:42 IST (Asia/Kolkata) | UTC+05:30 | Coimbatore, Tamil Nadu, India"
 */
export function formatTimestamp(date: Date | string | number): string {
  const d = parseUTCDate(date);
  if (isNaN(d.getTime())) return "N/A";

  const parts = Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";
  const second = parts.find((p) => p.type === "second")?.value || "";

  return `${day} ${month} ${year}, ${hour}:${minute}:${second} IST (Asia/Kolkata) | UTC+05:30 | Coimbatore, Tamil Nadu, India`;
}

/**
 * Formats a date to: DD MMM YYYY (using Asia/Kolkata timezone).
 * E.g., "02 Aug 2026"
 */
export function formatDateOnly(date: Date | string | number): string {
  const d = parseUTCDate(date);
  if (isNaN(d.getTime())) return "N/A";

  const parts = Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(d);

  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";

  return `${day} ${month} ${year}`;
}

/**
 * Formats a date to: HH:mm (using Asia/Kolkata timezone).
 * E.g., "11:35"
 */
export function formatTimeOnly(date: Date | string | number): string {
  const d = parseUTCDate(date);
  if (isNaN(d.getTime())) return "N/A";

  const parts = Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(d);

  const hour = parts.find((p) => p.type === "hour")?.value || "";
  const minute = parts.find((p) => p.type === "minute")?.value || "";

  return `${hour}:${minute}`;
}
