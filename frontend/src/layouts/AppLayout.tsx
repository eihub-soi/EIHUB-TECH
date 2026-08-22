import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "../components/common/Navbar";
import { Sidebar } from "../components/common/Sidebar";
import { CommandPalette } from "../components/common/CommandPalette";
import { Toaster } from "sonner";
import { useEscapeKey } from "../hooks/useEscapeKey";

export const AppLayout: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEscapeKey(() => setIsSidebarOpen(false), isSidebarOpen && isMobile);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-black flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notifications Provider */}
      <Toaster position="top-right" theme="dark" richColors />

      {/* Top Navbar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 top-[65px] z-20 bg-white lg:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => {
            if (window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
        />

        {/* Dynamic Page Workspace View */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-[1600px] mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
};
