import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Avatar } from "../../components/common/Avatar";
import {
  Mail,
  GraduationCap,
  ShieldCheck,
  Phone,
  ShieldAlert,
  User,
} from "lucide-react";

export const StudentProfile: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-black tracking-tight">
          {user.role === "student"
            ? "Student Profile"
            : user.role === "faculty"
              ? "Faculty Profile"
              : "Administrator Profile"}
        </h1>
        <p className="text-xs text-gray-700 mt-0.5">
          Manage your lab identification credentials and contact details
        </p>
      </div>

      <div className="p-6 rounded-3xl glass-card border border-[#E5E7EB] space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 border-b border-[#E5E7EB] pb-6 text-center sm:text-left">
          <Avatar user={user} size="xl" className="" alt={user.full_name} />
          <div>
            <h2 className="text-xl font-bold text-black">{user.full_name}</h2>
            {user.role === "student" && (
              <p className="text-xs text-gray-700 font-mono mt-0.5">
                Reg No: {user.register_number || "N/A"}
              </p>
            )}
            {user.role === "faculty" && (
              <p className="text-xs text-gray-700 font-mono mt-0.5">
                Faculty ID: {user.id.slice(0, 8).toUpperCase()}
              </p>
            )}
            <span className="mt-2 inline-block px-3 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F0FF] text-indigo-900 border border-[#60A5FA]">
              Department of{" "}
              {user.department || "Electronics & Instrumentation (EIE)"}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-indigo-950/20 border border-[#60A5FA] text-[10px] text-gray-700 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
          <p>
            For security, core identification details (Name, Department, Role,
            and ID) are synchronized with institutional directories and cannot
            be modified. You may only manage your contact mobile number.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Email Address - Static */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-900" /> Email Address
            </p>
            <p className="font-semibold text-black">{user.email || "N/A"}</p>
          </div>

          {/* Mobile Number - Read-Only */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-900" /> Mobile Number
            </p>
            <p className="font-semibold text-black">
              {user.phone || "No mobile number added"}
            </p>
          </div>

          {/* Username - Read-Only */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-900" /> Username
            </p>
            <p className="font-semibold text-black">
              {user.username || user.email}
            </p>
          </div>

          {/* Role Privilege */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-900" /> Role
              Privilege
            </p>
            <p className="font-semibold text-black capitalize">{user.role}</p>
          </div>

          {/* Department */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-900" />{" "}
              Department
            </p>
            <p className="font-semibold text-black">
              {user.department || "Electronics & Instrumentation (EIE)"}
            </p>
          </div>

          {/* Institution */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-900" />{" "}
              Institution / College
            </p>
            <p className="font-semibold text-black">
              {user.institution || "KGISL Institute of Technology"}
            </p>
          </div>

          {/* Account Status */}
          <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
            <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
              <ShieldCheck
                className={`w-3.5 h-3.5 ${user.is_active ? "text-emerald-900" : "text-rose-900"}`}
              />{" "}
              Account Status
            </p>
            <p
              className={`font-semibold ${user.is_active ? "text-emerald-900" : "text-rose-900"}`}
            >
              {user.is_active ? "Verified & Active" : "Suspended"}
            </p>
          </div>

          {user.role === "student" && (
            <>
              {/* Register Number */}
              <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
                <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-900" />{" "}
                  Register Number
                </p>
                <p className="font-semibold text-black font-mono">
                  {user.register_number || "N/A"}
                </p>
              </div>

              {/* Roll Number */}
              <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
                <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-900" /> Roll
                  Number
                </p>
                <p className="font-semibold text-black font-mono">
                  {user.roll_number || "N/A"}
                </p>
              </div>
            </>
          )}

          {user.role === "faculty" && (
            <div className="p-4 rounded-2xl bg-white border border-white/5 space-y-1">
              <p className="text-gray-700 text-[10px] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-900" /> Faculty
                ID
              </p>
              <p className="font-semibold text-black font-mono">
                {user.faculty_id || "N/A"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
