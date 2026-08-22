import {
  ComponentItem,
  Profile,
  BorrowRequest,
  NotificationItem,
} from "../types";

const now = new Date();

// Helper to get ISO string offset by days/hours/minutes relative to current execution time
function offsetDate(
  days: number,
  hours: number = 0,
  minutes: number = 0,
): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export const INITIAL_PROFILES: Profile[] = [];

export const INITIAL_COMPONENTS: ComponentItem[] = [];

export const INITIAL_REQUESTS: BorrowRequest[] = [];


export const INITIAL_PURCHASE_ORDERS: any[] = [];
