import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { UserRole } from "../../types";
import { mockEngine } from "../../services/mockEngine";
import { Avatar } from "./Avatar";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  formatTimestamp,
  parseUTCDate,
  formatTimeOnly,
} from "../../utils/timestamp";
import {
  Bell,
  Search,
  User,
  LogOut,
  Shield,
  GraduationCap,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Menu,
  Clock,
} from "lucide-react";

interface NavbarProps {
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onToggleSidebar,
}) => {
  const { user, role, switchRole, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setShowNotifications(false), showNotifications);
  useEscapeKey(() => setShowProfileMenu(false), showProfileMenu);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const rawNotifications = user ? mockEngine.getNotifications(user.id) : [];
  const notifications = [...rawNotifications].sort((a, b) => {
    return (
      parseUTCDate(b.created_at).getTime() -
      parseUTCDate(a.created_at).getTime()
    );
  });
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const currentTime = useCurrentTime();

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-[#E5E7EB] px-4 lg:px-8 py-3 transition-all duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#60A5FA] text-black hover:text-black transition-all flex items-center justify-center shrink-0"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Title (Mobile/Top Bar) */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0 min-w-max"
            onClick={() => navigate("/")}
          >
            <img
              src="/logo.png"
              alt="EI HUB Logo"
              className="w-10 h-10 rounded-2xl object-contain bg-white p-0.5 shrink-0"
            />
            <div className="shrink-0 min-w-max">
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-extrabold text-lg tracking-tight text-black">
                  EI HUB
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F0FF] text-indigo-900 border border-[#60A5FA] shrink-0">
                  School of Innovation
                </span>
              </div>
              <p className="text-[9px] font-extrabold text-blue-900 uppercase tracking-widest leading-none mt-0.5 hidden sm:block shrink-0">
                Innovate • Invent • Inspire
              </p>
              <p className="text-[10px] text-gray-700 mt-0.5 hidden sm:block shrink-0">
                KGISL Institute of Technology
              </p>
            </div>
          </div>
        </div>

        {/* Global Search Quick Trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-[#E5E7EB] text-gray-700 hover:text-black hover:border-[#60A5FA] transition-all text-xs w-64 lg:w-96 shadow-inner"
        >
          <Search className="w-4 h-4 text-gray-700" />
          <span className="flex-1 text-left">
            Search components, requests...
          </span>
          <kbd className="px-2 py-0.5 rounded bg-white text-[10px] text-black border border-[#E5E7EB]">
            ⌘K
          </kbd>
        </button>

        {/* Right Section: Role Quick Switcher, Notifications, User Menu */}
        <div className="flex items-center gap-3">
          {/* Real-time Clock Widget */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-[#E5E7EB] text-xs font-semibold text-black font-mono shadow-inner">
            <Clock className="w-3.5 h-3.5 text-blue-900 animate-pulse" />
            <span>{formatTimestamp(currentTime)}</span>
          </div>

          {/* Active Role Badge (Strict Isolated Role Display) */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 rounded-2xl bg-white border border-[#E5E7EB] text-xs font-bold shrink-0">
            {role === "student" && (
              <span className="flex items-center gap-1.5 text-indigo-900">
                <GraduationCap className="w-4 h-4 text-blue-900" />
                <span className="hidden sm:inline">Student Portal</span>
              </span>
            )}
            {role === "faculty" && (
              <span className="flex items-center gap-1.5 text-emerald-900">
                <Briefcase className="w-4 h-4 text-emerald-900" />
                <span className="hidden sm:inline">Faculty Portal</span>
              </span>
            )}
            {role === "admin" && (
              <span className="flex items-center gap-1.5 text-amber-900">
                <Shield className="w-4 h-4 text-amber-900" />
                <span className="hidden sm:inline">Admin Console</span>
              </span>
            )}
          </div>

          {/* Notifications Drawer Toggle */}
          {unreadCount > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#60A5FA] text-black hover:text-black transition-all"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-black text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 glass-card p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                    <h4 className="font-semibold text-sm text-black flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-900" /> Notifications
                    </h4>
                    <span className="text-[11px] text-gray-700">
                      {notifications.length} Total
                    </span>
                  </div>
                  <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-700 text-center py-6">
                        No notifications
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() =>
                            mockEngine.markNotificationAsRead(n.id)
                          }
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            n.is_read
                              ? "bg-white border-white/5 opacity-70"
                              : "bg-indigo-950/40 border-[#60A5FA] hover:border-[#60A5FA]"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {n.type === "success" && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-900 shrink-0 mt-0.5" />
                            )}
                            {n.type === "warning" && (
                              <AlertTriangle className="w-4 h-4 text-amber-900 shrink-0 mt-0.5" />
                            )}
                            {n.type === "info" && (
                              <Info className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="font-semibold text-black">
                                {n.title}
                              </p>
                              <p className="text-gray-700 text-[11px] mt-0.5">
                                {n.message}
                              </p>
                              <span className="text-[10px] text-black0 block mt-1">
                                {formatTimeOnly(n.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Profile Dropdown */}
          <div ref={profileMenuRef} className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#60A5FA] transition-all"
            >
              <Avatar
                user={user}
                size="sm"
                className=""
                alt={user?.full_name}
              />
              <span className="text-xs font-semibold text-black hidden lg:inline">
                {user?.full_name}
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-60 glass-card p-3 z-50">
                <div className="p-2 border-b border-[#E5E7EB] mb-2">
                  <p className="text-xs font-bold text-black">
                    {user?.full_name}
                  </p>
                  <p className="text-[11px] text-gray-700">{user?.email}</p>
                  <span className="mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[#E6F0FF] text-indigo-900">
                    {user?.role} Mode
                  </span>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-900 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
