import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { UserRole } from "../../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, role, isLoading } = useAuth();

  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#0066FF] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#687280] font-medium text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If active user role is not allowed for this route group, redirect to their own home dashboard
  if (!allowedRoles.includes(role)) {
    if (role === "student") return <Navigate to="/student/dashboard" replace />;
    if (role === "faculty") return <Navigate to="/faculty/dashboard" replace />;
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};
