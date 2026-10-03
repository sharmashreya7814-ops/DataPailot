import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table as TableIcon,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Terminal,
  Download,
  Copy,
  Check,
  Info,
  XCircle,
  Sparkles,
  PieChart,
  LayoutDashboard,
  FileSpreadsheet,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { QueryExecutionResult } from '../../types/database';
import { ExcelExportService } from '../../services/excelExportService';
import { ExcelExportModal } from './ExcelExportModal';

interface QueryResultsProps {
  result: QueryExecutionResult | null;
  isRunning: boolean;
  onCancelQuery?: () => void;
  onExplainResults?: (result: QueryExecutionResult) => void;
  onFixSqlError?: (failedSql: string, errorMessage: string) => void;
  onNavigateToVisualization?: () => void;
  onAddToDashboard?: (result: QueryExecutionResult) => void;
  sourceName?: string;
  analysisName?: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const QueryResults: React.FC<QueryResultsProps> = ({
  result,
  isRunning,
  onCancelQuery,
  onExplainResults,
  onFixSqlError,
  onNavigateToVisualization,
  onAddToDashboard,
  sourceName,
  analysisName,
  isCollapsible,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<{ name: string; startX: number; startWidth: number } | null>(null);

  // Pagination for large result sets (> 200 rows)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 200;

  // Reset page & filter when result changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchFilter('');
    setSortColumn(null);
  }, [result?.timestamp]);

