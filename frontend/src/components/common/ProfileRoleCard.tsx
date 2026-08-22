import React from 'react';
import { RoleAvatar } from './RoleAvatar';
import { GraduationCap, Shield, LogIn } from 'lucide-react';

interface ProfileRoleCardProps {
  role: 'student' | 'faculty' | 'admin';
  fullName?: string;
  department?: string;
  yearOfStudy?: string;
  email?: string;
  identifier?: string; // Roll number or Employee ID
  mode?: 'select' | 'profile';
  selected?: boolean;
  onClick?: () => void;
}

export const ProfileRoleCard: React.FC<ProfileRoleCardProps> = ({
  role,
  fullName = '',
  department = '',
  yearOfStudy = '',
  email = '',
  identifier = '',
  mode = 'profile',
  selected = false,
  onClick,
}) => {
  const themes = {
    student: {
      text: 'text-[#1E3A8A]',
      badgeBg: 'bg-[#E0EBFC]',
      badgeText: 'text-[#2563EB]',
      border: 'border-[#2563EB]',
      bgSelected: 'bg-[#2563EB]/5 hover:bg-[#2563EB]/10',
      bgHover: 'hover:bg-slate-50',
      badgeIcon: <GraduationCap className="w-3.5 h-3.5" />,
      badgeLabel: 'STUDENT',
    },
    admin: {
      text: 'text-[#5B21B6]',
      badgeBg: 'bg-[#EDE9FE]',
      badgeText: 'text-[#7C3AED]',
      border: 'border-[#7C3AED]',
      bgSelected: 'bg-[#7C3AED]/5 hover:bg-[#7C3AED]/10',
      bgHover: 'hover:bg-slate-50',
      badgeIcon: <Shield className="w-3.5 h-3.5" />,
      badgeLabel: 'ADMIN',
    },
    faculty: {
      text: 'text-[#065F46]',
      badgeBg: 'bg-[#E6F4EA]',
      badgeText: 'text-[#16A34A]',
      border: 'border-[#16A34A]',
      bgSelected: 'bg-[#16A34A]/5 hover:bg-[#16A34A]/10',
      bgHover: 'hover:bg-slate-50',
      badgeIcon: <LogIn className="w-3.5 h-3.5" />,
      badgeLabel: 'FACULTY',
    },
  };

  const theme = themes[role] || themes.student;

  if (mode === 'select') {
    return (
      <div
        onClick={onClick}
        className={`bg-white border rounded-3xl p-6 flex flex-col items-center justify-center space-y-4 text-center cursor-pointer shadow-sm hover:shadow-xl hover:scale-[1.03] transition-all duration-300 ease-out group ${
          selected
            ? `${theme.border} ${theme.bgSelected} ring-1 ${theme.border}/20`
            : `border-slate-200/80 ${theme.bgHover}`
        }`}
      >
        <RoleAvatar role={role} size="lg" />
        <span className={`text-lg font-bold tracking-tight transition-colors duration-300 ${theme.text}`}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
        <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold ${theme.badgeBg} ${theme.badgeText} shadow-sm transition-all duration-300`}>
          {theme.badgeIcon}
          <span>{theme.badgeLabel}</span>
        </div>
      </div>
    );
  }

  // Profile Dashboard Header Mode
  return (
    <div className={`bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 ease-out flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8`}>
      {/* Left Column: Avatar & Role Details */}
      <div className="flex flex-col items-center text-center md:items-start md:text-left space-y-3 min-w-[150px]">
        <RoleAvatar role={role} size="xl" className="shadow-inner" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-tight">{fullName || 'User Name'}</h2>
          <div className="flex items-center justify-center md:justify-start">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase ${theme.badgeBg} ${theme.badgeText} border border-transparent`}>
              {theme.badgeIcon}
              <span>{theme.badgeLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Grid table containing parameters */}
      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Email Parameter */}
        <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-3 rounded-2xl transition-all duration-200 flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email Address</span>
          <span className="text-xs font-semibold text-slate-700 truncate">{email || 'Not specified'}</span>
        </div>

        {/* Department Parameter */}
        <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-3 rounded-2xl transition-all duration-200 flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Department</span>
          <span className="text-xs font-semibold text-slate-700 truncate">{department || 'Not specified'}</span>
        </div>

        {/* Identifier Parameter (Roll No or Employee ID) */}
        <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-3 rounded-2xl transition-all duration-200 flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {role === 'student' ? 'Roll Number' : 'Employee ID'}
          </span>
          <span className="text-xs font-semibold text-slate-700 truncate">{identifier || 'Not specified'}</span>
        </div>

        {/* Year of Study Parameter (Student only) */}
        {role === 'student' && (
          <div className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 p-3 rounded-2xl transition-all duration-200 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Year of Study</span>
            <span className="text-xs font-semibold text-slate-700 truncate">{yearOfStudy || 'Not specified'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
