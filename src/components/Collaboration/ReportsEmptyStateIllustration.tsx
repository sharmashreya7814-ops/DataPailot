import React from 'react';

interface ReportsEmptyStateIllustrationProps {
  className?: string;
}

export const ReportsEmptyStateIllustration: React.FC<ReportsEmptyStateIllustrationProps> = ({
  className = 'w-full max-w-md h-auto'
}) => {
  return (
    <div className="relative flex items-center justify-center select-none" role="img" aria-label="Executive report creation illustration">
      {/* Ambient background glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <svg
        viewBox="0 0 520 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} overflow-visible`}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="deskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="laptopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="reportGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="cyanIndigoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <linearGradient id="chairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="personGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>

          <filter id="shadowFilter" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.5" />
          </filter>

          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <style>{`
            @keyframes subtleFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }
            @keyframes subtleFloatSlow {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-7px) rotate(0.5deg); }
            }
            @keyframes barGrow {
              0%, 100% { transform: scaleY(0.92); }
              50% { transform: scaleY(1.04); }
            }
            @keyframes pulseDot {
              0%, 100% { opacity: 0.4; transform: scale(0.9); }
              50% { opacity: 1; transform: scale(1.15); }
            }
            @keyframes textShimmer {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 0.9; }
            }
            @keyframes typingMotion {
              0%, 100% { transform: translateY(0px); }
              25% { transform: translateY(-1.5px); }
              50% { transform: translateY(0.5px); }
              75% { transform: translateY(-1px); }
            }

            .anim-float-1 {
              animation: subtleFloat 4s ease-in-out infinite;
            }
            .anim-float-2 {
              animation: subtleFloatSlow 5.5s ease-in-out infinite;
              animation-delay: 0.8s;
            }
            .anim-float-3 {
              animation: subtleFloat 4.5s ease-in-out infinite;
              animation-delay: 1.5s;
            }
            .anim-bar-1 {
              transform-origin: bottom;
              animation: barGrow 3.2s ease-in-out infinite;
            }
            .anim-bar-2 {
              transform-origin: bottom;
              animation: barGrow 3.2s ease-in-out infinite;
              animation-delay: 0.4s;
            }
            .anim-bar-3 {
              transform-origin: bottom;
              animation: barGrow 3.2s ease-in-out infinite;
              animation-delay: 0.8s;
            }
            .anim-pulse {
              transform-origin: center;
              animation: pulseDot 2.4s ease-in-out infinite;
            }
            .anim-line-shimmer-1 {
              animation: textShimmer 2.8s ease-in-out infinite;
            }
            .anim-line-shimmer-2 {
              animation: textShimmer 2.8s ease-in-out infinite;
              animation-delay: 0.6s;
            }
            .anim-line-shimmer-3 {
              animation: textShimmer 2.8s ease-in-out infinite;
              animation-delay: 1.2s;
            }
            .anim-typing {
              animation: typingMotion 1.8s ease-in-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .anim-float-1,
              .anim-float-2,
              .anim-float-3,
              .anim-bar-1,
              .anim-bar-2,
              .anim-bar-3,
              .anim-pulse,
              .anim-line-shimmer-1,
              .anim-line-shimmer-2,
              .anim-line-shimmer-3,
              .anim-typing {
                animation: none !important;
              }
            }
          `}</style>
        </defs>

        {/* 1. Backdrop Grid & Ambient Glow */}
        <g opacity="0.15">
          <line x1="40" y1="120" x2="480" y2="120" stroke="#475569" strokeDasharray="3 3" />
          <line x1="40" y1="180" x2="480" y2="180" stroke="#475569" strokeDasharray="3 3" />
          <line x1="40" y1="240" x2="480" y2="240" stroke="#475569" strokeDasharray="3 3" />
          <line x1="120" y1="60" x2="120" y2="280" stroke="#475569" strokeDasharray="3 3" />
          <line x1="260" y1="60" x2="260" y2="280" stroke="#475569" strokeDasharray="3 3" />
          <line x1="400" y1="60" x2="400" y2="280" stroke="#475569" strokeDasharray="3 3" />
        </g>

        {/* 2. Desk Surface & Studio Grounding */}
        <ellipse cx="260" cy="285" rx="210" ry="24" fill="#030712" opacity="0.6" />
        <rect x="50" y="260" width="420" height="12" rx="6" fill="url(#deskGrad)" stroke="#334155" strokeWidth="1" />
        <rect x="70" y="272" width="12" height="40" rx="3" fill="#1e293b" />
        <rect x="438" y="272" width="12" height="40" rx="3" fill="#1e293b" />

        {/* Desk Plant / Office Detail (Left) */}
        <g opacity="0.8">
          <rect x="75" y="235" width="22" height="25" rx="4" fill="#1e293b" stroke="#334155" />
          <path d="M86 235 C75 215, 65 210, 68 200 C78 205, 84 218, 86 235 Z" fill="#10b981" opacity="0.8" />
          <path d="M86 235 C95 210, 105 208, 102 195 C92 202, 88 215, 86 235 Z" fill="#059669" />
          <path d="M86 235 C82 210, 84 195, 86 190 C88 200, 89 215, 86 235 Z" fill="#34d399" opacity="0.9" />
        </g>

        {/* 3. Analyst Sitting at Work (Left-Center) */}
        {/* Chair Back */}
        <rect x="125" y="160" width="46" height="85" rx="10" fill="url(#chairGrad)" stroke="#334155" strokeWidth="1" />
        <rect x="143" y="245" width="10" height="35" rx="2" fill="#0f172a" />
        <path d="M125 275 L171 275" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

        {/* Person Torso & Head */}
        <circle cx="155" cy="130" r="16" fill="#f8fafc" opacity="0.9" />
        {/* Hair / Headphone Detail */}
        <path d="M141 128 C141 116, 150 112, 162 112 C172 112, 173 120, 172 128 C166 122, 155 122, 141 128 Z" fill="#334155" />
        <path d="M148 112 C142 112, 138 122, 140 134" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <rect x="137" y="126" width="5" height="10" rx="2" fill="#06b6d4" />

        {/* Body (Professional Hoodie / Jacket) */}
        <path
          d="M136 150 C143 146, 167 146, 174 150 L184 210 C184 216, 180 220, 174 220 L136 220 C130 220, 126 216, 126 210 Z"
          fill="url(#personGrad)"
          stroke="#4f46e5"
          strokeWidth="1"
        />

        {/* Analyst Arm / Typing Motion */}
        <g className="anim-typing">
          <path
            d="M168 170 C178 185, 195 210, 214 218 L218 226 C214 228, 202 226, 190 216 L164 185 Z"
            fill="#4338ca"
            opacity="0.95"
          />
          {/* Hands on laptop */}
          <ellipse cx="220" cy="226" rx="6" ry="4" fill="#f8fafc" opacity="0.9" />
          <ellipse cx="212" cy="227" rx="5" ry="3.5" fill="#e2e8f0" opacity="0.8" />
        </g>

        {/* 4. Modern Laptop Setup */}
        <g filter="url(#shadowFilter)">
          {/* Base */}
          <path d="M195 248 L255 248 L260 252 L190 252 Z" fill="url(#laptopGrad)" stroke="#475569" strokeWidth="0.8" />
          {/* Screen (Angled back) */}
          <path
            d="M208 190 L268 185 L266 248 L206 248 Z"
            fill="url(#screenGrad)"
            stroke="#475569"
            strokeWidth="1.2"
          />
          {/* Screen glow & Mini Dashboard on Laptop */}
          <path
            d="M211 193 L265 188 L263 245 L209 245 Z"
            fill="#090d16"
          />
          {/* Glowing Top Bar on Laptop */}
          <line x1="213" y1="196" x2="262" y2="192" stroke="#06b6d4" strokeWidth="1.5" opacity="0.8" />
          {/* Mini charts inside laptop */}
          <rect x="214" y="202" width="20" height="15" rx="1.5" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
          <path d="M216 213 L220 209 L225 211 L231 205" stroke="#10b981" strokeWidth="1" fill="none" />

          <rect x="238" y="200" width="23" height="15" rx="1.5" fill="#1e293b" stroke="#334155" strokeWidth="0.5" />
          <line x1="241" y1="210" x2="241" y2="206" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
          <line x1="246" y1="210" x2="246" y2="204" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
          <line x1="251" y1="210" x2="251" y2="202" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

          {/* Mini lines below */}
          <rect x="214" y="222" width="47" height="18" rx="1.5" fill="#0f172a" stroke="#1e293b" strokeWidth="0.5" />
          <line x1="217" y1="228" x2="256" y2="228" stroke="#475569" strokeWidth="1" />
          <line x1="217" y1="233" x2="245" y2="233" stroke="#334155" strokeWidth="1" />
        </g>

        {/* 5. Glowing Data Stream / Connection Arc */}
        <path
          d="M265 200 C300 180, 310 140, 335 120"
          stroke="url(#cyanIndigoGrad)"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* 6. Floating Executive Report Document Canvas (Center-Right) */}
        <g className="anim-float-1" filter="url(#shadowFilter)">
          {/* Main Document Sheet */}
          <rect
            x="320"
            y="50"
            width="160"
            height="215"
            rx="12"
            fill="url(#reportGrad)"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Document Header Bar */}
          <rect x="320" y="50" width="160" height="34" rx="12" fill="#1e293b" opacity="0.9" />
          <rect x="320" y="72" width="160" height="12" fill="#1e293b" opacity="0.9" />
          <line x1="320" y1="84" x2="480" y2="84" stroke="#334155" strokeWidth="1" />

          {/* Header Badge & Title */}
          <circle cx="338" cy="67" r="5" fill="#06b6d4" />
          <circle cx="338" cy="67" r="8" stroke="#06b6d4" strokeWidth="1" opacity="0.4" className="anim-pulse" />
          <rect x="350" y="64" width="70" height="6" rx="3" fill="#f8fafc" opacity="0.9" />
          <rect x="426" y="64" width="40" height="6" rx="3" fill="#6366f1" opacity="0.8" />

          {/* Section 1: KPI Summary Cards inside Report */}
          <g transform="translate(332, 94)">
            <rect x="0" y="0" width="64" height="36" rx="6" fill="#090d16" stroke="#334155" strokeWidth="0.8" />
            <rect x="6" y="6" width="30" height="4" rx="2" fill="#94a3b8" />
            <text x="6" y="24" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">+28.4%</text>
            <circle cx="56" cy="10" r="2" fill="#10b981" />

            <rect x="72" y="0" width="64" height="36" rx="6" fill="#090d16" stroke="#334155" strokeWidth="0.8" />
            <rect x="78" y="6" width="32" height="4" rx="2" fill="#94a3b8" />
            <text x="78" y="24" fill="#06b6d4" fontSize="10" fontFamily="monospace" fontWeight="bold">99.8%</text>
            <circle cx="128" cy="10" r="2" fill="#06b6d4" />
          </g>

          {/* Section 2: Mini Report Chart */}
          <g transform="translate(332, 138)">
            <rect x="0" y="0" width="136" height="48" rx="6" fill="#090d16" stroke="#1e293b" strokeWidth="0.8" />
            {/* Chart Grid */}
            <line x1="8" y1="38" x2="128" y2="38" stroke="#334155" strokeWidth="0.6" />
            <line x1="8" y1="24" x2="128" y2="24" stroke="#1e293b" strokeWidth="0.6" strokeDasharray="2 2" />
            <line x1="8" y1="10" x2="128" y2="10" stroke="#1e293b" strokeWidth="0.6" strokeDasharray="2 2" />

            {/* Dynamic Animated Bars */}
            <g transform="translate(18, 38)">
              <rect x="0" y="-12" width="10" height="12" rx="2" fill="#475569" className="anim-bar-1" />
              <rect x="18" y="-18" width="10" height="18" rx="2" fill="#6366f1" className="anim-bar-2" />
              <rect x="36" y="-14" width="10" height="14" rx="2" fill="#475569" className="anim-bar-1" />
              <rect x="54" y="-24" width="10" height="24" rx="2" fill="#06b6d4" className="anim-bar-3" />
              <rect x="72" y="-20" width="10" height="20" rx="2" fill="#6366f1" className="anim-bar-2" />
              <rect x="90" y="-30" width="10" height="30" rx="2" fill="#10b981" className="anim-bar-3" />
            </g>
          </g>

          {/* Section 3: Narrative Insights Text Shimmer Lines */}
          <g transform="translate(332, 196)">
            <rect x="0" y="0" width="90" height="4" rx="2" fill="#f8fafc" className="anim-line-shimmer-1" />
            <rect x="0" y="8" width="130" height="3.5" rx="1.75" fill="#94a3b8" className="anim-line-shimmer-2" />
            <rect x="0" y="15" width="110" height="3.5" rx="1.75" fill="#64748b" className="anim-line-shimmer-3" />
            <rect x="0" y="22" width="124" height="3.5" rx="1.75" fill="#475569" className="anim-line-shimmer-1" />
          </g>

          {/* Document Footer Status Badge */}
          <g transform="translate(332, 235)">
            <rect x="0" y="0" width="58" height="16" rx="8" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="0.8" />
            <circle cx="8" cy="8" r="2.5" fill="#10b981" />
            <text x="15" y="11" fill="#34d399" fontSize="7" fontFamily="sans-serif" fontWeight="bold">VERIFIED</text>
          </g>

          {/* Snapshot Seal Icon (Top Right Corner) */}
          <g transform="translate(452, 232)">
            <circle cx="10" cy="10" r="10" fill="#1e293b" stroke="#f59e0b" strokeWidth="1" />
            <path d="M7 10 L9 12 L13 8" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </g>

        {/* 7. Floating Satellite Widget: Growth Trend Card (Top Left) */}
        <g className="anim-float-2" filter="url(#shadowFilter)">
          <rect x="235" y="45" width="85" height="44" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <rect x="243" y="53" width="38" height="4" rx="2" fill="#94a3b8" />
          <text x="243" y="73" fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">$1.24M</text>
          <path d="M295 72 L302 65 L307 68 L314 60" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <circle cx="314" cy="60" r="2" fill="#38bdf8" />
        </g>

        {/* 8. Floating Satellite Widget: Instant Insight Pill (Bottom Right) */}
        <g className="anim-float-3" filter="url(#shadowFilter)">
          <rect x="290" y="270" width="135" height="32" rx="16" fill="#0f172a" stroke="#06b6d4" strokeWidth="1" opacity="0.95" />
          <circle cx="306" cy="286" r="6" fill="#06b6d4" fillOpacity="0.2" />
          <path d="M306 283 L307 285 L309 286 L307 287 L306 289 L305 287 L303 286 L305 285 Z" fill="#06b6d4" />
          <text x="318" y="289" fill="#e2e8f0" fontSize="9" fontFamily="sans-serif" fontWeight="600">
            Factual KPI Snapshot
          </text>
        </g>
      </svg>
    </div>
  );
};
