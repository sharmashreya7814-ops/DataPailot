import React, { useState, useEffect } from 'react';
import {
  Play,
  Edit3,
  X,
  Copy,
  Check,
  Code2,
  Table as TableIcon,
  Columns,
  ShieldCheck,
  Layers,
  LayoutDashboard,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { GeneratedAnalysisQuery } from '../../types/analysis';
import { DatabaseApiClient } from '../../services/databaseApi';

interface SqlPreviewModalProps {
  connectionType?: string;
  query: GeneratedAnalysisQuery | null;
  isOpen: boolean;
  onClose: () => void;
  onRunQuery?: (sql: string, queryMeta: GeneratedAnalysisQuery) => Promise<any> | void;
  onEditInEditor: (sql: string) => void;
  isRunning?: boolean;
  onAddToDashboard?: (query: GeneratedAnalysisQuery) => void;
}

export const SqlPreviewModal: React.FC<SqlPreviewModalProps> = ({
  connectionType = 'postgresql',
  query,
  isOpen,
  onClose,
  onRunQuery,
  onEditInEditor,
  isRunning = false,
  onAddToDashboard
}) => {
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Reset execution error & execution state when query changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setExecutionError(null);
      setIsExecuting(false);
      setCopied(false);
    }
  }, [isOpen, query?.sql]);

  // Close on Escape key (disabled while executing)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExecuting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExecuting, onClose]);

  const getDbName = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'postgresql': return 'PostgreSQL';
      case 'sqlserver': return 'SQL Server';
      case 'mysql': return 'MySQL';
      case 'sqlite': return 'SQLite';
      case 'oracle': return 'Oracle';
      default: return 'PostgreSQL';
    }
  };

  const isImported = connectionType === 'sqlite' || (query?.tablesUsed.some(t => !t.includes('.') || t.startsWith('imported.')));
  const dbName = isImported ? 'SQLite' : getDbName(connectionType);

  if (!isOpen || !query) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(query.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = async () => {
    // Prevent double-click while executing or running
    if (isExecuting || isRunning) return;
    setIsExecuting(true);
    setExecutionError(null);

    try {
      let res: any;
      if (onRunQuery) {
        res = await onRunQuery(query.sql, query);
      } else {
        res = await DatabaseApiClient.executeQuery(query.sql);
      }

      if (res && (res.status === 'error' || res.errorMessage || (typeof res.success === 'boolean' && !res.success))) {
        setExecutionError(res.errorMessage || 'Query execution failed against the connected database.');
      } else {
        // On success: automatically close modal and return user to Analysis Toolkit
        onClose();
      }
    } catch (err: any) {
      console.error('SQL Preview Modal execution error:', err);
      setExecutionError(err?.message || 'An unexpected error occurred while executing the query.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Subtitle context (e.g. "Retrieve specific columns from analytics_practice.products")
  const primaryTable = query.tablesUsed[0] || 'analytics_practice.products';
  const subtitleContext = query.description || `Retrieve specific columns from ${primaryTable}`;
  const operationType = (query.category ? `${query.category.replace(/_/g, ' ')} OPERATION` : 'BASIC OPERATION').toUpperCase();

  const isWorking = isExecuting || isRunning;

  return (
    <div
      id="sql-preview-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sql-preview-modal-title"
      aria-describedby="sql-preview-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isWorking) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        id="sql-preview-modal-card"
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3
                  id="sql-preview-modal-title"
                  className="text-base font-semibold text-white tracking-tight"
                >
                  {query.name || 'Select Columns'}
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {query.category || 'BASIC'}
                </span>
              </div>
              <p
                id="sql-preview-modal-description"
                className="text-xs text-slate-400 mt-0.5"
                data-operation-context={operationType}
              >
                {subtitleContext}
              </p>
            </div>
          </div>

          <button
            id="btn-close-sql-preview"
            onClick={onClose}
            disabled={isWorking}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Metadata & SQL */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto analysis-scroll-dark">
          {/* Metadata badges: Tables & Columns used */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-400 mb-1.5">
                <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tables Referenced ({query.tablesUsed.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {query.tablesUsed.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-400 mb-1.5">
                <Columns className="w-3.5 h-3.5 text-cyan-400" />
                <span>Columns Utilized ({query.columnsUsed.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto analysis-scroll-dark">
                {query.columnsUsed.length > 0 ? (
                  query.columnsUsed.map((c, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">All table columns or row count</span>
                )}
              </div>
            </div>
          </div>

          {/* SQL Code Block */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Generated {dbName} Query</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {dbName}
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Read Only
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Validated
                </span>
              </div>
              <button
                type="button"
                id="btn-copy-generated-sql"
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded border border-slate-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre selection:bg-emerald-900/50 analysis-tabs-scroll max-h-36">
              {query.sql}
            </pre>
          </div>

          {/* Safety & Compliance notice */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Validated against {dbName} read-only safety rules. Query will be executed safely against your data.
            </span>
          </div>

          {/* Execution Error Banner (if error occurred) */}
          {executionError && (
            <div
              id="analysis-execution-error-banner"
              className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2.5 animate-in fade-in duration-150"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-200">Execution Error</span>
                  <button
                    type="button"
                    onClick={() => setExecutionError(null)}
                    className="text-slate-400 hover:text-slate-200 text-[11px]"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="leading-relaxed text-rose-300/90">{executionError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            id="btn-cancel-sql-preview"
            onClick={onClose}
            disabled={isWorking}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            Close
          </button>

          <div className="flex items-center space-x-3">
            {onAddToDashboard && (
              <button
                type="button"
                id="btn-add-analysis-to-dashboard"
                onClick={() => onAddToDashboard(query)}
                disabled={isWorking}
                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/60 rounded-lg transition-colors disabled:opacity-40"
                title="Add this analysis query directly to an executive dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add to Dashboard</span>
              </button>
            )}

            <button
              type="button"
              id="btn-edit-in-sql-editor"
              onClick={() => onEditInEditor(query.sql)}
              disabled={isWorking}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition-colors disabled:opacity-40"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Open in SQL Editor</span>
            </button>

            <button
              type="button"
              id="btn-execute-analysis-query"
              onClick={handleExecute}
              disabled={isWorking}
              aria-label="Execute"
              title="Execute"
              className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors shadow-lg shadow-emerald-950/40"
            >
              {isWorking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
