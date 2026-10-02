import React from 'react';
import {
  History,
  X,
  Play,
  Edit3,
  Trash2,
  Clock,
  Table as TableIcon,
  Layers,
  ArrowRight
} from 'lucide-react';
import { AnalysisHistoryItem } from '../../types/analysis';

interface AnalysisHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: AnalysisHistoryItem[];
  onSelectHistoryItem: (item: AnalysisHistoryItem, action: 'run' | 'edit') => void;
  onClearHistory: () => void;
}

export const AnalysisHistoryDrawer: React.FC<AnalysisHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="analysis-history-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="analysis-history-drawer"
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl text-slate-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Analysis History</h3>
              <p className="text-[11px] text-slate-400">
                {history.length} saved analysis configuration{history.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                title="Clear Analysis History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 analysis-scroll-dark">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
              <History className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium text-slate-400">No analyses performed yet</p>
              <p className="text-[11px] text-slate-500">
                Run an operation from the Analysis Toolkit to record it here for quick re-execution.
              </p>
            </div>
          ) : (
            history.map(item => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                  <TableIcon className="w-3 h-3 text-emerald-400" />
                  <span className="truncate">{item.tables.join(', ')}</span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-1">
                  {item.summary}
                </p>

                <pre className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 truncate">
                  {item.sql.replace(/\n/g, ' ')}
                </pre>

                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-850">
                  <button
                    onClick={() => onSelectHistoryItem(item, 'edit')}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit SQL</span>
                  </button>
                  <button
                    onClick={() => onSelectHistoryItem(item, 'run')}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Query</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
