export type UserRole = "student" | "faculty" | "admin";

export type RequestStatus =
  "pending" | "approved" | "rejected" | "returned" | "overdue";

export type ComponentCategory = string;

export type LogSeverity = "info" | "warning" | "critical";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  register_number?: string;
  roll_number?: string;
  faculty_id?: string;
  department: string;
  year_of_study?: string;
  institution?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  firebase_uid?: string;
  created_at: string;
  updated_at: string;
  username?: string;
}

export interface ComponentItem {
  id: string;
  sku: string;
  name: string;
  category: ComponentCategory;
  description: string;
  total_stock: number;
  available_stock: number;
  borrowed_stock: number;
  cabinet: string;
  shelf: string;
  location_details?: string;
  image_url: string;
  datasheet_url?: string;
  unit_cost: number;
  created_at: string;
  updated_at: string;
}

export interface BorrowRequest {
  id: string;
  request_code: string;
  student_id: string;
  student_name?: string;
  student_register_no?: string;
  student_email?: string;
  component_id: string;
  component_name?: string;
  component_category?: ComponentCategory;
  component_image?: string;
  quantity: number;
  purpose: string;
  status: RequestStatus;
  approved_by?: string;
  approved_by_name?: string;
  rejection_reason?: string;
  requested_at: string;
  approved_at?: string;
  expected_return_at: string;
  return_requested_at?: string;
  returned_at?: string;
  return_condition?: string;
  return_description?: string;
  return_missing_details?: string;
  return_damaged_details?: string;
  return_remarks?: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string; // e.g. PO-2026-0891
  supplier_name: string; // e.g. Element14, Mouser, Robocraze
  component_id: string;
  component_name: string;
  component_category: ComponentCategory;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchased_by: string;
  purchased_by_name: string;
  invoice_ref?: string;
  cabinet: string;
  shelf: string;
  status: "delivered" | "processing" | "cancelled";
  purchased_at: string;
  created_at: string;
}



export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

export interface SystemOverviewStats {
  totalUsers: number;
  totalStudents: number;
  totalFaculty: number;
  totalAdmins: number;
  totalComponents: number;
  availableStock: number;
  borrowedStock: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  pendingRequestsCount: number;
  pendingReturnsCount: number;
  activeLoansCount: number;
  totalPurchasesCount: number;
}
