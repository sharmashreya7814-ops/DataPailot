import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Table as TableIcon,
  Search,
  History,
  Filter,
  Sigma,
  Layers,
  GitMerge,
  Calculator,
  Calendar,
  Award,
  Users,
  DollarSign,
  Package,
  ShieldAlert,
  Network,
  Columns,
  Code2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  DiscoveredTable,
  TableDetailsResult,
  QueryExecutionResult
} from '../../types/database';
import {
  AnalysisCategory,
  GeneratedAnalysisQuery,
  AnalysisHistoryItem
} from '../../types/analysis';
import { DatabaseApiClient } from '../../services/databaseApi';
import { SqlPreviewModal } from './SqlPreviewModal';
import { AnalysisHistoryDrawer } from './AnalysisHistoryDrawer';
import { BasicOperationsBuilder } from './builders/BasicOperationsBuilder';
import { FilterBuilder } from './builders/FilterBuilder';
import { AggregationBuilder } from './builders/AggregationBuilder';
import { GroupByBuilder } from './builders/GroupByBuilder';
import { JoinBuilder } from './builders/JoinBuilder';
import { CalculationsBuilder } from './builders/CalculationsBuilder';
import { DateAnalysisBuilder } from './builders/DateAnalysisBuilder';
import { WindowFunctionsBuilder } from './builders/WindowFunctionsBuilder';
import { BusinessTemplatesBuilder } from './builders/BusinessTemplatesBuilder';
import { DataQualityBuilder } from './builders/DataQualityBuilder';
import { AdvancedAnalyticsBuilder } from './builders/AdvancedAnalyticsBuilder';

interface AnalysisStudioProps {
  connectionType?: string;
  selectedTable: DiscoveredTable | null;
  allTables: DiscoveredTable[];
  onSelectTable: (table: DiscoveredTable) => void;
  onExecuteQuery: (sql: string, queryMeta?: GeneratedAnalysisQuery) => Promise<QueryExecutionResult>;
  onEditInEditor: (sql: string) => void;
  isRunningQuery?: boolean;
  onAddToDashboard?: (query: GeneratedAnalysisQuery) => void;
  selectedSchema?: string;
  onSelectSchema?: (schema: string) => void;
  schemas?: string[];
}

const CATEGORIES: {
  id: AnalysisCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  { id: 'BASIC', label: 'Basic', icon: Columns, description: 'Preview, column projection, sorting, limits' },
  { id: 'FILTERING', label: 'Filtering', icon: Filter, description: 'Multi-condition visual WHERE clauses' },
  { id: 'AGGREGATION', label: 'Aggregation', icon: Sigma, description: 'Global table metrics (SUM, AVG, MIN, MAX)' },
  { id: 'GROUPING', label: 'Grouping', icon: Layers, description: 'Multi-dimension GROUP BY & HAVING' },
  { id: 'JOIN', label: 'Join', icon: GitMerge, description: 'Multi-table queries with confirmed FK links' },
  { id: 'CALCULATIONS', label: 'Calculations', icon: Calculator, description: 'CASE statements & calculated expressions' },
  { id: 'DATE_ANALYSIS', label: 'Date Analysis', icon: Calendar, description: 'Time-series trends, MoM & YoY growth' },
  { id: 'RANKING', label: 'Ranking', icon: Award, description: 'Top N per group & leaderboard rankings' },
  { id: 'WINDOW_FUNCTIONS', label: 'Window Functions', icon: Layers, description: 'OVER() partitions, moving frames, lags' },
  { id: 'CUSTOM_COLUMNS', label: 'Custom Columns', icon: Calculator, description: 'Calculated expressions & arithmetic columns' },
  { id: 'CUSTOMER_ANALYSIS', label: 'Customer Analysis', icon: Users, description: 'RFM, retention, repeat buyers, AOV' },
  { id: 'SALES_ANALYSIS', label: 'Sales Analysis', icon: DollarSign, description: 'Revenue trends, ticket sizes, dimension share' },
  { id: 'PRODUCT_ANALYSIS', label: 'Product Analysis', icon: Package, description: 'Catalog velocity, rankings, revenue share' },
  { id: 'DATA_QUALITY', label: 'Data Quality', icon: ShieldAlert, description: 'NULL rates, duplicates, health profiling' },
  { id: 'ADVANCED_ANALYTICS', label: 'Advanced Analytics', icon: Network, description: 'Cohort matrix, retention curves, funnels' }
];

const LOCAL_STORAGE_HISTORY_KEY = 'datapilot_analysis_history';

