import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GripHorizontal, ChevronUp, ChevronDown, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { SqlEditorTabs } from './SqlEditorTabs';
import { SqlEditor } from './SqlEditor';
import { QueryResults } from '../Results/QueryResults';
import {
  SqlEditorTab,
  QueryExecutionResult,
  QueryHistoryItem,
  DiscoveredTable,
  TableDetailsResult
} from '../../types/database';

const STORAGE_KEY_SPLIT = 'datapilot_sql_split_ratio';
const DEFAULT_SPLIT_RATIO = 58; // 58% editor, 42% results

interface SqlWorkspaceProps {
  // Tabs
  tabs: SqlEditorTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabAdd: () => void;
  onTabRename: (id: string, newName: string) => void;
  onTabDuplicate: (id: string) => void;

  // Editor
  sqlQuery: string;
  onChangeQuery: (query: string) => void;
  onRunQuery: () => void;
  onCancelQuery: () => void;
  onClearQuery: () => void;
  onExplainSql: (sql: string) => void;
  onAnalyzePerformance: (sql: string) => void;
  isRunningQuery: boolean;
  queryResult: QueryExecutionResult | null;
  queryHistory: QueryHistoryItem[];
  onSelectHistoryItem: (item: QueryHistoryItem) => void;
  onClearHistory: () => void;
  tables: DiscoveredTable[];
  tableDetailsCache: Record<string, TableDetailsResult>;
  onSaveQuery: () => void;
  onSaveAsQuery: () => void;
  onOpenLibrary: () => void;
  activeTab?: SqlEditorTab;
  savedQueries: any[];

  // Results
  onExplainResults: (result: QueryExecutionResult) => void;
  onFixSqlError: (failedSql: string, errorMessage: string) => void;
  onNavigateToVisualization: () => void;
  onAddToDashboardFromResults: (result: QueryExecutionResult) => void;
  selectedTable: DiscoveredTable | null;
  dialect?: string;
}

