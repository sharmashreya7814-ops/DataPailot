import React from 'react';

interface DataQualityEmptyStateIllustrationProps {
  className?: string;
}

export const DataQualityEmptyStateIllustration: React.FC<DataQualityEmptyStateIllustrationProps> = ({
  className = 'w-full max-w-md h-auto'
}) => {
  return (
    <div className="relative flex items-center justify-center select-none" role="img" aria-label="Data quality profiling and inspection illustration">
      {/* Ambient background glow */}
      <div className="absolute -inset-6 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <svg
        viewBox="0 0 520 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} overflow-visible`}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="dqDeskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="dqLaptopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="dqScreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="dqCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="dqEmeraldCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          <linearGradient id="dqIndigoPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          <linearGradient id="dqFemaleHair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          <linearGradient id="dqFemaleJacket" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          <linearGradient id="dqScanBeam" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>

          <filter id="dqShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.5" />
          </filter>

          <style>{`
            @keyframes dqSubtleFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }
            @keyframes dqFloatSlow {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-7px) rotate(0.6deg); }
            }
            @keyframes dqScanLineMove {
              0% { transform: translateY(0px); opacity: 0; }
              20% { opacity: 0.8; }
              80% { opacity: 0.8; }
              100% { transform: translateY(85px); opacity: 0; }
            }
            @keyframes dqPulseShield {
              0%, 100% { transform: scale(1); opacity: 0.9; }
              50% { transform: scale(1.08); opacity: 1; }
            }
            @keyframes dqRowHighlight {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.8; }
            }
            @keyframes dqFemaleTyping {
              0%, 100% { transform: translateY(0px); }
              25% { transform: translateY(-1.5px); }
              50% { transform: translateY(0.5px); }
              75% { transform: translateY(-1px); }
            }

            .anim-dq-float-main {
              animation: dqSubtleFloat 4.2s ease-in-out infinite;
            }
            .anim-dq-float-shield {
              animation: dqFloatSlow 5s ease-in-out infinite;
              animation-delay: 0.5s;
            }
            .anim-dq-float-pill {
              animation: dqSubtleFloat 4.5s ease-in-out infinite;
              animation-delay: 1.2s;
            }
            .anim-dq-scan {
              animation: dqScanLineMove 3.6s ease-in-out infinite;
            }
            .anim-dq-pulse {
              transform-origin: center;
              animation: dqPulseShield 2.8s ease-in-out infinite;
            }
            .anim-dq-row-highlight {
              animation: dqRowHighlight 3s ease-in-out infinite;
            }
            .anim-dq-typing {
              animation: dqFemaleTyping 1.8s ease-in-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .anim-dq-float-main,
              .anim-dq-float-shield,
              .anim-dq-float-pill,
              .anim-dq-scan,
              .anim-dq-pulse,
              .anim-dq-row-highlight,
              .anim-dq-typing {
                animation: none !important;
              }
            }
          `}</style>
        </defs>

        {/* 1. Backdrop Grid & Blueprint Matrix */}
        <g opacity="0.12">
          <line x1="40" y1="120" x2="480" y2="120" stroke="#475569" strokeDasharray="3 3" />
          <line x1="40" y1="180" x2="480" y2="180" stroke="#475569" strokeDasharray="3 3" />
          <line x1="40" y1="240" x2="480" y2="240" stroke="#475569" strokeDasharray="3 3" />
          <line x1="120" y1="60" x2="120" y2="280" stroke="#475569" strokeDasharray="3 3" />
          <line x1="260" y1="60" x2="260" y2="280" stroke="#475569" strokeDasharray="3 3" />
          <line x1="400" y1="60" x2="400" y2="280" stroke="#475569" strokeDasharray="3 3" />
        </g>

        {/* 2. Desk Grounding */}
        <ellipse cx="260" cy="285" rx="210" ry="24" fill="#030712" opacity="0.6" />
        <rect x="50" y="260" width="420" height="12" rx="6" fill="url(#dqDeskGrad)" stroke="#334155" strokeWidth="1" />
        <rect x="70" y="272" width="12" height="40" rx="3" fill="#1e293b" />
        <rect x="438" y="272" width="12" height="40" rx="3" fill="#1e293b" />

        {/* Office Detail: Coffee & Stylus / Pen Stand */}
        <g opacity="0.8">
          <rect x="75" y="240" width="18" height="20" rx="3" fill="#1e293b" stroke="#334155" />
          <ellipse cx="84" cy="240" rx="9" ry="2.5" fill="#0f172a" stroke="#334155" />
          <path d="M93 245 C97 245, 98 253, 93 255" stroke="#334155" strokeWidth="1.5" fill="none" />
        </g>

        {/* 3. Professional Female Data Analyst (Left) */}
        {/* Chair Backrest */}
        <rect x="122" y="155" width="48" height="90" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        <rect x="141" y="245" width="10" height="35" rx="2" fill="#0f172a" />
        <path d="M122 275 L170 275" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

        {/* Analyst Head & Hair */}
        <circle cx="152" cy="126" r="15" fill="#f8fafc" opacity="0.9" />
        {/* Modern styled hair (Sleek side-parted bob / ponytail) */}
        <path
          d="M137 124 C137 110, 148 106, 162 106 C174 106, 175 116, 173 126 C168 118, 155 116, 140 124 Z"
          fill="url(#dqFemaleHair)"
        />
        {/* Sleek ponytail / back hair flow */}
        <path
          d="M138 120 C132 125, 130 138, 134 148 C136 142, 138 132, 142 126 Z"
          fill="url(#dqFemaleHair)"
        />

        {/* Analyst Headset / Smart Glasses */}
        <path d="M145 107 C139 107, 135 118, 137 130" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <rect x="134" y="123" width="5" height="9" rx="2" fill="#06b6d4" />

        {/* Analyst Torso (Tailored Teal Blazer) */}
        <path
          d="M133 148 C140 144, 164 144, 171 148 L181 210 C181 216, 177 220, 171 220 L133 220 C127 220, 123 216, 123 210 Z"
          fill="url(#dqFemaleJacket)"
          stroke="#0284c7"
          strokeWidth="1"
        />
        {/* Inner Shirt Collar */}
        <polygon points="148,148 152,165 156,148" fill="#f8fafc" opacity="0.9" />

        {/* Analyst Arm / Typing & Inspecting Gesture */}
        <g className="anim-dq-typing">
          <path
            d="M165 168 C176 182, 192 208, 210 216 L215 224 C210 226, 198 224, 186 214 L161 182 Z"
            fill="#0369a1"
            opacity="0.95"
          />
          {/* Hands over laptop trackpad/keys */}
          <ellipse cx="217" cy="225" rx="5.5" ry="3.5" fill="#f8fafc" opacity="0.9" />
          <ellipse cx="209" cy="226" rx="5" ry="3" fill="#e2e8f0" opacity="0.8" />
        </g>

        {/* 4. Analyst Laptop Setup */}
        <g filter="url(#dqShadow)">
          {/* Laptop Base */}
          <path d="M192 248 L252 248 L257 252 L187 252 Z" fill="url(#dqLaptopGrad)" stroke="#475569" strokeWidth="0.8" />
          {/* Screen */}
          <path
            d="M205 190 L265 185 L263 248 L203 248 Z"
            fill="url(#dqScreenGrad)"
            stroke="#475569"
            strokeWidth="1.2"
          />
          {/* Screen Content: Data Profiler Matrix */}
          <path d="M208 193 L262 188 L260 245 L206 245 Z" fill="#090d16" />
          {/* Header bar on laptop screen */}
          <line x1="210" y1="196" x2="259" y2="192" stroke="#10b981" strokeWidth="1.5" opacity="0.8" />
          {/* Table grid on laptop */}
          <rect x="211" y="201" width="47" height="40" rx="1.5" fill="#0f172a" stroke="#1e293b" strokeWidth="0.5" />
          <line x1="211" y1="209" x2="258" y2="209" stroke="#334155" strokeWidth="0.8" />
          <line x1="211" y1="217" x2="258" y2="217" stroke="#1e293b" strokeWidth="0.6" />
          <line x1="211" y1="225" x2="258" y2="225" stroke="#1e293b" strokeWidth="0.6" />
          <line x1="211" y1="233" x2="258" y2="233" stroke="#1e293b" strokeWidth="0.6" />

          {/* Mini Check / Warning Dots on Laptop Table */}
          <circle cx="216" cy="213" r="1.5" fill="#10b981" />
          <circle cx="225" cy="213" r="1.5" fill="#10b981" />
          <circle cx="234" cy="213" r="1.5" fill="#f59e0b" />
          <circle cx="243" cy="213" r="1.5" fill="#10b981" />
          <circle cx="252" cy="213" r="1.5" fill="#10b981" />

          <circle cx="216" cy="221" r="1.5" fill="#10b981" />
          <circle cx="225" cy="221" r="1.5" fill="#f43f5e" />
          <circle cx="234" cy="221" r="1.5" fill="#10b981" />
          <circle cx="243" cy="221" r="1.5" fill="#10b981" />
          <circle cx="252" cy="221" r="1.5" fill="#10b981" />
        </g>

        {/* 5. Data Flow Beam Connecting to Main Inspector */}
        <path
          d="M260 195 C295 175, 305 135, 325 110"
          stroke="url(#dqEmeraldCyan)"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
          opacity="0.65"
        />

        {/* 6. Floating Holographic Data Quality Inspector Board (Center-Right) */}
        <g className="anim-dq-float-main" filter="url(#dqShadow)">
          {/* Main Inspection Canvas */}
          <rect
            x="315"
            y="45"
            width="175"
            height="225"
            rx="12"
            fill="url(#dqCardGrad)"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Canvas Header */}
          <rect x="315" y="45" width="175" height="36" rx="12" fill="#1e293b" opacity="0.95" />
          <rect x="315" y="69" width="175" height="12" fill="#1e293b" opacity="0.95" />
          <line x1="315" y1="81" x2="490" y2="81" stroke="#334155" strokeWidth="1" />

          {/* Header Title & Shield Checkmark Icon */}
          <g transform="translate(328, 55)">
            <path
              d="M10 2 L2 5 L2 12 C2 16.5 5.5 20.5 10 22 C14.5 20.5 18 16.5 18 12 L18 5 L10 2 Z"
              fill="#10b981"
              fillOpacity="0.2"
              stroke="#10b981"
              strokeWidth="1.2"
            />
            <path d="M6 12 L9 15 L14 8" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <text x="24" y="15" fill="#f8fafc" fontSize="10" fontFamily="sans-serif" fontWeight="bold">Data Profiler</text>
            {/* Live Inspection Indicator */}
            <circle cx="132" cy="11" r="3" fill="#10b981" className="anim-dq-pulse" />
          </g>

          {/* Table Header Row with Column Badges */}
          <g transform="translate(325, 90)">
            <rect x="0" y="0" width="155" height="18" rx="4" fill="#090d16" stroke="#334155" strokeWidth="0.8" />
            <text x="8" y="12" fill="#94a3b8" fontSize="8" fontFamily="monospace" fontWeight="600">COL</text>
            <text x="40" y="12" fill="#94a3b8" fontSize="8" fontFamily="monospace" fontWeight="600">TYPE</text>
            <text x="82" y="12" fill="#94a3b8" fontSize="8" fontFamily="monospace" fontWeight="600">NULL%</text>
            <text x="124" y="12" fill="#94a3b8" fontSize="8" fontFamily="monospace" fontWeight="600">HEALTH</text>
          </g>

          {/* Table Data Rows with Quality Indicators */}
          {/* Row 1: user_id (Clean) */}
          <g transform="translate(325, 114)">
            <rect x="0" y="0" width="155" height="22" rx="4" fill="#090d16" stroke="#1e293b" strokeWidth="0.6" />
            <text x="8" y="14" fill="#e2e8f0" fontSize="8.5" fontFamily="monospace">user_id</text>
            <text x="40" y="14" fill="#64748b" fontSize="8" fontFamily="monospace">INT</text>
            <text x="82" y="14" fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="600">0.0%</text>
            {/* Green Checkmark */}
            <g transform="translate(128, 5)">
              <circle cx="6" cy="6" r="6" fill="#10b981" fillOpacity="0.2" />
              <path d="M3.5 6 L5.2 7.7 L8.5 4.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          </g>

          {/* Row 2: email (Whitespace/Null Issue Highlighted) */}
          <g transform="translate(325, 140)">
            <rect x="0" y="0" width="155" height="22" rx="4" fill="#090d16" stroke="#f59e0b" strokeWidth="0.8" className="anim-dq-row-highlight" />
            <text x="8" y="14" fill="#e2e8f0" fontSize="8.5" fontFamily="monospace">email</text>
            <text x="40" y="14" fill="#64748b" fontSize="8" fontFamily="monospace">STR</text>
            <text x="82" y="14" fill="#f59e0b" fontSize="8" fontFamily="monospace" fontWeight="600">2.4%</text>
            {/* Amber Warning Icon */}
            <g transform="translate(128, 5)">
              <circle cx="6" cy="6" r="6" fill="#f59e0b" fillOpacity="0.2" />
              <path d="M6 3.5 L6 7.5 M6 9.5 L6 9.8" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </g>
          </g>

          {/* Row 3: amount (Clean / Number) */}
          <g transform="translate(325, 166)">
            <rect x="0" y="0" width="155" height="22" rx="4" fill="#090d16" stroke="#1e293b" strokeWidth="0.6" />
            <text x="8" y="14" fill="#e2e8f0" fontSize="8.5" fontFamily="monospace">amount</text>
            <text x="40" y="14" fill="#64748b" fontSize="8" fontFamily="monospace">DEC</text>
            <text x="82" y="14" fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="600">0.0%</text>
            {/* Green Checkmark */}
            <g transform="translate(128, 5)">
              <circle cx="6" cy="6" r="6" fill="#10b981" fillOpacity="0.2" />
              <path d="M3.5 6 L5.2 7.7 L8.5 4.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          </g>

          {/* Row 4: created_at (Date Quality OK) */}
          <g transform="translate(325, 192)">
            <rect x="0" y="0" width="155" height="22" rx="4" fill="#090d16" stroke="#1e293b" strokeWidth="0.6" />
            <text x="8" y="14" fill="#e2e8f0" fontSize="8.5" fontFamily="monospace">created_at</text>
            <text x="40" y="14" fill="#64748b" fontSize="8" fontFamily="monospace">DATE</text>
            <text x="82" y="14" fill="#06b6d4" fontSize="8" fontFamily="monospace" fontWeight="600">100%</text>
            {/* Green Checkmark */}
            <g transform="translate(128, 5)">
              <circle cx="6" cy="6" r="6" fill="#10b981" fillOpacity="0.2" />
              <path d="M3.5 6 L5.2 7.7 L8.5 4.5" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          </g>

          {/* Dynamic Scanning Laser Bar */}
          <g transform="translate(325, 114)">
            <line x1="0" y1="0" x2="155" y2="0" stroke="#06b6d4" strokeWidth="1.5" opacity="0.8" className="anim-dq-scan" />
          </g>

          {/* Quality Summary Footer inside Inspector */}
          <g transform="translate(325, 224)">
            <rect x="0" y="0" width="155" height="34" rx="6" fill="#090d16" stroke="#334155" strokeWidth="0.8" />
            <g transform="translate(8, 7)">
              <text x="0" y="10" fill="#94a3b8" fontSize="8" fontFamily="sans-serif">Overall Health Score</text>
              <text x="0" y="20" fill="#10b981" fontSize="11" fontFamily="monospace" fontWeight="bold">98.4 / 100</text>
              <rect x="95" y="4" width="44" height="15" rx="7.5" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="0.8" />
              <text x="105" y="14.5" fill="#34d399" fontSize="7.5" fontFamily="sans-serif" fontWeight="bold">OPTIMAL</text>
            </g>
          </g>
        </g>

        {/* 7. Floating Satellite Widget: Shield Quality Seal (Top Left) */}
        <g className="anim-dq-float-shield" filter="url(#dqShadow)">
          <rect x="235" y="45" width="85" height="46" rx="8" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
          <g transform="translate(243, 53)">
            <rect x="0" y="0" width="34" height="4" rx="2" fill="#94a3b8" />
            <text x="0" y="22" fill="#10b981" fontSize="13" fontFamily="monospace" fontWeight="bold">0</text>
            <text x="12" y="21" fill="#34d399" fontSize="8" fontFamily="sans-serif"> Duplicates</text>
            <circle cx="62" cy="14" r="8" fill="#10b981" fillOpacity="0.15" />
            <path d="M59 14 L61 16 L65 12" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </g>

        {/* 8. Floating Satellite Widget: Search / Anomaly Inspector Pill (Bottom Right) */}
        <g className="anim-dq-float-pill" filter="url(#dqShadow)">
          <rect x="285" y="272" width="150" height="32" rx="16" fill="#0f172a" stroke="#06b6d4" strokeWidth="1" opacity="0.95" />
          <circle cx="302" cy="288" r="6" fill="#06b6d4" fillOpacity="0.2" />
          {/* Magnifying Glass Icon */}
          <circle cx="301" cy="287" r="3.5" stroke="#06b6d4" strokeWidth="1.2" fill="none" />
          <line x1="303.5" y1="289.5" x2="306" y2="292" stroke="#06b6d4" strokeWidth="1.2" strokeLinecap="round" />
          <text x="314" y="291" fill="#e2e8f0" fontSize="9" fontFamily="sans-serif" fontWeight="600">
            Automated Quality Audit
          </text>
        </g>
      </svg>
    </div>
  );
};