export const AnalysisStudio: React.FC<AnalysisStudioProps> = ({
  connectionType = 'postgresql',
  selectedTable,
  allTables,
  onSelectTable,
  onExecuteQuery,
  onEditInEditor,
  isRunningQuery = false,
  onAddToDashboard,
  selectedSchema: controlledSchema,
  onSelectSchema,
  schemas = []
}) => {
  const [activeCategory, setActiveCategory] = useState<AnalysisCategory>('BASIC');
  const [tableDetails, setTableDetails] = useState<TableDetailsResult | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [localSchema, setLocalSchema] = useState<string>('');

  const activeSchema = controlledSchema !== undefined ? controlledSchema : localSchema;

  const handleSchemaChange = (newSchema: string) => {
    setLocalSchema(newSchema);
    onSelectSchema?.(newSchema);
    if (newSchema && newSchema !== 'ALL') {
      const firstInSchema = allTables.find(t => t.schema === newSchema);
      if (firstInSchema) {
        onSelectTable(firstInSchema);
      }
    }
  };

  // Discover all unique non-imported schemas from database and tables
  const availableSchemas = useMemo(() => {
    const schemaSet = new Set<string>();
    if (schemas && Array.isArray(schemas)) {
      schemas.forEach(s => {
        if (s && s !== 'imported') schemaSet.add(s);
      });
    }
    allTables.forEach(t => {
      if (t.schema && t.schema !== 'imported') {
        schemaSet.add(t.schema);
      }
    });

    return Array.from(schemaSet).sort((a, b) => {
      if (a === 'public') return -1;
      if (b === 'public') return 1;
      return a.localeCompare(b);
    });
  }, [schemas, allTables]);

  // Filter tables by active schema if selected
  const schemaFilteredTables = useMemo(() => {
    if (!activeSchema || activeSchema === 'ALL') {
      return allTables;
    }
    return allTables.filter(t => t.schema === activeSchema);
  }, [allTables, activeSchema]);

  // Synchronize selected table when active schema changes
  useEffect(() => {
    if (schemaFilteredTables.length > 0) {
      if (!selectedTable || !schemaFilteredTables.some(t => t.schema === selectedTable.schema && t.name === selectedTable.name)) {
        onSelectTable(schemaFilteredTables[0]);
      }
    }
  }, [schemaFilteredTables, selectedTable, onSelectTable]);

  // Search filter across categories
  const [searchQuery, setSearchQuery] = useState('');

  // Modal & History state
  const [previewQuery, setPreviewQuery] = useState<GeneratedAnalysisQuery | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<AnalysisHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (stored) {
        setHistoryItems(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveHistoryItem = (query: GeneratedAnalysisQuery) => {
    const newItem: AnalysisHistoryItem = {
      id: `hist-${Date.now()}`,
      name: query.name,
      category: query.category,
      timestamp: new Date().toISOString(),
      tables: query.tablesUsed,
      columns: query.columnsUsed,
      sql: query.sql,
      summary: query.description
    };

    setHistoryItems(prev => {
      const updated = [newItem, ...prev.filter(item => item.sql !== newItem.sql)].slice(0, 30);
      try {
        localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    try {
      localStorage.removeItem(LOCAL_STORAGE_HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  // Load selected table details
  useEffect(() => {
    if (!selectedTable) {
      if (schemaFilteredTables.length > 0) {
        onSelectTable(schemaFilteredTables[0]);
      }
      return;
    }

    setIsLoadingDetails(true);
    setDetailsError(null);

    DatabaseApiClient.getTableDetails(selectedTable.schema, selectedTable.name)
      .then(res => {
        setTableDetails(res);
      })
      .catch(err => {
        setDetailsError(err instanceof Error ? err.message : 'Failed to fetch table details');
      })
      .finally(() => {
        setIsLoadingDetails(false);
      });
  }, [selectedTable?.schema, selectedTable?.name, schemaFilteredTables]);

  const handlePreviewQuery = (query: GeneratedAnalysisQuery) => {
    setPreviewQuery(query);
    setIsModalOpen(true);
  };

  const handleRunQuery = async (sql: string, queryMeta: GeneratedAnalysisQuery) => {
    saveHistoryItem(queryMeta);
    setIsModalOpen(false);
    await onExecuteQuery(sql, queryMeta);
  };

  const handleEditInEditor = (sql: string) => {
    setIsModalOpen(false);
    onEditInEditor(sql);
  };

  const handleHistoryAction = async (item: AnalysisHistoryItem, action: 'run' | 'edit') => {
    setIsHistoryOpen(false);
    if (action === 'edit') {
      onEditInEditor(item.sql);
    } else {
      await onExecuteQuery(item.sql, {
        name: item.name,
        category: item.category,
        description: item.summary,
        tablesUsed: item.tables,
        columnsUsed: item.columns,
        sql: item.sql
      });
    }
  };

  // Filter categories by search
  const filteredCategories = CATEGORIES.filter(c =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Top Banner: Schema selector, Table selector, History button, Search */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Easy Data Analysis Toolkit</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Phase 5 Active
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Perform complete data analyst workflows visually without manual SQL coding.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Schema Selector (if multiple schemas exist) */}
          {availableSchemas.length > 1 && (
            <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] uppercase font-semibold text-slate-400">Schema:</span>
              <select
                value={activeSchema || 'ALL'}
                onChange={e => handleSchemaChange(e.target.value === 'ALL' ? '' : e.target.value)}
                className="bg-transparent text-xs font-mono font-medium text-slate-200 focus:outline-none cursor-pointer"
                aria-label="Select Schema"
              >
                <option value="ALL" className="bg-slate-900">
                  All Schemas ({allTables.filter(t => t.schema !== 'imported').length})
                </option>
                {availableSchemas.map(s => {
                  const count = allTables.filter(t => t.schema === s).length;
                  return (
                    <option key={s} value={s} className="bg-slate-900">
                      {s} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Active Table Selector */}
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={selectedTable ? `${selectedTable.schema}.${selectedTable.name}` : ''}
              onChange={e => {
                const match = allTables.find(t => `${t.schema}.${t.name}` === e.target.value);
                if (match) onSelectTable(match);
              }}
              className="bg-transparent text-xs font-mono font-medium text-slate-200 focus:outline-none max-w-[240px] cursor-pointer"
              aria-label="Select Table"
            >
              {schemaFilteredTables.map(t => (
                <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`} className="bg-slate-900">
                  {t.schema}.{t.name}
                </option>
              ))}
            </select>
            {tableDetails && (
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                ({tableDetails.columns.length} cols)
              </span>
            )}
          </div>

          {/* Analysis History Button */}
          <button
            id="btn-open-analysis-history"
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-slate-800 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>History</span>
            {historyItems.length > 0 && (
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded-full font-mono">
                {historyItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Categories Navigation Bar (Pill Scroll) */}
      <div className="border-b border-slate-800 bg-slate-900/30 px-4 py-2 flex items-center space-x-2 overflow-x-auto no-scrollbar">
        {filteredCategories.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Builder Container */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoadingDetails ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs">Loading table schema & metadata...</p>
            </div>
          ) : detailsError ? (
            <div className="p-6 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 space-y-2">
              <div className="flex items-center space-x-2 font-semibold text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Error Loading Schema</span>
              </div>
              <p className="text-xs text-rose-400">{detailsError}</p>
            </div>
          ) : !tableDetails ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <TableIcon className="w-8 h-8 opacity-40" />
              <p className="text-xs">Select a table to begin building analyses.</p>
            </div>
          ) : (
            <>
              {/* Category Active Builder Component */}
              {activeCategory === 'BASIC' && (
                <BasicOperationsBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'FILTERING' && (
                <FilterBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'AGGREGATION' && (
                <AggregationBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'GROUPING' && (
                <GroupByBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'JOIN' && (
                <JoinBuilder
                  table={tableDetails}
                  allTables={schemaFilteredTables}
                  onPreviewQuery={handlePreviewQuery}
                />
              )}

              {activeCategory === 'CALCULATIONS' && (
                <CalculationsBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'CUSTOM_COLUMNS' && (
                <CalculationsBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'DATE_ANALYSIS' && (
                <DateAnalysisBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {(activeCategory === 'RANKING' || activeCategory === 'WINDOW_FUNCTIONS') && (
                <WindowFunctionsBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'CUSTOMER_ANALYSIS' && (
                <BusinessTemplatesBuilder
                  table={tableDetails}
                  category="CUSTOMER_ANALYSIS"
                  onPreviewQuery={handlePreviewQuery}
                />
              )}

              {activeCategory === 'SALES_ANALYSIS' && (
                <BusinessTemplatesBuilder
                  table={tableDetails}
                  category="SALES_ANALYSIS"
                  onPreviewQuery={handlePreviewQuery}
                />
              )}

              {activeCategory === 'PRODUCT_ANALYSIS' && (
                <BusinessTemplatesBuilder
                  table={tableDetails}
                  category="PRODUCT_ANALYSIS"
                  onPreviewQuery={handlePreviewQuery}
                />
              )}

              {activeCategory === 'DATA_QUALITY' && (
                <DataQualityBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}

              {activeCategory === 'ADVANCED_ANALYTICS' && (
                <AdvancedAnalyticsBuilder table={tableDetails} onPreviewQuery={handlePreviewQuery} />
              )}
            </>
          )}
        </div>
      </div>

      {/* SQL Preview Modal */}
      <SqlPreviewModal
        connectionType={connectionType}
        isOpen={isModalOpen}
        query={previewQuery}
        onClose={() => setIsModalOpen(false)}
        onRunQuery={handleRunQuery}
        onEditInEditor={handleEditInEditor}
        isRunning={isRunningQuery}
        onAddToDashboard={onAddToDashboard}
      />

      {/* Analysis History Drawer */}
      <AnalysisHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyItems}
        onSelectHistoryItem={handleHistoryAction}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
};
