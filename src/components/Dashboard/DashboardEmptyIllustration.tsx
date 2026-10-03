import React from 'react';

export const DashboardEmptyIllustration: React.FC<{ className?: string }> = ({ className = 'w-full max-w-[380px] h-auto' }) => {
  return (
    <svg
      viewBox="0 0 440 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Glow Filters */}
        <filter id="emp-glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="emp-glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Gradients */}
        <linearGradient id="emp-grad-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="emp-grad-chart" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
        </linearGradient>

        <linearGradient id="emp-grad-indigo-bar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>

        <linearGradient id="emp-grad-emerald-bar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        <linearGradient id="emp-grad-cyan-bar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        <linearGradient id="emp-grad-screen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0b1329" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id="emp-grad-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#10b981" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="220" cy="110" r="110" fill="url(#emp-grad-glow)" />

      {/* Grid Pattern / Grid matrix lines behind workspace */}
      <g stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.35">
        <line x1="40" y1="50" x2="400" y2="50" />
        <line x1="40" y1="90" x2="400" y2="90" />
        <line x1="40" y1="130" x2="400" y2="130" />
        <line x1="40" y1="170" x2="400" y2="170" />
        <line x1="80" y1="20" x2="80" y2="190" />
        <line x1="160" y1="20" x2="160" y2="190" />
        <line x1="280" y1="20" x2="280" y2="190" />
        <line x1="360" y1="20" x2="360" y2="190" />
      </g>

      {/* ================= FLOATING DASHBOARD WIDGET: KPI CARD (Top-Left) ================= */}
      <g transform="translate(32, 30)">
        {/* Card base */}
        <rect width="108" height="54" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        {/* Card header */}
        <circle cx="12" cy="14" r="3" fill="#10b981" />
        <rect x="20" y="11" width="42" height="5" rx="2" fill="#64748b" />
        {/* KPI Value */}
        <rect x="10" y="24" width="56" height="9" rx="2" fill="#f8fafc" />
        <rect x="70" y="25" width="28" height="7" rx="3" fill="#10b981" fillOpacity="0.2" />
        <path d="M74 29 L77 27 L80 29" stroke="#34d399" strokeWidth="1" strokeLinecap="round" />
        {/* Sparkline */}
        <path
          d="M10 44 Q 25 36, 40 42 T 70 36 T 98 32"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* ================= FLOATING DASHBOARD WIDGET: BAR & TREND CHART (Top-Right) ================= */}
      <g transform="translate(295, 24)">
        {/* Card base */}
        <rect width="115" height="72" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        {/* Header */}
        <rect x="10" y="10" width="50" height="5" rx="2" fill="#94a3b8" />
        <rect x="88" y="9" width="18" height="7" rx="3.5" fill="#6366f1" fillOpacity="0.25" />
        <circle cx="97" cy="12.5" r="1.5" fill="#818cf8" />
        {/* Grid lines inside card */}
        <line x1="10" y1="28" x2="105" y2="28" stroke="#1e293b" strokeWidth="1" />
        <line x1="10" y1="44" x2="105" y2="44" stroke="#1e293b" strokeWidth="1" />
        <line x1="10" y1="60" x2="105" y2="60" stroke="#334155" strokeWidth="1" />
        {/* Bar columns */}
        <rect x="16" y="42" width="7" height="18" rx="2" fill="url(#emp-grad-indigo-bar)" />
        <rect x="27" y="32" width="7" height="28" rx="2" fill="url(#emp-grad-emerald-bar)" />
        <rect x="38" y="38" width="7" height="22" rx="2" fill="url(#emp-grad-cyan-bar)" />
        <rect x="49" y="24" width="7" height="36" rx="2" fill="url(#emp-grad-emerald-bar)" />
        <rect x="60" y="35" width="7" height="25" rx="2" fill="url(#emp-grad-indigo-bar)" />
        <rect x="71" y="20" width="7" height="40" rx="2" fill="url(#emp-grad-emerald-bar)" />
        <rect x="82" y="30" width="7" height="30" rx="2" fill="url(#emp-grad-cyan-bar)" />
        <rect x="93" y="16" width="7" height="44" rx="2" fill="url(#emp-grad-indigo-bar)" />
      </g>

      {/* ================= FLOATING DASHBOARD WIDGET: DATA TABLE PREVIEW (Bottom-Right) ================= */}
      <g transform="translate(305, 112)">
        <rect width="105" height="58" rx="8" fill="#0b1329" stroke="#1e293b" strokeWidth="1" />
        {/* Table header row */}
        <rect x="8" y="8" width="24" height="4" rx="1.5" fill="#64748b" />
        <rect x="38" y="8" width="26" height="4" rx="1.5" fill="#64748b" />
        <rect x="70" y="8" width="26" height="4" rx="1.5" fill="#64748b" />
        <line x1="8" y1="17" x2="97" y2="17" stroke="#334155" strokeWidth="0.75" />
        {/* Table row 1 */}
        <circle cx="12" cy="24" r="2" fill="#10b981" />
        <rect x="18" y="22" width="16" height="4" rx="1" fill="#94a3b8" />
        <rect x="38" y="22" width="22" height="4" rx="1" fill="#cbd5e1" />
        <rect x="70" y="22" width="20" height="4" rx="1" fill="#38bdf8" />
        {/* Table row 2 */}
        <circle cx="12" cy="35" r="2" fill="#818cf8" />
        <rect x="18" y="33" width="16" height="4" rx="1" fill="#94a3b8" />
        <rect x="38" y="33" width="25" height="4" rx="1" fill="#cbd5e1" />
        <rect x="70" y="33" width="18" height="4" rx="1" fill="#38bdf8" />
        {/* Table row 3 */}
        <circle cx="12" cy="46" r="2" fill="#10b981" />
        <rect x="18" y="44" width="16" height="4" rx="1" fill="#94a3b8" />
        <rect x="38" y="44" width="20" height="4" rx="1" fill="#cbd5e1" />
        <rect x="70" y="44" width="22" height="4" rx="1" fill="#38bdf8" />
      </g>

      {/* ================= FLOATING FILTER PILL (Bottom-Left) ================= */}
      <g transform="translate(36, 106)">
        <rect width="90" height="24" rx="12" fill="#0f172a" stroke="#475569" strokeWidth="1" />
        <path d="M46 116 L50 120 L54 116" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
        <circle cx="48" cy="118" r="3" fill="#6366f1" fillOpacity="0.3" />
        <rect x="10" y="9" width="30" height="6" rx="2" fill="#cbd5e1" />
        <rect x="46" y="9" width="34" height="6" rx="2" fill="#38bdf8" fillOpacity="0.8" />
      </g>

      {/* ================= DESK & WORKSTATION CENTER ================= */}
      {/* Sleek Enterprise Desk Surface */}
      <path
        d="M90 205 L350 205 L370 220 L70 220 Z"
        fill="#0f172a"
        stroke="#334155"
        strokeWidth="1"
      />
      {/* Desk front lip */}
      <rect x="70" y="220" width="300" height="6" rx="1" fill="#020617" stroke="#1e293b" strokeWidth="0.8" />

      {/* Main Ultra-Wide Monitor Stand */}
      <rect x="214" y="160" width="12" height="46" fill="#334155" rx="2" />
      <ellipse cx="220" cy="206" rx="26" ry="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />

      {/* Ultra-Wide Curved Monitor Bezel & Display */}
      <rect x="145" y="78" width="150" height="90" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
      <rect x="149" y="82" width="142" height="82" rx="4" fill="url(#emp-grad-screen)" />

      {/* Screen Interface: Top bar with tabs */}
      <rect x="153" y="86" width="36" height="5" rx="1.5" fill="#334155" />
      <rect x="193" y="86" width="28" height="5" rx="1.5" fill="#1e293b" />
      <rect x="225" y="86" width="28" height="5" rx="1.5" fill="#1e293b" />
      <circle cx="282" cy="88.5" r="2" fill="#10b981" />

      {/* Screen Interface: Dashboard Multi-Charts */}
      {/* Left Area Chart on Screen */}
      <g transform="translate(153, 96)">
        <rect width="65" height="64" rx="4" fill="#0f172a" fillOpacity="0.8" stroke="#1e293b" strokeWidth="0.8" />
        <path
          d="M5 45 Q 15 25, 25 35 T 45 20 T 60 15 L 60 55 L 5 55 Z"
          fill="url(#emp-grad-chart)"
        />
        <path
          d="M5 45 Q 15 25, 25 35 T 45 20 T 60 15"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      {/* Right Column Grid on Screen */}
      <g transform="translate(222, 96)">
        <rect width="65" height="64" rx="4" fill="#0f172a" fillOpacity="0.8" stroke="#1e293b" strokeWidth="0.8" />
        <rect x="6" y="8" width="24" height="4" rx="1" fill="#64748b" />
        <rect x="6" y="16" width="53" height="8" rx="2" fill="#1e293b" />
        <rect x="6" y="27" width="53" height="8" rx="2" fill="#1e293b" />
        <rect x="6" y="38" width="53" height="8" rx="2" fill="#1e293b" />
        <rect x="6" y="49" width="32" height="8" rx="2" fill="#6366f1" fillOpacity="0.4" />
      </g>

      {/* Analyst Figure (Working Professional at Desk) */}
      <g transform="translate(185, 140)">
        {/* Shoulders / Torso */}
        <path
          d="M10 65 C10 42, 22 36, 35 36 C48 36, 60 42, 60 65 Z"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="1"
        />
        {/* Collar / Shirt accent */}
        <path d="M30 38 L35 48 L40 38 Z" fill="#0f172a" />
        <path d="M35 48 L35 65" stroke="#475569" strokeWidth="1" />

        {/* Neck */}
        <rect x="31" y="28" width="8" height="10" rx="2" fill="#94a3b8" />

        {/* Head */}
        <ellipse cx="35" cy="22" rx="11" ry="13" fill="#cbd5e1" />

        {/* Modern styled hair */}
        <path
          d="M24 20 C24 10, 46 8, 46 18 C46 14, 43 11, 35 11 C28 11, 24 15, 24 20 Z"
          fill="#334155"
        />

        {/* Arms / Hands typing on keyboard */}
        <path
          d="M14 62 Q 22 55, 28 62"
          stroke="#475569"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M56 62 Q 48 55, 42 62"
          stroke="#475569"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Slim Modern Backlit Keyboard & Touchpad */}
      <rect x="200" y="202" width="40" height="8" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
      <line x1="204" y1="206" x2="236" y2="206" stroke="#64748b" strokeWidth="1" strokeDasharray="2 1.5" />

      {/* Compact Secondary Analyst Laptop / Tablet (Left on desk) */}
      <g transform="translate(100, 180)">
        {/* Screen */}
        <path d="M8 0 L32 0 L34 20 L6 20 Z" fill="#0b1329" stroke="#334155" strokeWidth="0.8" />
        <rect x="10" y="3" width="20" height="14" rx="1" fill="#10b981" fillOpacity="0.15" />
        <path d="M12 12 L17 8 L22 13 L28 6" stroke="#34d399" strokeWidth="1" fill="none" />
        {/* Base */}
        <rect x="2" y="20" width="38" height="3" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
      </g>

      {/* Subtle Data Stream Particles */}
      <circle cx="132" cy="72" r="1.5" fill="#38bdf8" opacity="0.6" />
      <circle cx="292" cy="100" r="1.5" fill="#10b981" opacity="0.7" />
      <circle cx="280" cy="40" r="1.5" fill="#818cf8" opacity="0.5" />
      <circle cx="150" cy="45" r="1.5" fill="#34d399" opacity="0.6" />
    </svg>
  );
};
