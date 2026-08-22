import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { LandingPage } from "../pages/LandingPage";

// Student Pages
import { StudentDashboard } from "../pages/student/StudentDashboard";
import { BrowseComponents } from "../pages/student/BrowseComponents";
import { MyRequests } from "../pages/student/MyRequests";
import { ReturnPortal } from "../pages/student/ReturnPortal";
import { StudentProfile } from "../pages/student/StudentProfile";
import { StudentNotifications } from "../pages/student/StudentNotifications";
import { CartPage } from "../pages/student/CartPage";

// Faculty Pages
import { FacultyDashboard } from "../pages/faculty/FacultyDashboard";
import { InventoryManagement } from "../pages/faculty/InventoryManagement";
import { PendingRequests } from "../pages/faculty/PendingRequests";
import { ReturnApprovals } from "../pages/faculty/ReturnApprovals";
import { ApprovalHistory } from "../pages/faculty/ApprovalHistory";

import { PurchaseOrders } from "../pages/faculty/PurchaseOrders";

import { AdminDashboard } from "../pages/admin/AdminDashboard";
import { UserManagement } from "../pages/admin/UserManagement";
import { ReportsAnalytics } from "../pages/admin/ReportsAnalytics";

import { SystemSettings } from "../pages/admin/SystemSettings";
import { ImportManager } from "../pages/admin/ImportManager";
import { LoginPage } from "../pages/LoginPage";
import { EmailSendingPage } from "../pages/admin/EmailSendingPage";
import { VerifyReceipt } from "../pages/VerifyReceipt";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";

import { ProtectedRoute } from "../components/routes/ProtectedRoute";

export const AppRoutes: React.FC = () => {
  return (
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
  );
};