export const SqlWorkspace: React.FC<SqlWorkspaceProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
  onTabRename,
  onTabDuplicate,
  sqlQuery,
  onChangeQuery,
  onRunQuery,
  onCancelQuery,
  onClearQuery,
  onExplainSql,
  onAnalyzePerformance,
  isRunningQuery,
  queryResult,
  queryHistory,
  onSelectHistoryItem,
  onClearHistory,
  tables,
  tableDetailsCache,
  onSaveQuery,
  onSaveAsQuery,
  onOpenLibrary,
  activeTab,
  savedQueries,
  onExplainResults,
  onFixSqlError,
  onNavigateToVisualization,
  onAddToDashboardFromResults,
  selectedTable,
  dialect = 'postgresql'
}) => {
  // Split ratio: percentage of vertical height allocated to the SQL Editor (15% to 85%)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_SPLIT);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 15 && parsed <= 85) return parsed;
      }
    } catch {}
    return DEFAULT_SPLIT_RATIO;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save split ratio to sessionStorage
  const handleSetSplitRatio = useCallback((ratio: number) => {
    const clamped = Math.max(15, Math.min(85, Math.round(ratio)));
    setSplitRatio(clamped);
    try {
      sessionStorage.setItem(STORAGE_KEY_SPLIT, String(clamped));
    } catch {}
  }, []);

  // Dragging logic
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const offset = clientY - rect.top;
      const totalHeight = rect.height;
      if (totalHeight <= 0) return;

      const newRatio = (offset / totalHeight) * 100;
      handleSetSplitRatio(newRatio);
      if (isResultsCollapsed) {
        setIsResultsCollapsed(false);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, handleSetSplitRatio, isResultsCollapsed]);

  // Quick layout actions
  const handleCollapseResults = () => {
    setIsResultsCollapsed(true);
  };

  const handleExpandResults = () => {
    setIsResultsCollapsed(false);
    handleSetSplitRatio(30); // 30% editor, 70% results
  };

  const handleResetLayout = () => {
    setIsResultsCollapsed(false);
    handleSetSplitRatio(DEFAULT_SPLIT_RATIO);
  };

  // Keyboard adjustment for splitter
  const handleSplitterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsResultsCollapsed(false);
      handleSetSplitRatio(splitRatio - 5);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsResultsCollapsed(false);
      handleSetSplitRatio(splitRatio + 5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleSetSplitRatio(20);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleSetSplitRatio(80);
    }
  };

  const editorHeightStyle = isResultsCollapsed
    ? { height: 'calc(100% - 32px)' }
    : { height: `${splitRatio}%` };

  const resultsHeightStyle = isResultsCollapsed
    ? { height: '32px' }
    : { height: `${100 - splitRatio}%` };

  return (
    <div
      ref={containerRef}
      id="sql-workspace-container"
      className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden relative bg-slate-950 select-none"
    >
      {/* Invisible overlay during drag to prevent iframe / selection pointer traps */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-row-resize select-none" />
      )}

      {/* Top Section: Tabs + SQL Editor */}
      <div
        style={editorHeightStyle}
        className="flex flex-col min-h-[120px] overflow-hidden transition-[height] duration-75 ease-out select-text"
      >
        <SqlEditorTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={onTabSelect}
          onTabClose={onTabClose}
          onTabAdd={onTabAdd}
          onTabRename={onTabRename}
          onTabDuplicate={onTabDuplicate}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <SqlEditor
            query={sqlQuery}
            onSaveQuery={onSaveQuery}
            onSaveAsQuery={onSaveAsQuery}
            onOpenLibrary={onOpenLibrary}
            isSaved={!!activeTab?.savedQueryId}
            isModified={!!activeTab?.isModified}
            onRevertQuery={() => {
              if (activeTab?.savedQueryId) {
                const sq = savedQueries.find(q => q.id === activeTab.savedQueryId);
                if (sq) onChangeQuery(sq.query);
              }
            }}
            onChangeQuery={onChangeQuery}
            onRunQuery={onRunQuery}
            onCancelQuery={onCancelQuery}
            onClearQuery={onClearQuery}
            onExplainSql={onExplainSql}
            onAnalyzePerformance={onAnalyzePerformance}
            isRunning={isRunningQuery}
            lastResult={queryResult}
            history={queryHistory}
            onSelectHistoryItem={onSelectHistoryItem}
            onClearHistory={onClearHistory}
            tables={tables}
            tableDetailsCache={tableDetailsCache}
            dialect={dialect}
          />
        </div>
      </div>

      {/* Draggable Vertical Splitter Bar */}
      <div
        id="sql-workspace-splitter"
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-valuenow={splitRatio}
        aria-valuemin={15}
        aria-valuemax={85}
        aria-label="Resize Editor and Query Results"
        onKeyDown={handleSplitterKeyDown}
        className={`h-3 bg-slate-900/90 border-y border-slate-800/90 flex items-center justify-between px-3 cursor-row-resize hover:bg-slate-850 hover:border-slate-700/80 transition-all z-20 select-none flex-shrink-0 group ${
          isDragging ? 'bg-indigo-950/80 border-indigo-500/60 shadow-xs' : ''
        }`}
        onMouseDown={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onTouchStart={() => setIsDragging(true)}
      >
        {/* Left: Quick Splitter Layout Toggle */}
        <div className="flex items-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-300">
            {splitRatio}% Editor / {100 - splitRatio}% Results
          </span>
        </div>

        {/* Center: Enhanced Grip Drag Handle */}
        <div className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-slate-800/40 group-hover:bg-slate-800 text-slate-400 group-hover:text-slate-200 transition-all border border-transparent group-hover:border-slate-700/60">
          <GripHorizontal className="w-4 h-3.5 stroke-[2]" />
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={isResultsCollapsed ? handleResetLayout : handleCollapseResults}
            className="p-0.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
            title={isResultsCollapsed ? 'Restore Results Panel' : 'Collapse Results Panel (Maximize Editor)'}
            aria-label="Toggle Results Panel"
          >
            {isResultsCollapsed ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleExpandResults}
            className="p-0.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors hidden sm:inline-block"
            title="Expand Results (Maximize Results Grid)"
            aria-label="Expand Results"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleResetLayout}
            className="p-0.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
            title="Reset Default Split Layout (58% / 42%)"
            aria-label="Reset Layout"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Bottom Section: Query Results Panel */}
      <div
        style={resultsHeightStyle}
        className={`flex flex-col min-h-[32px] overflow-hidden transition-[height] duration-75 ease-out select-text ${
          isResultsCollapsed ? 'h-8 overflow-hidden' : ''
        }`}
      >
        <QueryResults
          result={queryResult}
          isRunning={isRunningQuery}
          onCancelQuery={onCancelQuery}
          onExplainResults={onExplainResults}
          onFixSqlError={onFixSqlError}
          onNavigateToVisualization={onNavigateToVisualization}
          onAddToDashboard={onAddToDashboardFromResults}
          sourceName={selectedTable?.name}
        />
      </div>
    </div>
  );
};
