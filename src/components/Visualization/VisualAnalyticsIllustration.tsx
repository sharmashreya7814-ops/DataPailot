import React from 'react';

export const VisualAnalyticsIllustration: React.FC = () => {
  return (
    <div
      className="relative w-64 h-44 sm:w-72 sm:h-48 mx-auto mb-6 flex items-center justify-center select-none"
      aria-hidden="true"
    >
      {/* Ambient background glow */}
      <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-emerald-500/15 rounded-3xl blur-xl" />

      {/* Main analytics board card */}
      <div className="relative w-full h-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-sm flex flex-col justify-between overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b22_1px,transparent_1px),linear-gradient(to_bottom,#1e293b22_1px,transparent_1px)] bg-[size:16px_16px]" />

        {/* Top Header: Indicators & Mini Donut Chart */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-mono font-medium text-slate-400 ml-1 tracking-wider uppercase">
              Visual Insights
            </span>
          </div>

          {/* Mini Pie / Donut Chart representation */}
          <div className="relative w-7 h-7 flex items-center justify-center" title="Pie/Donut segment">
            <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
              <circle cx="16" cy="16" r="11" fill="none" stroke="#1e293b" strokeWidth="3.5" />
              {/* Indigo segment */}
              <circle
                cx="16"
                cy="16"
                r="11"
                fill="none"
                stroke="#6366f1"
                strokeWidth="3.5"
                strokeDasharray="30 100"
                strokeLinecap="round"
              />
              {/* Emerald segment */}
              <circle
                cx="16"
                cy="16"
                r="11"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeDasharray="22 100"
                strokeDashoffset="-32"
                strokeLinecap="round"
              />
              {/* Cyan segment */}
              <circle
                cx="16"
                cy="16"
                r="11"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="3.5"
                strokeDasharray="16 100"
                strokeDashoffset="-56"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
          </div>
        </div>

        {/* Center Canvas: Bar Chart + Trend Line + Glowing Data Points */}
        <div className="relative z-10 h-24 w-full flex items-end justify-around px-2 pt-2">
          {/* Subtle horizontal grid lines */}
          <div className="absolute inset-x-0 top-3 h-px bg-slate-800/60" />
          <div className="absolute inset-x-0 top-10 h-px bg-slate-800/40" />
          <div className="absolute inset-x-0 top-18 h-px bg-slate-800/30" />

          {/* Bar 1 (Indigo) */}
          <div className="flex flex-col items-center space-y-1 z-10">
            <div className="w-6 h-10 rounded-t-md bg-gradient-to-t from-indigo-700/50 to-indigo-500 border-t border-x border-indigo-400/50 shadow-sm shadow-indigo-500/20" />
            <span className="w-4 h-0.5 rounded bg-slate-800" />
          </div>

          {/* Bar 2 (Purple) */}
          <div className="flex flex-col items-center space-y-1 z-10">
            <div className="w-6 h-16 rounded-t-md bg-gradient-to-t from-purple-700/50 to-purple-500 border-t border-x border-purple-400/50 shadow-sm shadow-purple-500/20" />
            <span className="w-4 h-0.5 rounded bg-slate-800" />
          </div>

          {/* Bar 3 (Cyan) */}
          <div className="flex flex-col items-center space-y-1 z-10">
            <div className="w-6 h-12 rounded-t-md bg-gradient-to-t from-cyan-700/50 to-cyan-500 border-t border-x border-cyan-400/50 shadow-sm shadow-cyan-500/20" />
            <span className="w-4 h-0.5 rounded bg-slate-800" />
          </div>

          {/* Bar 4 (Emerald) */}
          <div className="flex flex-col items-center space-y-1 z-10">
            <div className="w-6 h-19 rounded-t-md bg-gradient-to-t from-emerald-700/50 to-emerald-500 border-t border-x border-emerald-400/50 shadow-sm shadow-emerald-500/20" />
            <span className="w-4 h-0.5 rounded bg-slate-800" />
          </div>

          {/* Dynamic Trend Line with glowing Data Points */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20"
            viewBox="0 0 240 96"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="vis-trend-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* Glowing line shadow */}
            <path
              d="M 28 64 Q 65 30 102 46 T 172 26 T 215 14"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeOpacity="0.25"
              strokeLinecap="round"
            />
            {/* Crisp trend curve */}
            <path
              d="M 28 64 Q 65 30 102 46 T 172 26 T 215 14"
              fill="none"
              stroke="url(#vis-trend-gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Data Point 1 */}
            <circle cx="28" cy="64" r="3" fill="#818cf8" stroke="#0f172a" strokeWidth="2" />
            {/* Data Point 2 */}
            <circle cx="102" cy="46" r="3" fill="#a855f7" stroke="#0f172a" strokeWidth="2" />
            {/* Data Point 3 */}
            <circle cx="172" cy="26" r="3" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
            {/* Data Point 4 (Lead point with halo) */}
            <circle cx="215" cy="14" r="4.5" fill="#34d399" stroke="#0f172a" strokeWidth="2" />
            <circle cx="215" cy="14" r="7" fill="none" stroke="#34d399" strokeWidth="1" strokeOpacity="0.6" className="animate-ping" style={{ transformOrigin: '215px 14px', animationDuration: '3s' }} />
          </svg>
        </div>

        {/* Baseline Axis */}
        <div className="relative z-10 w-full h-px bg-slate-800" />
      </div>

      {/* Floating mini KPI growth pill */}
      <div className="absolute -bottom-2 -right-1.5 z-30 bg-slate-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shadow-lg flex items-center space-x-1 backdrop-blur-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>+28.4%</span>
      </div>
    </div>
  );
};
