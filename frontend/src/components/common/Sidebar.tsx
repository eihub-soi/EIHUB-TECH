import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { mockEngine } from "../../services/mockEngine";
import { Avatar } from "./Avatar";
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  RotateCcw,
  History,
  Bell,
  User,
  HelpCircle,
  LogOut,
  FileText,
  Activity,
  Users,
  ShieldCheck,
  Settings,
  Sparkles,
  Layers,
  ShoppingBag,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || "student";

  const userCardStyles = {
    student: {
      bg: "bg-[#E6F0FF] hover:bg-[#D6E4FF]",
      border: "border-[#2563EB]/30",
      avatarBg: "bg-[#2563EB]/10",
      text: "text-[#2563EB]",
    },
    faculty: {
      bg: "bg-[#E8F8F3] hover:bg-[#D1FAE5]",
      border: "border-[#10B981]/30",
      avatarBg: "bg-[#10B981]/10",
      text: "text-[#10B981]",
    },
    admin: {
      bg: "bg-[#F1EEFF] hover:bg-[#E9E4FF]",
      border: "border-[#7C3AED]/30",
      avatarBg: "bg-[#7C3AED]/10",
      text: "text-[#7C3AED]",
    },
  }[role];

  const getNavLinkClass = (isActive: boolean, isJustifyBetween = false) => {
    const displayClass = isJustifyBetween ? "flex items-center justify-between" : "flex items-center gap-3";
    const baseClass = `${displayClass} px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all`;
    if (!isActive) {
      return `${baseClass} text-gray-700 hover:text-black hover:bg-white`;
    }
    
    if (role === "student") {
      return `${baseClass} bg-[#E6F0FF] text-[#000000] hover:bg-[#D6E4FF] shadow-sm`;
    } else if (role === "faculty") {
      return `${baseClass} bg-[#E8F8F3] text-[#000000] hover:bg-[#D1FAE5] shadow-sm`;
    } else {
      return `${baseClass} bg-[#F1EEFF] text-[#000000] hover:bg-[#E9E4FF] shadow-sm`;
    }
  };

  const requests = mockEngine.getRequests();
  const pendingRequestsCount = requests.filter(
    (r) => r.status === "pending",
  ).length;
  const notifications = user ? mockEngine.getNotifications(user.id) : [];
  const unreadNotifsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <aside
      className={`glass-panel flex flex-col justify-between min-h-[calc(100vh-65px)] transition-all duration-300 shrink-0 
 ${
   isOpen
     ? "fixed inset-y-[65px] left-0 z-30 w-64 p-4 opacity-100 translate-x-0 bg-white/95 border-r border-[#E5E7EB] lg:relative lg:inset-auto lg:z-0 lg:bg-transparent lg:translate-x-0 lg:w-64 lg:p-4 lg:opacity-100 lg:pointer-events-auto lg:border-r lg:border-[#E5E7EB] lg:flex"
     : "fixed inset-y-[65px] left-0 z-30 w-0 p-0 opacity-0 -translate-x-full pointer-events-none overflow-hidden border-r-0 lg:relative lg:inset-auto lg:z-0 lg:bg-transparent lg:-translate-x-full lg:opacity-0 lg:pointer-events-none lg:w-0 lg:p-0 lg:overflow-hidden lg:border-r-0 lg:hidden"
 }
 `}
    >
      <div className="space-y-6">
        {/* User Card matching UI image preview */}
        <div className={`flex items-center gap-3 p-3 rounded-2xl ${userCardStyles.bg} border ${userCardStyles.border} shadow-sm transition-colors`}>
          <div className={`p-0.5 rounded-full ${userCardStyles.avatarBg}`}>
            <Avatar
              user={user}
              size="md"
              className=""
              alt={user?.full_name}
            />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-xs font-bold text-[#111827] truncate">
              {user?.full_name}
            </h3>
            <p className={`text-[10px] ${userCardStyles.text} capitalize font-bold tracking-wide`}>
              {user?.role} Mode
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1" onClick={onClose}>
          {/* STUDENT MENU */}
          {role === "student" && (
            <>
              <NavLink
                to="/student/dashboard"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/student/browse"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Boxes className="w-4 h-4" />
                <span>Browse Components</span>
              </NavLink>

              <NavLink
                to="/student/cart"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Requirements Cart</span>
              </NavLink>

              <NavLink
                to="/student/requests"
                className={({ isActive }) => getNavLinkClass(isActive, true)}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-4 h-4" />
                  <span>My Requests</span>
                </div>
              </NavLink>

              <NavLink
                to="/student/return"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return Portal</span>
              </NavLink>

              <NavLink
                to="/student/history"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <History className="w-4 h-4" />
                <span>History</span>
              </NavLink>

              {unreadNotifsCount > 0 && (
                <NavLink
                  to="/student/notifications"
                  className={({ isActive }) => getNavLinkClass(isActive, true)}
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4" />
                    <span>Notifications</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#60A5FA] text-black">
                    {unreadNotifsCount}
                  </span>
                </NavLink>
              )}

              <NavLink
                to="/student/profile"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </NavLink>
            </>
          )}

          {/* FACULTY MENU */}
          {role === "faculty" && (
            <>
              <NavLink
                to="/faculty/dashboard"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </NavLink>

              <NavLink
                to="/faculty/pending-requests"
                className={({ isActive }) => getNavLinkClass(isActive, true)}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-4 h-4" />
                  <span>Pending Requests</span>
                </div>
                {pendingRequestsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {pendingRequestsCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/faculty/return-approvals"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return Approvals</span>
              </NavLink>

              <NavLink
                to="/faculty/approval-history"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <History className="w-4 h-4" />
                <span>Approval History</span>
              </NavLink>

              <NavLink
                to="/faculty/inventory"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Boxes className="w-4 h-4" />
                <span>Inventory</span>
              </NavLink>

              <NavLink
                to="/faculty/purchases"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Stock Purchases</span>
              </NavLink>

              <NavLink
                to="/faculty/reports"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <FileText className="w-4 h-4" />
                <span>Reports</span>
              </NavLink>



              <NavLink
                to="/faculty/profile"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </NavLink>
            </>
          )}

          {/* ADMIN MENU */}
          {role === "admin" && (
            <>
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </NavLink>

              <NavLink
                to="/admin/users"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Users className="w-4 h-4" />
                <span>User Management</span>
              </NavLink>

              <NavLink
                to="/admin/inventory"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Boxes className="w-4 h-4" />
                <span>Inventory Management</span>
              </NavLink>

              <NavLink
                to="/admin/purchases"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Stock Purchases</span>
              </NavLink>

              <NavLink
                to="/admin/pending-requests"
                className={({ isActive }) => getNavLinkClass(isActive, true)}
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-4 h-4" />
                  <span>Pending Requests</span>
                </div>
                {pendingRequestsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {pendingRequestsCount}
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/admin/return-approvals"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Return Approvals</span>
              </NavLink>

              <NavLink
                to="/admin/approval-history"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <History className="w-4 h-4" />
                <span>Approval History</span>
              </NavLink>

              <NavLink
                to="/admin/reports"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <FileText className="w-4 h-4" />
                <span>Reports & Analytics</span>
              </NavLink>


              <NavLink
                to="/admin/settings"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Settings className="w-4 h-4" />
                <span>System Settings</span>
              </NavLink>

              <NavLink
                to="/admin/profile"
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <User className="w-4 h-4" />
                <span>Profile</span>
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* Logout Action */}
      <div className="pt-4 border-t border-[#E5E7EB]">
        <button
          onClick={() => {
            onClose?.();
            logout();
            navigate("/");
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-rose-900 hover:bg-rose-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
