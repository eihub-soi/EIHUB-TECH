import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorVariant?: "indigo" | "emerald" | "amber" | "rose" | "gold";
  trend?: {
    value: string;
    isPositive: boolean;
  };
  roleTheme?: "student" | "faculty" | "admin";
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorVariant = "indigo",
  trend,
  roleTheme,
}) => {
  const roleStyles = {
    student: {
      cardClass: "bg-white border border-slate-200/80 border-t-2 border-t-blue-500/60 hover:border-blue-400 hover:border-t-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden",
      iconContainer: "bg-blue-50 text-blue-600 border border-blue-100",
    },
    faculty: {
      cardClass: "bg-white border border-slate-200/80 border-t-2 border-t-green-500/60 hover:border-green-400 hover:border-t-green-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden",
      iconContainer: "bg-green-50 text-green-600 border border-green-100",
    },
    admin: {
      cardClass: "bg-white border border-slate-200/80 border-t-2 border-t-purple-400/60 hover:border-purple-400 hover:border-t-purple-600 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden",
      iconContainer: "bg-purple-50 text-purple-600 border border-purple-100",
    },
  };

  const colorStyles = {
    indigo: {
      bg: "from-indigo-600/10 to-indigo-900/20 border-[#60A5FA] hover:border-[#60A5FA]",
      iconBg: "bg-[#E6F0FF] text-blue-900",
      glow: "",
    },
    emerald: {
      bg: "from-emerald-600/10 to-emerald-900/20 border-emerald-500/20 hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/20 text-emerald-900",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
    },
    amber: {
      bg: "from-amber-600/10 to-amber-900/20 border-amber-500/20 hover:border-amber-500/40",
      iconBg: "bg-amber-500/20 text-amber-900",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    },
    rose: {
      bg: "from-rose-600/10 to-rose-900/20 border-rose-500/20 hover:border-rose-500/40",
      iconBg: "bg-rose-500/20 text-rose-900",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    },
    gold: {
      bg: "from-amber-500/10 to-gold-600/20 border-gold-500/20 hover:border-gold-500/40",
      iconBg: "bg-gold-500/20 text-amber-900",
      glow: "",
    },
  };

  if (roleTheme) {
    const style = roleStyles[roleTheme];
    return (
      <div className={style.cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-700">{title}</p>
            <h3 className="text-2xl lg:text-3xl font-extrabold text-black mt-1 tracking-tight">
              {value}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-gray-500 mt-1 font-medium">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    trend.isPositive
                      ? "bg-emerald-500/20 text-emerald-900"
                      : "bg-rose-500/20 text-rose-900"
                  }`}
                >
                  {trend.value}
                </span>
                <span className="text-[10px] text-gray-700">vs last week</span>
              </div>
            )}
          </div>
          <div
            className={`w-12 h-12 rounded-2xl ${style.iconContainer} flex items-center justify-center shrink-0`}
          >
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    );
  }

  const currentStyle = colorStyles[colorVariant];

  return (
    <div
      className={`p-5 rounded-3xl bg-gradient-to-br ${currentStyle.bg} border transition-all duration-300 hover:-translate-y-1 ${currentStyle.glow}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-700">{title}</p>
          <h3 className="text-2xl lg:text-3xl font-extrabold text-black mt-1 tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-gray-700 mt-1 font-medium">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend.isPositive ? "bg-emerald-500/20 text-emerald-900" : "bg-rose-500/20 text-rose-900"}`}
              >
                {trend.value}
              </span>
              <span className="text-[10px] text-gray-700">vs last week</span>
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-2xl ${currentStyle.iconBg} flex items-center justify-center border border-[#E5E7EB] shrink-0`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
