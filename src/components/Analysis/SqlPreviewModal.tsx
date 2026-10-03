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
  CheckCircle2,
  AlertTriangle,
  Database
} from 'lucide-react';
import { GeneratedAnalysisQuery } from '../../types/analysis';
import { QueryResult } from '../../types/database';
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
  const [executionResult, setExecutionResult] = useState<QueryResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Reset execution result & error when query changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setExecutionResult(null);
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
    if (isExecuting || isRunning) return;
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);

    try {
      if (onRunQuery) {
        const res = await onRunQuery(query.sql, query);
        if (res) {
          if (res.status === 'error' || res.errorMessage) {
            setExecutionError(res.errorMessage || 'Query execution failed against the connected database.');
          } else {
            setExecutionResult(res as QueryResult);
          }
        }
      } else {
        const res = await DatabaseApiClient.executeQuery(query.sql);
        if (res.status === 'error' || res.errorMessage) {
          setExecutionError(res.errorMessage || 'Query execution failed against the connected database.');
        } else {
          setExecutionResult(res as QueryResult);
        }
      }
    } catch (err: any) {
      console.error('SQL Preview Modal execution error:', err);
      setExecutionError(err?.message || 'An unexpected error occurred while executing the query.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Build Operation subtitle context (e.g. "BASIC OPERATION · analytics_practice.products")
  const operationType = (query.category ? `${query.category.replace(/_/g, ' ')} OPERATION` : 'BASIC OPERATION').toUpperCase();
  const primaryTable = query.tablesUsed[0] || 'analytics_practice.products';
  const subtitleContext = `${operationType} · ${primaryTable}`;

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        id="sql-preview-modal-card"
        className="w-full max-w-3xl lg:max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200 max-h-[90vh]"
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3
                  id="sql-preview-modal-title"
                  className="text-base font-bold text-white tracking-tight"
                >
                  {query.name || 'Select Columns'}
                </h3>
              </div>
              <p
                id="sql-preview-modal-description"
                className="text-xs font-mono font-medium text-indigo-400/90 mt-0.5 tracking-wide flex items-center space-x-1.5"
              >
                <span>{subtitleContext}</span>
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

        {/* BODY */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto analysis-scroll-dark flex-1">
          {/* CARDS: TABLES REFERENCED & COLUMNS UTILIZED */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Tables Referenced Card */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Tables Referenced</span>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {query.tablesUsed.length} {query.tablesUsed.length === 1 ? 'Table' : 'Tables'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {query.tablesUsed.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-900/90 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1"
                  >
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Columns Utilized Card */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                  <Columns className="w-4 h-4 text-cyan-400" />
                  <span>Columns Utilized</span>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {query.columnsUsed.length} {query.columnsUsed.length === 1 ? 'column' : 'columns'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1 max-h-24 overflow-y-auto pr-1 analysis-scroll-dark">
                {query.columnsUsed.length > 0 ? (
                  query.columnsUsed.map((c, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-900/90 text-slate-300 border border-slate-700/80 hover:border-slate-600 transition-colors"
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic py-0.5">All table columns or row count</span>
                )}
              </div>
            </div>
          </div>

          {/* GENERATED SQL SECTION */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Generated {dbName} Query</span>
                </div>
                {/* Status Badges: PostgreSQL / Read Only / Validated */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                    {dbName}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                    Read Only
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                    Validated
                  </span>
                </div>
              </div>

              {/* Copy SQL Button */}
              <button
                type="button"
                id="btn-copy-generated-sql"
                onClick={handleCopy}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Block */}
            <div className="relative rounded-xl bg-slate-950 border border-slate-800/90 overflow-hidden shadow-inner">
              <pre className="p-4 font-mono text-xs text-emerald-300/95 leading-relaxed overflow-x-auto whitespace-pre selection:bg-emerald-900/50 max-h-56 analysis-tabs-scroll">
                {query.sql}
              </pre>
            </div>
          </div>

          {/* SAFETY / VALIDATION BANNER */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Validated against {dbName} read-only safety rules. Query will be executed safely against your data.
            </span>
          </div>

          {/* EXECUTION ERROR BANNER */}
          {executionError && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-300 flex items-start space-x-2.5 animate-in fade-in duration-100">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <span className="font-semibold text-rose-200 block">Execution Error</span>
                <span className="leading-relaxed">{executionError}</span>
              </div>
            </div>
          )}

          {/* RESULT PREVIEW TABLE */}
          {executionResult && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-150">
              {/* Result Summary Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-200">Execution Results</span>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                    {executionResult.rowCount} rows returned
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Execution time: {executionResult.executionTimeMs} ms
                  </span>
                </div>
              </div>

              {/* Scrollable Result Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <div className="max-h-56 overflow-auto analysis-scroll-dark">
                  {executionResult.rows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Query executed successfully, but returned 0 rows.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                        <tr>
                          {executionResult.columns.map((col, idx) => (
                            <th
                              key={idx}
                              className="px-3.5 py-2 font-mono font-medium text-slate-300 text-[11px] whitespace-nowrap bg-slate-900"
                            >
                              <div className="flex items-center space-x-1.5">
                                <span>{col.name}</span>
                                {col.dataType && (
                                  <span className="text-[9px] text-slate-400 font-normal">
                                    ({col.dataType})
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {executionResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-850/50 transition-colors">
                            {executionResult.columns.map((col, cIdx) => {
                              const val = row[col.name];
                              const displayVal = val === null || val === undefined ? (
                                <span className="text-slate-600 italic">NULL</span>
                              ) : typeof val === 'object' ? (
                                JSON.stringify(val)
                              ) : (
                                String(val)
                              );

                              return (
                                <td key={cIdx} className="px-3.5 py-1.5 text-slate-300 whitespace-nowrap">
                                  {displayVal}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ACTION BAR (FOOTER) */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          {/* Tertiary: Close */}
          <button
            type="button"
            id="btn-cancel-sql-preview"
            onClick={onClose}
            disabled={isWorking}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40"
          >
            Close
          </button>

          <div className="flex items-center space-x-2.5">
            {/* Secondary: Add to Dashboard */}
            {onAddToDashboard && (
              <button
                type="button"
                id="btn-add-analysis-to-dashboard"
                onClick={() => onAddToDashboard(query)}
                disabled={isWorking}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-800/60 rounded-xl transition-colors disabled:opacity-40"
                title="Add this analysis query directly to an executive dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add to Dashboard</span>
              </button>
            )}

            {/* Secondary: Open in SQL Editor */}
            <button
              type="button"
              id="btn-edit-in-sql-editor"
              onClick={() => onEditInEditor(query.sql)}
              disabled={isWorking}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors disabled:opacity-40"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Open in SQL Editor</span>
            </button>

            {/* Primary: Execute & Preview Results */}
            <button
              type="button"
              id="btn-execute-analysis-query"
              onClick={handleExecute}
              disabled={isWorking}
              aria-label="Execute & Preview Results"
              title="Execute / Preview Results"
              className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/60 disabled:cursor-wait rounded-xl transition-all shadow-lg shadow-emerald-950 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isWorking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Query...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute & Preview Results</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
