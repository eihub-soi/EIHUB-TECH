import {
  ComponentItem,
  Profile,
  BorrowRequest,
  NotificationItem,
  SystemOverviewStats,
  PurchaseOrder,
} from "../types";
import {
  INITIAL_COMPONENTS,
  INITIAL_PROFILES,
  INITIAL_REQUESTS,
  INITIAL_PURCHASE_ORDERS,
} from "./mockData";
import { apiRequest } from "../utils/api";
import { generateStudentReceiptPdf } from "../utils/pdfGenerator";

const STORAGE_KEYS = {
  COMPONENTS: "ei_hub_components_v2",
  PROFILES: "ei_hub_profiles_v2",
  REQUESTS: "ei_hub_requests_v2",
  LOGS: "ei_hub_logs_v2",
  NOTIFS: "ei_hub_notifications_v2",
  PURCHASES: "ei_hub_purchases_v2",
};

class MockEngine {
  private listeners: Array<() => void> = [];
  private syncPromise: Promise<void> | null = null;

  constructor() {
    this.initStorage();
    // Perform initial synchronization with Python backend
    this.syncWithD1()
      .then(() => {
        this.checkForDeadlineReminders();
      })
      .catch((err) => console.error("[MockEngine] Initial sync failed:", err));
  }

  /**
   * Synchronizes local storage data with the Python FastAPI backend
   */
  public async syncWithD1(): Promise<void> {
    // Check if token exists before trying to sync to prevent 401 spam when logged out
    const token = localStorage.getItem("ei_hub_auth_token");
    if (!token) return;

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      try {
        console.log(
          "[MockEngine] Synchronizing datasets with Python Backend...",
        );

        // 1. Sync components
        const comps = await apiRequest("/api/components");
        localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(comps));

        // 2. Sync borrow requests
        const reqs = await apiRequest("/api/requests");
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(reqs));