  // Handle column resizing via mouse drag
  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(80, resizingCol.startWidth + deltaX);
      setColumnWidths(prev => ({
        ...prev,
        [resizingCol.name]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  const handleStartResize = (e: React.MouseEvent, colName: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({
      name: colName,
      startX: e.clientX,
      startWidth: currentWidth || 140
    });
  };

  const handleSort = (colName: string) => {
    if (sortColumn === colName) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colName);
      setSortDirection('asc');
    }
  };

  const copyAsJson = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCsv = () => {
    if (!result?.rows || !result.columns) return;
    const colNames = result.columns.map(c => c.name);
    const header = colNames.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const csvRows = result.rows.map(row =>
      colNames
        .map(col => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          // Mitigate CSV formula injection
          if (/^[=+\-@\t\r]/.test(str)) {
            str = `'${str}`;
          }
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!result?.rows || !result.columns || result.rows.length === 0) return;
    setIsExportingExcel(true);
    setExportError(null);
    try {
      const tableSource = sourceName || ExcelExportService.extractTableFromSql(result.query);
      const filename = ExcelExportService.generateExcelFilename(tableSource || undefined);
      ExcelExportService.exportQueryResultToExcel(result.columns, result.rows, {
        filename,
        sourceName: tableSource || undefined,
        sheetName: tableSource || 'Query Results'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export query results to Excel.';
      console.error('Failed to export Excel file:', err);
      setExportError(msg);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Filtered & Sorted rows calculation
  const filteredAndSortedRows = useMemo(() => {
    if (!result?.rows) return [];
    let rows = result.rows;

    // Filter by text search if provided
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      rows = rows.filter(r =>
        Object.values(r).some(val => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    // Sort rows if sorted column is active
    if (sortColumn) {
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return rows;
  }, [result?.rows, searchFilter, sortColumn, sortDirection]);

  // Paginated slice
  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const displayedRows = useMemo(() => {
    if (filteredAndSortedRows.length <= pageSize) return filteredAndSortedRows;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  return (
    <div
      id="query-results-panel"
      className="flex flex-col h-full bg-slate-900 text-slate-200 overflow-hidden min-h-0"
    >
      {/* Header Tabs & Controls */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900 select-none flex-wrap gap-1.5 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-200">
            <TableIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Query Results</span>
          </div>

          {result && result.status === 'success' && (
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 font-mono">
                {result.rowCount.toLocaleString()} {result.rowCount === 1 ? 'row' : 'rows'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                {result.columns.length} cols
              </span>
              {result.isTruncated && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-semibold">
                  Limited
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Controls when Results Exist */}
        {result && result.status === 'success' && result.rows.length > 0 && (
          <div className="flex items-center space-x-1.5 flex-wrap">
            {/* Quick in-table Search Filter */}
            {result.rows.length > 5 && (
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Filter rows..."
                  className="pl-7 pr-2 py-0.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-slate-600 font-mono w-28 md:w-36"
                />
              </div>
            )}

            {onNavigateToVisualization && (
              <button
                id="btn-quick-visualize"
                type="button"
                onClick={onNavigateToVisualization}
                className="flex items-center space-x-1.5 px-2 py-1 text-xs text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/80 rounded border border-purple-700/60 transition-colors"
                title="Visualize these query results"
                aria-label="Visualize query results"
              >
                <PieChart className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">Visualize</span>
              </button>
            )}
            {onAddToDashboard && (
              <button
                id="btn-add-to-dashboard"
                type="button"
                onClick={() => onAddToDashboard(result)}
                className="flex items-center space-x-1.5 px-2 py-1 text-xs text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 rounded border border-emerald-700/60 transition-colors"
                title="Add as dashboard widget"
                aria-label="Add to Dashboard"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Dashboard</span>
              </button>
            )}
            {onExplainResults && (
              <button
                id="btn-explain-results"
                type="button"
                onClick={() => onExplainResults(result)}
                className="flex items-center space-x-1.5 px-2 py-1 text-xs text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900/80 rounded border border-indigo-700/60 transition-colors"
                title="Explain query findings with AI"
                aria-label="Explain Results with AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Explain</span>
              </button>
            )}

            {/* Export Actions Group */}
            <div className="flex items-center space-x-1 border-l border-slate-800 pl-1.5">
              <button
                id="btn-copy-json"
                type="button"
                onClick={copyAsJson}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded border border-slate-700/60 transition-colors"
                title="Copy result as JSON"
                aria-label="Copy JSON"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'JSON'}</span>
              </button>
              <button
                id="btn-export-csv"
                type="button"
                onClick={exportCsv}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded border border-slate-700/60 transition-colors"
                title="Export as CSV"
                aria-label="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                id="btn-export-excel"
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                disabled={isExportingExcel || !result?.rows || result.rows.length === 0}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded border border-slate-700/60 transition-colors disabled:opacity-50"
                title="Export as Excel (.xlsx)"
                aria-label="Export Excel"
              >
                {isExportingExcel ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Excel</span>
              </button>
            </div>
          </div>
        )}

        {/* Toggle Collapse Button for Analysis View */}
        {isCollapsible && onToggleCollapse && (
          <div className="flex items-center ml-auto">
            <button
              id="btn-toggle-query-results"
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-controls="query-results-content"
              title={isCollapsed ? 'Show Results' : 'Hide Results'}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors shadow-xs"
            >
              {isCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Show Results</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hide Results</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div id="query-results-content" className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Excel Export Error Alert Banner */}
      {exportError && (
        <div
          id="export-excel-error-banner"
          className="px-3 py-1.5 bg-rose-950/60 border-b border-rose-900/60 text-[11px] text-rose-300 flex items-center justify-between select-none flex-shrink-0"
        >
          <div className="flex items-center space-x-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="truncate">Excel Export Failed: {exportError}</span>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-1 font-semibold ml-2"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Large Result Truncation Banner */}
      {result && result.status === 'success' && result.isTruncated && (
        <div
          id="result-truncated-banner"
          className="px-3 py-1 bg-amber-950/40 border-b border-amber-900/40 text-[11px] text-amber-200 flex items-center justify-between select-none flex-shrink-0"
        >
          <div className="flex items-center space-x-1.5 truncate">
            <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              Showing first {result.rowCount.toLocaleString()} rows (Truncated to protect browser memory).
            </span>
          </div>
          <span className="text-[10px] text-amber-400 font-mono flex-shrink-0 ml-2">
            Use LIMIT to refine
          </span>
        </div>
      )}

      {/* Main Results Body */}
      <div className="flex-1 overflow-auto relative min-h-0">
        {/* Loading state */}
        {isRunning && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin mb-2.5" />
            <p className="text-xs font-medium text-slate-300">Executing read-only analytical query...</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Retrieving typed rows from active database connection</p>
            {onCancelQuery && (
              <button
                onClick={onCancelQuery}
                className="mt-3 px-3 py-1 text-xs text-rose-400 hover:text-rose-300 bg-slate-800 hover:bg-slate-750 rounded border border-slate-700 transition-colors flex items-center space-x-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Execution</span>
              </button>
            )}
          </div>
        )}

        {/* Cancelled state */}
        {!isRunning && result?.status === 'cancelled' && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-amber-400 mb-2">
              <XCircle className="w-4 h-4 stroke-[1.5]" />
            </div>
            <h4 className="text-xs font-medium text-slate-200 mb-0.5">Query execution cancelled</h4>
            <p className="text-[11px] text-slate-400">The query was stopped before completion.</p>
          </div>
        )}

        {/* Error state */}
        {!isRunning && result?.status === 'error' && (
          <div className="p-4 overflow-auto">
            <div className="max-w-2xl mx-auto rounded-lg bg-rose-950/30 border border-rose-900/60 p-3.5 text-rose-200">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold text-xs mb-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>SQL Execution Error</span>
              </div>
              <pre className="font-mono text-xs text-rose-300/90 whitespace-pre-wrap bg-rose-950/60 p-2.5 rounded border border-rose-900/40 overflow-x-auto">
                {result.errorMessage || 'An error occurred while executing the SQL query.'}
              </pre>
              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-rose-900/40 gap-2">
                <span className="text-[11px] text-slate-400">
                  DataPilot enforces strict Read-Only mode and single statements.
                </span>
                {onFixSqlError && (
                  <button
                    id="btn-fix-with-ai"
                    onClick={() => onFixSqlError(result.query, result.errorMessage || '')}
                    className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors shadow-sm flex-shrink-0"
                    title="Diagnose error and propose fix with AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fix with AI</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state: No query has been executed yet */}
        {!isRunning && (!result || result.status === 'idle') && (
          <div
            id="empty-results-state"
            className="h-full flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="max-w-md w-full p-6 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center text-center shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <Terminal className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h4 className="text-xs font-semibold text-slate-200 mb-1 tracking-tight">No query executed yet</h4>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-3">
                Write a read-only SQL query and run it to view results.
              </p>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                <span className="text-slate-400">Shortcut:</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 text-[10px]">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 text-[10px]">Enter</kbd>
              </div>
            </div>
          </div>
        )}

        {/* Empty result set (query succeeded, 0 rows returned) */}
        {!isRunning && result?.status === 'success' && result.rowCount === 0 && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <div className="w-9 h-9 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2">
              <TableIcon className="w-4 h-4 stroke-[1.5]" />
            </div>
            <h4 className="text-xs font-medium text-slate-300 mb-0.5">0 rows returned</h4>
            <p className="text-[11px] text-slate-400">The query executed successfully but returned 0 rows.</p>
          </div>
        )}

        {/* Dynamic Data Table with Sticky Headers & Resizable Columns */}
        {!isRunning && result?.status === 'success' && result.rowCount > 0 && (
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full border-collapse text-left text-xs font-mono">
              <thead className="bg-slate-950/95 sticky top-0 z-10 border-b border-slate-800 text-slate-400 backdrop-blur-xs">
                <tr>
                  <th className="py-2 px-3 w-12 border-r border-slate-800 text-slate-600 font-normal select-none bg-slate-950/95 sticky left-0 z-20">
                    #
                  </th>
                  {result.columns.map(col => {
                    const isSorted = sortColumn === col.name;
                    const customWidth = columnWidths[col.name];

                    return (
                      <th
                        key={col.name}
                        style={{ width: customWidth ? `${customWidth}px` : undefined, minWidth: '110px' }}
                        className="relative py-2 px-3 border-r border-slate-800 font-semibold text-slate-300 select-none group"
                      >
                        <div
                          onClick={() => handleSort(col.name)}
                          className="flex items-center justify-between space-x-2 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className="truncate font-semibold text-slate-200">{col.name}</span>
                            <span className="text-[10px] text-slate-500 font-normal font-mono group-hover:text-slate-400">
                              {col.dataType}
                            </span>
                          </div>
                          <span className="text-slate-500 group-hover:text-slate-300 ml-1 flex-shrink-0">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-emerald-400" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                            )}
                          </span>
                        </div>

                        {/* Column Resize Handle */}
                        <div
                          onMouseDown={e => handleStartResize(e, col.name, customWidth || 140)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 transition-colors"
                          title="Drag to resize column"
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {displayedRows.map((row, rowIdx) => {
                  const absoluteRowIdx = (currentPage - 1) * pageSize + rowIdx + 1;
                  return (
                    <tr
                      key={rowIdx}
                      className="hover:bg-slate-800/50 transition-colors font-mono text-[11px]"
                    >
                      <td className="py-1.5 px-3 border-r border-slate-800 text-slate-600 select-none bg-slate-950/40 sticky left-0 z-10">
                        {absoluteRowIdx}
                      </td>
                      {result.columns.map(col => {
                        const value = row[col.name];
                        const isNull = value === null || value === undefined;
                        const isNumber = typeof value === 'number';

                        return (
                          <td
                            key={col.name}
                            title={isNull ? 'null' : String(value)}
                            className={`py-1.5 px-3 border-r border-slate-800/60 whitespace-nowrap truncate max-w-sm ${
                              isNumber ? 'text-right text-sky-300 font-medium' : 'text-slate-300'
                            }`}
                          >
                            {isNull ? (
                              <span className="text-slate-600 italic">null</span>
                            ) : typeof value === 'boolean' ? (
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                value
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {String(value)}
                              </span>
                            ) : isNumber ? (
                              <span>{value.toLocaleString()}</span>
                            ) : typeof value === 'object' ? (
                              <span className="text-indigo-300 truncate">{JSON.stringify(value)}</span>
                            ) : (
                              <span>{String(value)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer if > pageSize rows */}
      {result && result.status === 'success' && filteredAndSortedRows.length > pageSize && (
        <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 select-none flex-shrink-0">
          <span className="text-[11px]">
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredAndSortedRows.length)} of{' '}
            {filteredAndSortedRows.length.toLocaleString()} rows
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Excel Export Workflow Modal (Download vs Add to Workbook) */}
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        columns={result?.columns || []}
        rows={result?.rows || []}
        sourceName={sourceName}
        sqlQuery={result?.query}
        analysisName={analysisName}
        onDownloadSingle={exportExcel}
      />
    </div>
  );
};
