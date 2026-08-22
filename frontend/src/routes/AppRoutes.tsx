import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { ProtectedRoute } from "../components/routes/ProtectedRoute";

// Lazy-load other pages to code-split the application
const ForgotPasswordPage = lazy(() =>
  import("../pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import("../pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);
const VerifyReceipt = lazy(() =>
  import("../pages/VerifyReceipt").then((m) => ({ default: m.VerifyReceipt }))
);

// Student Pages
const StudentDashboard = lazy(() =>
  import("../pages/student/StudentDashboard").then((m) => ({ default: m.StudentDashboard }))
);
const BrowseComponents = lazy(() =>
  import("../pages/student/BrowseComponents").then((m) => ({ default: m.BrowseComponents }))
);
const CartPage = lazy(() =>
  import("../pages/student/CartPage").then((m) => ({ default: m.CartPage }))
);
const MyRequests = lazy(() =>
  import("../pages/student/MyRequests").then((m) => ({ default: m.MyRequests }))
);
const ReturnPortal = lazy(() =>
  import("../pages/student/ReturnPortal").then((m) => ({ default: m.ReturnPortal }))
);
const StudentNotifications = lazy(() =>
  import("../pages/student/StudentNotifications").then((m) => ({ default: m.StudentNotifications }))
);
const StudentProfile = lazy(() =>
  import("../pages/student/StudentProfile").then((m) => ({ default: m.StudentProfile }))
);

// Faculty Pages
const FacultyDashboard = lazy(() =>
  import("../pages/faculty/FacultyDashboard").then((m) => ({ default: m.FacultyDashboard }))
);
const PendingRequests = lazy(() =>
  import("../pages/faculty/PendingRequests").then((m) => ({ default: m.PendingRequests }))
);
const ReturnApprovals = lazy(() =>
  import("../pages/faculty/ReturnApprovals").then((m) => ({ default: m.ReturnApprovals }))
);
const ApprovalHistory = lazy(() =>
  import("../pages/faculty/ApprovalHistory").then((m) => ({ default: m.ApprovalHistory }))
);
const InventoryManagement = lazy(() =>
  import("../pages/faculty/InventoryManagement").then((m) => ({ default: m.InventoryManagement }))
);
const PurchaseOrders = lazy(() =>
  import("../pages/faculty/PurchaseOrders").then((m) => ({ default: m.PurchaseOrders }))
);

// Admin Pages
const AdminDashboard = lazy(() =>
  import("../pages/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
const UserManagement = lazy(() =>
  import("../pages/admin/UserManagement").then((m) => ({ default: m.UserManagement }))
);
const ReportsAnalytics = lazy(() =>
  import("../pages/admin/ReportsAnalytics").then((m) => ({ default: m.ReportsAnalytics }))
);
const EmailSendingPage = lazy(() =>
  import("../pages/admin/EmailSendingPage").then((m) => ({ default: m.EmailSendingPage }))
);
const SystemSettings = lazy(() =>
  import("../pages/admin/SystemSettings").then((m) => ({ default: m.SystemSettings }))
);
const ImportManager = lazy(() =>
  import("../pages/admin/ImportManager").then((m) => ({ default: m.ImportManager }))
);

// Styled Loading Spinner Fallback Matching the Premium Theme
const LoadingFallback = () => (
  <div className="min-h-screen bg-[#0B132B] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Direct Login Page */}
        <Route path="/" element={<LoginPage />} />

        {/* Password Reset Request Page */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Password Reset landing code handler */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Public Receipt Verification */}
        <Route path="/verify-receipt/:requestCode" element={<VerifyReceipt />} />

        {/* Student Protected Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="browse" element={<BrowseComponents />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="requests" element={<MyRequests />} />
          <Route path="return" element={<ReturnPortal />} />
          <Route path="history" element={<MyRequests />} />
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        {/* Faculty Protected Routes */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/faculty/dashboard" replace />} />
          <Route path="dashboard" element={<FacultyDashboard />} />
          <Route path="pending-requests" element={<PendingRequests />} />
          <Route path="return-approvals" element={<ReturnApprovals />} />
          <Route path="approval-history" element={<ApprovalHistory />} />
          <Route path="inventory" element={<InventoryManagement />} />
          <Route path="purchases" element={<PurchaseOrders />} />
          <Route path="reports" element={<ReportsAnalytics />} />
          <Route path="reports/email" element={<EmailSendingPage />} />
          <Route path="imports" element={<ImportManager />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="pending-requests" element={<PendingRequests />} />
          <Route path="return-approvals" element={<ReturnApprovals />} />
          <Route path="approval-history" element={<ApprovalHistory />} />
          <Route path="inventory" element={<InventoryManagement />} />
          <Route path="purchases" element={<PurchaseOrders />} />
          <Route path="reports" element={<ReportsAnalytics />} />
          <Route path="reports/email" element={<EmailSendingPage />} />
          <Route path="requests" element={<PendingRequests />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="imports" element={<ImportManager />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        {/* Catch-all redirect to Landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};
