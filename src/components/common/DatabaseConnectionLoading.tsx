import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Sparkles, Server } from 'lucide-react';

export interface DatabaseConnectionLoadingProps {
  isOpen: boolean;
  databaseName?: string;
  databaseType?: string;
  statusMessage?: string;
  progressPercent?: number;
  className?: string;
}

const DEFAULT_STATUS_STEPS = [
  'Establishing secure connection',
  'Authenticating credentials',
  'Discovering database schema',
  'Loading tables and metadata'
];

export const DatabaseConnectionLoading: React.FC<DatabaseConnectionLoadingProps> = ({
  isOpen,
  databaseName,
  databaseType,
  statusMessage,
  progressPercent: manualProgress,
  className = ''
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [autoProgress, setAutoProgress] = useState(15);

  useEffect(() => {
    if (!isOpen) {
      setStepIndex(0);
      setAutoProgress(15);
      return;
    }

    // Step progression timer
    const stepInterval = setInterval(() => {
      setStepIndex(prev => {
        if (prev < DEFAULT_STATUS_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);

    // Smooth progress bar advancement
    const progressInterval = setInterval(() => {
      setAutoProgress(prev => {
        if (prev < 90) {
          return prev + Math.floor(Math.random() * 8) + 4;
        }
        return 92;
      });
    }, 200);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentMessage = statusMessage || DEFAULT_STATUS_STEPS[stepIndex] || DEFAULT_STATUS_STEPS[0];
  const displayProgress = manualProgress !== undefined ? manualProgress : autoProgress;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Connecting to database"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200 ${className}`}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl text-slate-200 p-7 flex flex-col items-center text-center space-y-5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Database Icon with animated pulse / glowing ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping opacity-60 scale-125" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-950 to-indigo-950/80 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-950/50 relative z-10">
            <Database className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          {/* Subtle spinning accent ring */}
          <div className="absolute -inset-1.5 rounded-2xl border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" style={{ animationDuration: '2s' }} />
        </div>

        {/* Title */}
        <div className="space-y-1 z-10">
          <h3 className="text-base font-bold text-white tracking-tight">
            Connecting to database...
          </h3>
          {databaseName && (
            <p className="text-xs font-mono text-indigo-300 flex items-center justify-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>{databaseName}</span>
              {databaseType && (
                <span className="text-[10px] uppercase font-sans px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {databaseType}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Dynamic Status Message with aria-live */}
        <div className="w-full space-y-3 z-10">
          <div
            aria-live="polite"
            className="text-xs font-medium text-slate-300 bg-slate-950/80 py-2 px-3 rounded-lg border border-slate-800 flex items-center justify-center space-x-2 min-h-[38px] transition-all duration-150"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate">{currentMessage}</span>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(displayProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Helper Note & Security Badge */}
        <div className="space-y-1.5 text-[11px] text-slate-500 z-10">
          <p>This may take a few seconds</p>
          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted zero-exposure connection</span>
          </div>
        </div>
      </div>
    </div>
  );
};