        // 3. Sync purchase orders
        const purchases = await apiRequest("/api/purchase-orders");
        localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));

        // 4. Sync current user profile
        try {
          const profile = await apiRequest("/api/profiles");
          if (profile && profile.id) {
            const list = this.getProfiles();
            const idx = list.findIndex((p) => p.id === profile.id);
            if (idx !== -1) {
              list[idx] = { ...list[idx], ...profile };
            } else {
              list.push(profile);
            }
            localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(list));
          }
        } catch (e) {
          console.warn("[MockEngine] Failed to sync current user profile:", e);
        }

        // 5. Sync audit logs
        const logs = await apiRequest("/api/activity-logs");
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));

        // 6. Sync user notifications (only if authenticated)
        if (
          typeof window !== "undefined" &&
          localStorage.getItem("ei_hub_active_user_id")
        ) {
          try {
            const notifications = await apiRequest("/api/notifications");
            localStorage.setItem(
              STORAGE_KEYS.NOTIFS,
              JSON.stringify(notifications),
            );
          } catch (notifErr) {
            console.warn(
              "[MockEngine] Failed to sync notifications:",
              notifErr,
            );
          }
        }

        this.notify();
      } catch (e) {
        console.warn(
          "[MockEngine] Connection to FastAPI backend failed, running in local fallback mode:",
          e,
        );
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  private initStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.COMPONENTS)) {
      localStorage.setItem(
        STORAGE_KEYS.COMPONENTS,
        JSON.stringify(INITIAL_COMPONENTS),
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROFILES)) {
      localStorage.setItem(
        STORAGE_KEYS.PROFILES,
        JSON.stringify(INITIAL_PROFILES),
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
      localStorage.setItem(
        STORAGE_KEYS.REQUESTS,
        JSON.stringify(INITIAL_REQUESTS),
      );
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PURCHASES)) {
      localStorage.setItem(
        STORAGE_KEYS.PURCHASES,
        JSON.stringify(INITIAL_PURCHASE_ORDERS),
      );
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public notify() {
    this.listeners.forEach((listener) => listener());
  }

  // --- COMPONENTS ---
  public getComponents(): ComponentItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.COMPONENTS);
    const comps: ComponentItem[] = data ? JSON.parse(data) : INITIAL_COMPONENTS;

    // Dynamically retrieve borrow requests to compute active loan quantities
    const requests = this.getRequests();

    return comps.map((c) => {
      // Find all approved requests for this component that have not yet been returned
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
  }

  public addComponent(
    comp: Omit<
      ComponentItem,
      "id" | "created_at" | "updated_at" | "borrowed_stock" | "available_stock"
    > & { available_stock?: number },
  ): ComponentItem {
    const list = this.getComponents();
    const newComp: ComponentItem = {
      ...comp,
      id: crypto.randomUUID(),
      available_stock: comp.available_stock ?? comp.total_stock,
      borrowed_stock: 0,
      sku: `COMP-${crypto.randomUUID().substring(0, 4).toUpperCase()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(newComp);
    localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(list));

    apiRequest("/api/components", {
      method: "POST",
      body: JSON.stringify(comp),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error("[MockEngine] Failed to save component to backend:", err),
      );

    this.notify();
    return newComp;
  }

  public updateComponent(id: string, formData: Partial<ComponentItem>) {
    const list = this.getComponents();
    const idx = list.findIndex((c) => c.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...formData,
        updated_at: new Date().toISOString(),
      } as ComponentItem;
      localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(list));
    }

    apiRequest(`/api/components/${id}`, {
      method: "PUT",
      body: JSON.stringify(formData),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error(
          "[MockEngine] Failed to update component on backend:",
          err,
        ),
      );

    this.notify();
  }

  public deleteComponent(id: string) {
    let list = this.getComponents();
    list = list.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(list));

    apiRequest(`/api/components/${id}`, {
      method: "DELETE",
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error(
          "[MockEngine] Failed to delete component from backend:",
          err,
        ),
      );

    this.notify();
  }

  public restockComponent(
    componentId: string,
    quantity: number,
    userId: string,
  ) {
    const comps = this.getComponents();
    const comp = comps.find((c) => c.id === componentId);
    if (comp) {
      comp.total_stock += quantity;
      comp.available_stock += quantity;
      comp.updated_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(comps));

      apiRequest(`/api/components/${componentId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...comp,
          total_stock: comp.total_stock,
          available_stock: comp.available_stock,
        }),
      })
        .then(() => this.syncWithD1())
        .catch((err) =>
          console.error(
            "[MockEngine] Failed to restock component on backend:",
            err,
          ),
        );
    }
    this.notify();
  }

  // --- BORROW REQUESTS ---
  public getRequests(): BorrowRequest[] {
    const data = localStorage.getItem(STORAGE_KEYS.REQUESTS);
    return data ? JSON.parse(data) : INITIAL_REQUESTS;
  }

  public submitBorrowRequest(
    studentId: string,
    componentId: string,
    quantity: number,
    purpose: string,
    days: number = 14,
  ): BorrowRequest {
    const comps = this.getComponents();
    const comp = comps.find((c) => c.id === componentId);
    const student = this.getProfiles().find((p) => p.id === studentId);

    const reqCode = `REQ-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    const newReq: BorrowRequest = {
      id: crypto.randomUUID(),
      request_code: reqCode,
      student_id: studentId,
      student_name: student?.full_name || "N/A",
      student_register_no: student?.register_number || "N/A",
      student_email: student?.email || "N/A",
      component_id: componentId,
      component_name: comp?.name || "N/A",
      component_category: comp?.category || "Others",
      component_image: comp?.image_url,
      quantity,
      purpose,
      status: "pending",
      approved_by: undefined,
      approved_by_name: "",
      rejection_reason: "",
      requested_at: new Date().toISOString(),
      approved_at: undefined,
      expected_return_at: new Date(
        Date.now() + days * 24 * 60 * 60 * 1000,
      ).toISOString(),
      return_requested_at: undefined,
      returned_at: undefined,
      return_condition: "Good / Fully Functional",
      return_description: "",
      return_missing_details: "",
      return_damaged_details: "",
      return_remarks: "",
      created_at: new Date().toISOString(),
    };

    const requests = this.getRequests();
    requests.unshift(newReq);
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

    apiRequest("/api/requests/submit", {
      method: "POST",
      body: JSON.stringify({
        student_id: studentId,
        component_id: componentId,
        quantity,
        notes: purpose,
      }),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error("[MockEngine] Failed to submit request to backend:", err),
      );

    this.notify();
    return newReq;
  }

  public approveBorrowRequest(
    requestId: string,
    facultyId: string,
    remark?: string,
  ): BorrowRequest {
    const requests = this.getRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Request not found");

    req.status = "approved";
    req.approved_by = facultyId;
    req.approved_at = new Date().toISOString();
    req.rejection_reason = remark || "";
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

    // Deduct local component stock
    const comps = this.getComponents();
    const comp = comps.find((c) => c.id === req.component_id);
    if (comp) {
      comp.available_stock = Math.max(0, comp.available_stock - req.quantity);
      comp.borrowed_stock += req.quantity;
      localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(comps));
    }

    // Build PDF client-side and send base64 to backend for email attachment
    const processApproval = async () => {
      let pdfBase64 = "";
      try {
        const doc = await generateStudentReceiptPdf(req, false);
        pdfBase64 = doc.output("datauristring").split(",")[1];
      } catch (pdfErr) {
        console.warn(
          "[MockEngine] Failed to generate PDF for email attachment:",
          pdfErr,
        );
      }

      apiRequest(`/api/requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          reviewed_by: facultyId,
          notes: remark,
          pdf_base64: pdfBase64 || undefined,
        }),
      })
        .then(() => this.syncWithD1())
        .catch((err) =>
          console.error(
            "[MockEngine] Failed to approve request on backend:",
            err,
          ),
        );
    };

    processApproval();

    this.notify();
    return req;
  }

  public rejectBorrowRequest(
    requestId: string,
    facultyId: string,
    reason: string,
  ): BorrowRequest {
    const requests = this.getRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Request not found");

    req.status = "rejected";
    req.rejection_reason = reason;
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

    apiRequest(`/api/requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({
        reviewed_by: facultyId,
        reject_reason: reason,
      }),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error("[MockEngine] Failed to reject request on backend:", err),
      );

    this.notify();
    return req;
  }

  public requestReturnComponent(
    requestId: string,
    studentId: string,
    condition: string,
    description: string,
  ) {
    const requests = this.getRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Request not found");

    req.return_requested_at = new Date().toISOString();
    req.return_condition = condition;
    req.return_description = description;
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

    apiRequest(`/api/requests/${requestId}/return-request`, {
      method: "POST",
      body: JSON.stringify({
        student_id: studentId,
        condition,
        description,
      }),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error(
          "[MockEngine] Failed to submit return request to backend:",
          err,
        ),
      );

    this.notify();
  }

  public processReturnComponent(
    requestId: string,
    facultyId: string,
    condition: string,
    missingDetails: string,
    damagedDetails: string,
    remarks: string,
  ) {
    const requests = this.getRequests();
    const req = requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Request not found");

    req.status = "returned";
    req.returned_at = new Date().toISOString();
    req.return_condition = condition;
    req.return_remarks = remarks;
    req.return_missing_details = missingDetails;
    req.return_damaged_details = damagedDetails;
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));

    // Restore stock locally
    const comps = this.getComponents();
    const comp = comps.find((c) => c.id === req.component_id);
    if (comp) {
      comp.available_stock = Math.min(
        comp.total_stock,
        comp.available_stock + req.quantity,
      );
      comp.borrowed_stock = Math.max(0, comp.borrowed_stock - req.quantity);
      localStorage.setItem(STORAGE_KEYS.COMPONENTS, JSON.stringify(comps));
    }

    apiRequest(`/api/requests/${requestId}/return-process`, {
      method: "POST",
      body: JSON.stringify({
        reviewed_by: facultyId,
        status: "returned",
        condition,
        remarks,
        missing_details: missingDetails,
        damaged_details: damagedDetails,
      }),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error("[MockEngine] Failed to process return on backend:", err),
      );

    this.notify();
  }

  // --- PROFILES ---
  public getProfiles(): Profile[] {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
    return data ? JSON.parse(data) : INITIAL_PROFILES;
  }

  public addProfile(
    profile: Omit<Profile, "id" | "created_at" | "updated_at"> & {
      id?: string;
    },
    password?: string,
  ): Profile {
    const list = this.getProfiles();
    const newProfile: Profile = {
      ...profile,
      id: profile.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Profile;
    list.push(newProfile);
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(list));

    apiRequest("/api/profiles/sync", {
      method: "POST",
      body: JSON.stringify({
        ...newProfile,
        password: password,
      }),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error("[MockEngine] Failed to add profile to backend:", err),
      );

    this.notify();
    return newProfile;
  }

  public async updateProfile(
    id: string,
    formData: Partial<Profile>,
  ): Promise<void> {
    const list = this.getProfiles();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...formData,
        updated_at: new Date().toISOString(),
      } as Profile;
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(list));
    }

    try {
      await apiRequest(`/api/profiles/${id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });
      await this.syncWithD1();
    } catch (err) {
      console.error("[MockEngine] Failed to update profile on backend:", err);
    }
    this.notify();
  }

  public async deleteProfile(id: string): Promise<void> {
    let list = this.getProfiles();
    list = list.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(list));

    try {
      await apiRequest(`/api/profiles/${id}`, {
        method: "DELETE",
      });
      await this.syncWithD1();
    } catch (err) {
      console.error("[MockEngine] Failed to delete profile on backend:", err);
    }
    this.notify();
  }

  // --- PROCUREMENT ---
  public getPurchases(): PurchaseOrder[] {
    const data = localStorage.getItem(STORAGE_KEYS.PURCHASES);
    return data ? JSON.parse(data) : [];
  }

  public addPurchaseOrder(
    poData: Omit<
      PurchaseOrder,
      "id" | "po_number" | "status" | "purchased_at" | "created_at"
    >,
  ): PurchaseOrder {
    const purchases = this.getPurchases();
    const poNumber = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPO: PurchaseOrder = {
      ...poData,
      id: crypto.randomUUID(),
      po_number: poNumber,
      status: "delivered",
      purchased_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    purchases.unshift(newPO);
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases));

    apiRequest("/api/purchase-orders", {
      method: "POST",
      body: JSON.stringify(poData),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error(
          "[MockEngine] Failed to save purchase order to backend:",
          err,
        ),
      );

    this.notify();
    return newPO;
  }

  public async updatePurchaseOrder(
    id: string,
    poData: Partial<PurchaseOrder>,
  ): Promise<void> {
    const list = this.getPurchases();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...poData,
        total_cost:
          (poData.quantity ?? list[idx].quantity) *
          (poData.unit_cost ?? list[idx].unit_cost),
        updated_at: new Date().toISOString(),
      } as PurchaseOrder;
      localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(list));
    }

    try {
      await apiRequest(`/api/purchase-orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(poData),
      });
      await this.syncWithD1();
    } catch (err) {
      console.error(
        "[MockEngine] Failed to update purchase order on backend:",
        err,
      );
    }
    this.notify();
  }

  public async deletePurchaseOrder(id: string): Promise<void> {
    const list = this.getPurchases();
    const filtered = list.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(filtered));

    try {
      await apiRequest(`/api/purchase-orders/${id}`, {
        method: "DELETE",
      });
      await this.syncWithD1();
    } catch (err) {
      console.error(
        "[MockEngine] Failed to delete purchase order on backend:",
        err,
      );
    }
    this.notify();
  }

  // --- SYSTEM LOGS ---
  public getLogs(): [] {
    const data = localStorage.getItem(STORAGE_KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  }

  public logActivity(
    action: string,
    entity_type: string,
    entity_id: string,
    details: any,
    severity: string = "info",
  ) {
    let user_id = "system";
    let user_name = "System";
    
    if (typeof window !== "undefined") {
      const activeUserStr = localStorage.getItem("ei_hub_active_user_profile");
      if (activeUserStr) {
        try {
          const activeUser = JSON.parse(activeUserStr);
          user_id = activeUser.id || "system";
          user_name = activeUser.full_name || activeUser.name || "System";
        } catch (e) {}
      }
    }

    apiRequest("/api/activity-logs", {
      method: "POST",
      body: JSON.stringify({
        user_id,
        user_name,
        action,
        entity_type,
        entity_id,
        details,
        severity,
      }),
    })
      .then(() => this.syncWithD1())
      .catch((err) =>
        console.error("[MockEngine] Failed to log activity on backend:", err),
      );
  }

  // --- NOTIFICATIONS ---
  public getNotifications(userId?: string): NotificationItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFS);
    const list = data ? JSON.parse(data) : [];
    if (userId) {
      return list.filter((n: any) => n.user_id === userId);
    }
    return list;
  }

  public markNotificationAsRead(id: string) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFS);
    if (!data) return;
    const list: NotificationItem[] = JSON.parse(data);
    const notif = list.find((n) => n.id === id);
    if (notif) {
      notif.is_read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(list));

      apiRequest(`/api/notifications/${id}/read`, {
        method: "PUT",
      })
        .then(() => this.syncWithD1())
        .catch((err) =>
          console.error(
            "[MockEngine] Failed to mark notification read on backend:",
            err,
          ),
        );

      this.notify();
    }
  }

  public async checkForDeadlineReminders() {
    const token = localStorage.getItem("ei_hub_auth_token");
    if (!token) return;
    
    try {
      await apiRequest("/api/cron/check-reminders", {
        method: "POST",
      });
      await this.syncWithD1();
    } catch (e) {
      console.error(
        "[MockEngine] Failed to run deadline reminders check on backend:",
        e,
      );
    }
  }

  // --- STATS OVERVIEW ---

  public getSystemStats(): SystemOverviewStats {
    const profiles = this.getProfiles();
    const components = this.getComponents();
    const requests = this.getRequests();
    const purchases = this.getPurchases();

    const totalStudents = profiles.filter((p) => p.role === "student").length;
    const totalFaculty = profiles.filter((p) => p.role === "faculty").length;
    const totalAdmins = profiles.filter((p) => p.role === "admin").length;

    const availableStock = components.reduce(
      (acc, c) => acc + c.available_stock,
      0,
    );
    const borrowedStock = components.reduce(
      (acc, c) => acc + c.borrowed_stock,
      0,
    );
    const lowStockItemsCount = components.filter(
      (c) => c.available_stock > 0 && c.available_stock <= 5,
    ).length;
    const outOfStockItemsCount = components.filter(
      (c) => c.available_stock === 0,
    ).length;

    const pendingRequestsCount = requests.filter(
      (r) => r.status === "pending",
    ).length;
    const pendingReturnsCount = requests.filter(
      (r) => r.return_requested_at && r.status !== "returned",
    ).length;
    const activeLoansCount = requests.filter(
      (r) => r.status === "approved" && !r.returned_at,
    ).length;

    return {
      totalUsers: profiles.length,
      totalStudents,
      totalFaculty,
      totalAdmins,
      totalComponents: components.reduce((acc, c) => acc + c.total_stock, 0),
      availableStock,
      borrowedStock,
      lowStockItemsCount,
      outOfStockItemsCount,
      pendingRequestsCount,
      pendingReturnsCount,
      activeLoansCount,
      totalPurchasesCount: purchases.length,
    };
  }
}

export const mockEngine = new MockEngine();
