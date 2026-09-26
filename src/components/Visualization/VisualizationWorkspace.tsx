import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart2,
  Table as TableIcon,
  Sparkles,
  Download,
  Bookmark,
  Maximize2,
  Minimize2,
  AlertTriangle,
  RefreshCw,
  Database,
  Layers,
  Copy,
  Check,
  FileSpreadsheet,
  LayoutDashboard,
  Code,
  ChevronDown,
  ChevronUp,
  Loader2,
  DatabaseZap,
  HelpCircle
} from 'lucide-react';
import {
  QueryResult,
  DiscoveredTable,
  TableDetailsResult,
  SanitizedConnectionInfo
} from '../../types/database';
import {
  ChartConfig,
  ChartType,
  DetectedColumn,
  SavedVisualization,
  VisualizationInsight,
  ColumnSemanticType
} from '../../types/visualization';
import { ImportedDataset } from '../../types/import';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { ChartRecommender } from '../../services/chartRecommender';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';
import { VisualizationInsightsService } from '../../services/visualizationInsightsService';
import { VisualizationExportService } from '../../services/visualizationExportService';
import { VisualizationQueryBuilder } from '../../services/visualizationQueryBuilder';
import { DatabaseApiClient } from '../../services/databaseApi';
import { ChartConfigPanel } from './ChartConfigPanel';
import { InsightsDrawer } from './InsightsDrawer';
import { SavedVisualizationsModal } from './SavedVisualizationsModal';
import { SaveVisualizationDialog } from './SaveVisualizationDialog';

// Chart components
import { KpiCardView } from './charts/KpiCardView';
import { BarChartView } from './charts/BarChartView';
import { LineChartView } from './charts/LineChartView';
import { AreaChartView } from './charts/AreaChartView';
import { PieDonutView } from './charts/PieDonutView';
import { ScatterPlotView } from './charts/ScatterPlotView';
import { HistogramView } from './charts/HistogramView';
import { TableView } from './charts/TableView';
import { ComposedChartView } from './charts/ComposedChartView';
import { RadarChartView } from './charts/RadarChartView';
import { RadialBarChartView } from './charts/RadialBarChartView';
import { FunnelChartView } from './charts/FunnelChartView';
import { TreemapView } from './charts/TreemapView';

export interface VisualizationWorkspaceProps {
  queryResult: QueryResult | null;
  isConnected: boolean;
  connection?: SanitizedConnectionInfo | null;
  onOpenConnectModal?: () => void;
  isAiConfigured?: boolean;
  onAddToDashboard?: (config: ChartConfig, result: QueryResult, sourceTable?: string, datasetId?: string) => void;

  // Imported Datasets support
  importedDatasets?: ImportedDataset[];
  activeDataset?: ImportedDataset | null;
  onSelectDataset?: (dataset: ImportedDataset) => void;
  onOpenImportModal?: () => void;

  // Database Tables support
  selectedTable?: TableDetailsResult | null;
  tables?: DiscoveredTable[];
  onSelectTable?: (table: DiscoveredTable) => void;
}

const LOCAL_STORAGE_SAVED_CHARTS_KEY = 'datapilot_saved_visualizations';

export const VisualizationWorkspace: React.FC<VisualizationWorkspaceProps> = ({
  queryResult,
  isConnected,
  connection = null,
  onOpenConnectModal,
  isAiConfigured = false,
  onAddToDashboard,
  importedDatasets = [],
  activeDataset = null,
  onSelectDataset,
  onOpenImportModal,
  selectedTable = null,
  tables = [],
  onSelectTable
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // View mode: 'chart' | 'table'
  const [activeViewMode, setActiveViewMode] = useState<'chart' | 'table'>('chart');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter tables by schema (non-imported are real database tables)
  const databaseTables = useMemo(() => {
    return tables.filter(t => t.schema !== 'imported');
  }, [tables]);

  // Determine available data sources
  const hasDbConnection = Boolean(isConnected || databaseTables.length > 0);
  const hasImportedData = Boolean(importedDatasets && importedDatasets.length > 0);
  const hasQueryResult = Boolean(queryResult && queryResult.rows && queryResult.rows.length > 0);

  // Active data source mode: 'database' | 'imported' | 'query_result'
  const [dataSourceMode, setDataSourceMode] = useState<'database' | 'imported' | 'query_result'>(() => {
    if (selectedTable?.schema === 'imported' || (!hasDbConnection && hasImportedData)) {
      return 'imported';
    }
    if (hasDbConnection) {
      return 'database';
    }
    if (hasQueryResult) {
      return 'query_result';
    }
    return 'imported';
  });

  // Selected Database Table key: "schema.tableName"
  const [selectedDbTableKey, setSelectedDbTableKey] = useState<string>(() => {
    if (selectedTable && selectedTable.schema !== 'imported') {
      return `${selectedTable.schema}.${selectedTable.name}`;
    }
    if (databaseTables.length > 0) {
      return `${databaseTables[0].schema}.${databaseTables[0].name}`;
    }
    return '';
  });

  // Selected Imported Dataset ID
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(() => {
    if (activeDataset) return activeDataset.datasetId;
    if (selectedTable?.schema === 'imported') {
      const match = importedDatasets.find(d => d.tableName === selectedTable.name);
      if (match) return match.datasetId;
    }
    return importedDatasets.length > 0 ? importedDatasets[0].datasetId : null;
  });

  // Table Details cache for active database table
  const [cachedTableDetails, setCachedTableDetails] = useState<Record<string, TableDetailsResult>>({});
  const [isLoadingTableDetails, setIsLoadingTableDetails] = useState(false);

  // Query Execution State for Imported Datasets & Direct Database Tables
  const [internalQueryResult, setInternalQueryResult] = useState<QueryResult | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [generatedSql, setGeneratedSql] = useState<string>('');
  const [isSqlPreviewOpen, setIsSqlPreviewOpen] = useState(false);
  const [rawSelectedMeasure, setRawSelectedMeasure] = useState<string>('');

  // Insights drawer & Saved modal states
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insights, setInsights] = useState<VisualizationInsight[]>([]);

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);
  const [savedVisualizations, setSavedVisualizations] = useState<SavedVisualization[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVED_CHARTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isAiRecommending, setIsAiRecommending] = useState(false);

  // 1. Chart Configuration State
  const [config, setConfig] = useState<ChartConfig>(() => ({
    chartType: 'bar',
    xAxis: '',
    yAxis: '',
    secondaryMeasures: [],
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'y',
    limit: 50,
    title: 'Data Visualization',
    subtitle: '',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false,
    samplingEnabled: false
  }));

  // Resolve Dialect
  const activeDialect = useMemo<'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'oracle'>(() => {
    if (dataSourceMode === 'imported') return 'sqlite';
    const connType = (connection?.type || '').toLowerCase();
    if (connType.includes('postgres')) return 'postgres';
    if (connType.includes('mysql')) return 'mysql';
    if (connType.includes('sqlite')) return 'sqlite';
    if (connType.includes('sqlserver') || connType.includes('mssql')) return 'mssql';
    if (connType.includes('oracle')) return 'oracle';
    return 'postgres';
  }, [connection?.type, dataSourceMode]);

  // Resolve Active Dataset
  const currentDataset = useMemo<ImportedDataset | null>(() => {
    if (selectedDatasetId) {
      const found = importedDatasets.find(d => d.datasetId === selectedDatasetId);
      if (found) return found;
    }
    if (activeDataset) return activeDataset;
    if (selectedTable?.schema === 'imported') {
      const found = importedDatasets.find(d => d.tableName === selectedTable.name);
      if (found) return found;
    }
    return importedDatasets.length > 0 ? importedDatasets[0] : null;
  }, [importedDatasets, activeDataset, selectedDatasetId, selectedTable]);

  // Resolve Active Database Table object
  const currentDbTable = useMemo<DiscoveredTable | null>(() => {
    if (!selectedDbTableKey) {
      return databaseTables.length > 0 ? databaseTables[0] : null;
    }
    const [schema, name] = selectedDbTableKey.split('.');
    return databaseTables.find(t => t.schema === schema && t.name === name) || databaseTables[0] || null;
  }, [databaseTables, selectedDbTableKey]);

  // Fetch / Resolve current database table details
  useEffect(() => {
    if (dataSourceMode !== 'database' || !currentDbTable) return;
    const key = `${currentDbTable.schema}.${currentDbTable.name}`;

    if (selectedTable && selectedTable.schema === currentDbTable.schema && selectedTable.name === currentDbTable.name) {
      setCachedTableDetails(prev => ({ ...prev, [key]: selectedTable }));
      return;
    }

    if (cachedTableDetails[key]) {
      return;
    }

    let isCancelled = false;
    setIsLoadingTableDetails(true);

    DatabaseApiClient.getTableDetails(currentDbTable.schema, currentDbTable.name)
      .then(details => {
        if (!isCancelled && details) {
          setCachedTableDetails(prev => ({ ...prev, [key]: details }));
        }
      })
      .catch(err => {
        console.error('Failed to load table details for visualization:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingTableDetails(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dataSourceMode, currentDbTable, selectedTable]);

  // Sync selectedTable prop changes from parent
  useEffect(() => {
    if (selectedTable) {
      if (selectedTable.schema === 'imported') {
        const ds = importedDatasets.find(d => d.tableName === selectedTable.name);
        if (ds) {
          setSelectedDatasetId(ds.datasetId);
          setDataSourceMode('imported');
        }
      } else {
        const key = `${selectedTable.schema}.${selectedTable.name}`;
        setSelectedDbTableKey(key);
        setDataSourceMode('database');
      }
    }
  }, [selectedTable, importedDatasets]);

  // Auto-switch mode if active mode has no data
  useEffect(() => {
    if (dataSourceMode === 'database' && !hasDbConnection && hasImportedData) {
      setDataSourceMode('imported');
    } else if (dataSourceMode === 'imported' && !hasImportedData && hasDbConnection) {
      setDataSourceMode('database');
    }
  }, [dataSourceMode, hasDbConnection, hasImportedData]);

  // Resolve active table details
  const activeDbTableDetails = useMemo<TableDetailsResult | null>(() => {
    if (!currentDbTable) return null;
    const key = `${currentDbTable.schema}.${currentDbTable.name}`;
    return cachedTableDetails[key] || (selectedTable?.name === currentDbTable.name ? selectedTable : null);
  }, [currentDbTable, cachedTableDetails, selectedTable]);

  // Map columns to DetectedColumn[] format
  const datasetColumns = useMemo<DetectedColumn[]>(() => {
    if (!currentDataset) return [];
    return currentDataset.columns.map(c => {
      const isNumeric = c.dataType === 'integer' || c.dataType === 'numeric';
      const isDateOrTime = c.dataType === 'date' || c.dataType === 'timestamp';
      const isBoolean = c.dataType === 'boolean';
      return {
        name: c.name,
        dataType: c.dataType,
        semanticType: (c.dataType as ColumnSemanticType) || (isNumeric ? 'numeric' : 'text'),
        isNumeric,
        isDateOrTime,
        isCategorical: !isNumeric && !isBoolean,
        isBoolean,
        isNullable: c.isNullable ?? true,
        distinctCount: c.sampleValues?.length || 10,
        nullCount: c.nullCount || 0,
        sampleValues: c.sampleValues || []
      };
    });
  }, [currentDataset]);

  const databaseTableColumns = useMemo<DetectedColumn[]>(() => {
    if (!activeDbTableDetails || !activeDbTableDetails.columns) return [];
    return ColumnTypeDetector.fromTableColumns(activeDbTableDetails.columns);
  }, [activeDbTableDetails]);

  // Determine effective QueryResult
  const effectiveQueryResult = useMemo<QueryResult | null>(() => {
    if (dataSourceMode === 'query_result') {
      return queryResult || internalQueryResult;
    }
    return internalQueryResult || (dataSourceMode === 'database' ? queryResult : null);
  }, [dataSourceMode, internalQueryResult, queryResult]);

  // Detect column metadata from query result or fallback to schema
  const detectedColumns = useMemo<DetectedColumn[]>(() => {
    if (effectiveQueryResult && effectiveQueryResult.columns && effectiveQueryResult.rows && effectiveQueryResult.rows.length > 0) {
      return ColumnTypeDetector.detect(effectiveQueryResult.columns, effectiveQueryResult.rows);
    }
    if (dataSourceMode === 'database' && databaseTableColumns.length > 0) {
      return databaseTableColumns;
    }
    if (dataSourceMode === 'imported' && datasetColumns.length > 0) {
      return datasetColumns;
    }
    return [];
  }, [effectiveQueryResult, dataSourceMode, databaseTableColumns, datasetColumns]);

  const activeSchemaColumns = useMemo(() => {
    if (dataSourceMode === 'database' && databaseTableColumns.length > 0) {
      return databaseTableColumns;
    }
    if (dataSourceMode === 'imported' && datasetColumns.length > 0) {
      return datasetColumns;
    }
    return detectedColumns.length > 0 ? detectedColumns : (dataSourceMode === 'database' ? databaseTableColumns : datasetColumns);
  }, [dataSourceMode, detectedColumns, databaseTableColumns, datasetColumns]);

  // Revalidate config fields when active schema columns change (e.g. dataset switch)
  useEffect(() => {
    if (activeSchemaColumns.length === 0) return;
    const colNames = new Set(activeSchemaColumns.map(c => c.name));

    let updatedX = config.xAxis;
    let updatedY = config.yAxis;
    let needsUpdate = false;

    if (updatedX && updatedX !== 'All Rows' && !colNames.has(updatedX)) {
      updatedX = '';
      needsUpdate = true;
    }

    if (updatedY && updatedY !== 'All Rows' && updatedY !== '*' && !colNames.has(updatedY)) {
      updatedY = '';
      needsUpdate = true;
    }

    const validSecondary = (config.secondaryMeasures || []).filter(m => colNames.has(m));
    if (validSecondary.length !== (config.secondaryMeasures || []).length) {
      needsUpdate = true;
    }

    if (needsUpdate) {
      const newConfig = {
        ...config,
        xAxis: updatedX,
        yAxis: updatedY,
        secondaryMeasures: validSecondary
      };
      setConfig(newConfig);
      if (!updatedX || !updatedY) {
        setQueryError(`Selected field is not available in this dataset. Please select another field.`);
      }
    }
  }, [activeSchemaColumns]);

  // Execution engine: Runs dialect-aware analytical SQL query
  const executeAnalyticalQuery = useCallback(async (
    targetMode: 'database' | 'imported',
    targetConfig: ChartConfig,
    measureCol?: string,
    tableOverride?: { schema: string; name: string }
  ) => {
    setIsQueryLoading(true);
    setQueryError(null);

    const dim = targetConfig.xAxis;
    const meas = measureCol !== undefined ? measureCol : (rawSelectedMeasure || targetConfig.yAxis);
    const agg = targetConfig.aggregation || 'count';

    // Validate referenced columns against active schema columns before query generation/execution
    const availableColNames = new Set(activeSchemaColumns.map(c => c.name));

    if (dim && dim !== 'All Rows' && !availableColNames.has(dim)) {
      const errMessage = `Selected field '${dim}' is not available in this dataset. Please select another field.`;
      setQueryError(errMessage);
      setIsQueryLoading(false);
      return;
    }

    if (meas && meas !== 'All Rows' && meas !== '*' && !availableColNames.has(meas)) {
      const errMessage = `Selected field '${meas}' is not available in this dataset. Please select another field.`;
      setQueryError(errMessage);
      setIsQueryLoading(false);
      return;
    }

    if (targetConfig.secondaryMeasures) {
      for (const sm of targetConfig.secondaryMeasures) {
        if (!availableColNames.has(sm)) {
          const errMessage = `Selected field '${sm}' is not available in this dataset. Please select another field.`;
          setQueryError(errMessage);
          setIsQueryLoading(false);
          return;
        }
      }
    }

    try {
      let sql = '';
      let sourceName = '';

      if (targetMode === 'database') {
        const table = tableOverride || (currentDbTable ? { schema: currentDbTable.schema, name: currentDbTable.name } : null);
        if (!table) {
          setIsQueryLoading(false);
          return;
        }

        sourceName = table.name;
        sql = VisualizationQueryBuilder.buildQuery({
          schema: table.schema,
          tableName: table.name,
          dimension: dim,
          measure: meas,
          aggregation: agg,
          chartType: targetConfig.chartType,
          sortOrder: targetConfig.sortOrder,
          limit: targetConfig.limit,
          dialect: activeDialect
        });
      } else {
        if (!currentDataset) {
          setIsQueryLoading(false);
          return;
        }

        sourceName = currentDataset.name;
        sql = VisualizationQueryBuilder.buildQuery({
          tableName: currentDataset.tableName,
          dimension: dim,
          measure: meas,
          aggregation: agg,
          chartType: targetConfig.chartType,
          sortOrder: targetConfig.sortOrder,
          limit: targetConfig.limit,
          dialect: 'sqlite'
        });
      }

      setGeneratedSql(sql);

      // Execute safe analytical query against database or imported dataset
      const res = await DatabaseApiClient.executeQuery(sql);

      if (res.status === 'error' || res.status === 'cancelled') {
        setQueryError(res.errorMessage || 'Failed to execute visualization query');
      } else {
        setInternalQueryResult(res);
        setRawSelectedMeasure(meas);
        setQueryError(null);

        setConfig(prev => ({
          ...prev,
          title: prev.title && !prev.title.startsWith('Data Visualization')
            ? prev.title
            : `${sourceName} by ${dim || 'Category'}`
        }));
      }
    } catch (err: any) {
      setQueryError(err.message || 'Execution error');
    } finally {
      setIsQueryLoading(false);
    }
  }, [rawSelectedMeasure, currentDbTable, currentDataset, activeDialect]);

  // Initialize defaults on database table change
  useEffect(() => {
    if (dataSourceMode !== 'database' || !currentDbTable) return;

    const cols = databaseTableColumns.length > 0
      ? databaseTableColumns
      : activeDbTableDetails?.columns
      ? ColumnTypeDetector.fromTableColumns(activeDbTableDetails.columns)
      : [];

    if (cols.length === 0) return;

    // Pick smart dimension: category, name, text, date, or first column
    const categoryCol = cols.find(c =>
      c.name.toLowerCase().includes('country') ||
      c.name.toLowerCase().includes('city') ||
      c.name.toLowerCase().includes('state') ||
      c.name.toLowerCase().includes('status') ||
      c.name.toLowerCase().includes('category') ||
      c.name.toLowerCase().includes('type')
    );
    const textCol = cols.find(c => c.isCategorical && !c.name.toLowerCase().includes('id'));
    const dateCol = cols.find(c => c.isDateOrTime);
    const defaultX = categoryCol?.name || textCol?.name || dateCol?.name || cols[0]?.name || '';

    // Pick smart measure: value, amount, price, total, revenue, salary, or numeric column
    const metricCol = cols.find(c =>
      c.isNumeric && (
        c.name.toLowerCase().includes('value') ||
        c.name.toLowerCase().includes('amount') ||
        c.name.toLowerCase().includes('total') ||
        c.name.toLowerCase().includes('price') ||
        c.name.toLowerCase().includes('revenue') ||
        c.name.toLowerCase().includes('credit') ||
        c.name.toLowerCase().includes('spend') ||
        c.name.toLowerCase().includes('salary')
      )
    );
    const numCol = cols.find(c => c.isNumeric && !c.name.toLowerCase().endsWith('_id') && c.name.toLowerCase() !== 'id');
    const idCol = cols.find(c => c.name.toLowerCase() === 'id' || c.name.toLowerCase().endsWith('_id'));
    const defaultMeasure = metricCol?.name || numCol?.name || idCol?.name || (cols[1]?.name || cols[0]?.name || '');

    const initialAgg = (metricCol || numCol) ? 'sum' : 'count';

    setRawSelectedMeasure(defaultMeasure);

    const initialConfig: ChartConfig = {
      ...config,
      chartType: 'bar',
      xAxis: defaultX,
      yAxis: defaultMeasure,
      aggregation: initialAgg,
      sortOrder: 'desc',
      limit: 50,
      title: `${currentDbTable.name} - ${defaultX} by ${defaultMeasure}`
    };

    setConfig(initialConfig);
    executeAnalyticalQuery('database', initialConfig, defaultMeasure, {
      schema: currentDbTable.schema,
      name: currentDbTable.name
    });
  }, [currentDbTable?.schema, currentDbTable?.name, databaseTableColumns.length, dataSourceMode]);

  // Initialize defaults on dataset change
  useEffect(() => {
    if (dataSourceMode !== 'imported' || !currentDataset || currentDataset.columns.length === 0) return;

    const cols = currentDataset.columns;
    const regionCol = cols.find(c => c.name.toLowerCase() === 'region');
    const textCol = cols.find(c => c.dataType === 'text' || c.dataType === 'date');
    const defaultX = regionCol?.name || textCol?.name || cols[0].name;

    const orderCol = cols.find(c => c.name.toLowerCase() === 'order_id');
    const salesCol = cols.find(c => c.name.toLowerCase() === 'sales');
    const numCol = cols.find(c => c.dataType === 'integer' || c.dataType === 'numeric');
    const defaultMeasure = orderCol?.name || salesCol?.name || numCol?.name || (cols[1]?.name || cols[0].name);

    const initialAgg = orderCol || !numCol ? 'count' : 'sum';

    setRawSelectedMeasure(defaultMeasure);

    const initialConfig: ChartConfig = {
      ...config,
      chartType: 'bar',
      xAxis: defaultX,
      yAxis: defaultMeasure,
      aggregation: initialAgg,
      sortOrder: 'desc',
      limit: 50,
      title: `${currentDataset.name} - ${defaultX} by ${defaultMeasure}`
    };

    setConfig(initialConfig);
    executeAnalyticalQuery('imported', initialConfig, defaultMeasure);
  }, [currentDataset?.datasetId, dataSourceMode]);

  // Handle switching database table
  const handleSwitchDbTable = (tableKey: string) => {
    setSelectedDbTableKey(tableKey);
    const [schema, name] = tableKey.split('.');
    const found = databaseTables.find(t => t.schema === schema && t.name === name);
    if (found && onSelectTable) {
      onSelectTable(found);
    }
  };

  // Handle switching dataset
  const handleSwitchDataset = (newDs: ImportedDataset) => {
    setSelectedDatasetId(newDs.datasetId);
    onSelectDataset?.(newDs);
    setInternalQueryResult(null);
  };

  // Re-run query when config dimensions, measures, aggregation, chartType change
  const handleChangeConfig = (newConfig: ChartConfig) => {
    setConfig(newConfig);
    if (dataSourceMode === 'database' && currentDbTable) {
      executeAnalyticalQuery('database', newConfig);
    } else if (dataSourceMode === 'imported' && currentDataset) {
      executeAnalyticalQuery('imported', newConfig);
    }
  };

  // Validate current configuration
  const validation = useMemo(() => {
    return ChartRecommender.validateConfig(config, activeSchemaColumns);
  }, [config, activeSchemaColumns]);

  // Process chart data with safe sorting, null handling, and aggregation mapping
  const processedData = useMemo(() => {
    if (!effectiveQueryResult || !effectiveQueryResult.rows) return [];
    return VisualizationDataProcessor.process(effectiveQueryResult.rows, config, activeSchemaColumns);
  }, [effectiveQueryResult, config, activeSchemaColumns]);

  // Ask AI for Chart Recommendation
  const handleAskAiForChart = async () => {
    const cols = activeSchemaColumns;
    if (cols.length === 0) return;
    setIsAiRecommending(true);
    try {
      const rowCount = effectiveQueryResult?.rowCount || currentDataset?.rowCount || currentDbTable?.approximateRowCount || 100;
      const rec = ChartRecommender.recommend(cols, rowCount);
      const defaultY = rec.yAxis || cols.find(c => c.isNumeric)?.name || '';
      const defaultX = rec.xAxis || cols.find(c => !c.isNumeric || c.isDateOrTime)?.name || '';

      const updated: ChartConfig = {
        ...config,
        chartType: rec.chartType,
        xAxis: defaultX,
        yAxis: defaultY,
        secondaryMeasures: rec.secondaryMeasures || [],
        title: rec.title || config.title,
        subtitle: rec.reason
      };

      setConfig(updated);
      if (dataSourceMode === 'database' && currentDbTable) {
        executeAnalyticalQuery('database', updated, defaultY);
      } else if (dataSourceMode === 'imported' && currentDataset) {
        executeAnalyticalQuery('imported', updated, defaultY);
      }
    } finally {
      setIsAiRecommending(false);
    }
  };

  // Generate factual insights
  const handleGenerateInsights = async () => {
    if (!effectiveQueryResult || !effectiveQueryResult.rows) return;
    setIsInsightsOpen(true);
    setIsGeneratingInsights(true);
    try {
      const results = await VisualizationInsightsService.generateInsights(
        effectiveQueryResult.query || generatedSql || '',
        effectiveQueryResult.rows,
        detectedColumns,
        config,
        Boolean(isAiConfigured)
      );
      setInsights(results);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Save visualization
  const handleSaveVisualization = (name: string) => {
    const newSave: SavedVisualization = {
      id: `vis-${Date.now()}`,
      name,
      chartType: config.chartType,
      sourceQueryId: effectiveQueryResult?.sourceQueryId,
      querySql: effectiveQueryResult?.query || generatedSql,
      dimensions: config.xAxis ? [config.xAxis] : [],
      measures: [config.yAxis, ...(config.secondaryMeasures || [])].filter(Boolean),
      config: { ...config },
      createdAt: new Date().toISOString()
    };

    const updated = [newSave, ...savedVisualizations];
    setSavedVisualizations(updated);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CHARTS_KEY, JSON.stringify(updated));
  };

  const handleDeleteSavedVisualization = (id: string) => {
    const updated = savedVisualizations.filter(s => s.id !== id);
    setSavedVisualizations(updated);
    localStorage.setItem(LOCAL_STORAGE_SAVED_CHARTS_KEY, JSON.stringify(updated));
  };

  const handleLoadSavedVisualization = (saved: SavedVisualization) => {
    setConfig({ ...saved.config });
    if (dataSourceMode === 'database' && currentDbTable) {
      executeAnalyticalQuery('database', saved.config);
    } else if (dataSourceMode === 'imported' && currentDataset) {
      executeAnalyticalQuery('imported', saved.config);
    }
  };

  // Export handlers
  const handleDownloadPng = async () => {
    if (!chartContainerRef.current) return;
    try {
      await VisualizationExportService.downloadChartAsPng(
        chartContainerRef.current,
        config.title.toLowerCase().replace(/\s+/g, '_') || 'datapilot_chart'
      );
    } catch (err: any) {
      console.error('Failed to export chart as image:', err);
    }
  };

  const handleExportCsv = () => {
    if (!effectiveQueryResult) return;
    VisualizationExportService.exportToCsv(
      config.title.toLowerCase().replace(/\s+/g, '_') || 'chart_data',
      effectiveQueryResult.columns,
      effectiveQueryResult.rows
    );
  };

  const handleCopyConfig = async () => {
    const success = await VisualizationExportService.copyConfig(config);
    if (success) {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const handleCopySql = async () => {
    if (!generatedSql) return;
    await navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Check if completely disconnected and without any data sources
  if (!hasImportedData && !hasDbConnection && !hasQueryResult) {
    return (
      <div id="vis-empty-state" className="flex-1 flex flex-col items-center justify-center h-full bg-slate-950 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <Layers className="w-7 h-7 text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200">No data source connected.</h2>
        <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
          Connect your PostgreSQL, MySQL, SQLite, or SQL Server database, or import a dataset to visualize data instantly.
        </p>
        <div className="flex items-center space-x-3">
          {onOpenConnectModal && (
            <button
              id="btn-vis-connect-db"
              onClick={onOpenConnectModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>Connect Database</span>
            </button>
          )}
          {onOpenImportModal && (
            <button
              id="btn-vis-import-dataset"
              onClick={onOpenImportModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Dataset</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const isTruncated = Boolean(effectiveQueryResult?.isTruncated || effectiveQueryResult?.truncated);

  return (
    <div
      id="visualization-workspace"
      className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-950 ${
        isFullscreen ? 'fixed inset-0 z-50' : 'relative'
      }`}
    >
      {/* Top Controls Toolbar */}
      <header className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs z-10 flex-shrink-0">
        {/* Left: View Mode Toggle & Data Source Selectors */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* Table ↔ Chart Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
            <button
              id="btn-vis-mode-chart"
              onClick={() => setActiveViewMode('chart')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeViewMode === 'chart'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Chart</span>
            </button>
            <button
              id="btn-vis-mode-table"
              onClick={() => setActiveViewMode('table')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeViewMode === 'table'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Data Source Type Tabs */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
            {hasDbConnection && (
              <button
                id="btn-switch-source-db"
                onClick={() => setDataSourceMode('database')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  dataSourceMode === 'database'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Database Tables ({databaseTables.length})</span>
              </button>
            )}

            {hasImportedData && (
              <button
                id="btn-switch-source-imported"
                onClick={() => setDataSourceMode('imported')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  dataSourceMode === 'imported'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Imported ({importedDatasets.length})</span>
              </button>
            )}

            {hasQueryResult && (
              <button
                id="btn-switch-source-query-result"
                onClick={() => setDataSourceMode('query_result')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  dataSourceMode === 'query_result'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <DatabaseZap className="w-3.5 h-3.5" />
                <span>SQL Result</span>
              </button>
            )}
          </div>

          {/* Active Data Source Specific Dropdown & Badge */}
          {dataSourceMode === 'database' && (
            <div id="vis-database-source-selector" className="flex items-center space-x-2 bg-slate-950/90 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Database:</span>

              {databaseTables.length > 0 ? (
                <select
                  id="select-database-table-vis"
                  value={selectedDbTableKey}
                  onChange={e => handleSwitchDbTable(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-indigo-300 rounded px-2 py-0.5 text-xs font-mono font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {databaseTables.map(t => {
                    const key = `${t.schema}.${t.name}`;
                    return (
                      <option key={key} value={key}>
                        {t.name} {t.schema !== 'public' ? `(${t.schema})` : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="text-slate-400 text-xs">No tables discovered</span>
              )}

              {currentDbTable?.approximateRowCount !== undefined && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    ~{currentDbTable.approximateRowCount.toLocaleString()} rows
                  </span>
                </>
              )}

              {effectiveQueryResult && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-indigo-400 font-mono text-[10px]">{effectiveQueryResult.executionTimeMs}ms</span>
                </>
              )}
            </div>
          )}

          {dataSourceMode === 'imported' && currentDataset && (
            <div id="vis-dataset-source-badge" className="flex items-center space-x-2 bg-slate-950/90 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Dataset:</span>

              {importedDatasets.length > 1 ? (
                <select
                  id="select-imported-dataset-vis"
                  value={currentDataset.datasetId}
                  onChange={e => {
                    const found = importedDatasets.find(d => d.datasetId === e.target.value);
                    if (found) handleSwitchDataset(found);
                  }}
                  className="bg-slate-900 border border-slate-700 text-emerald-300 rounded px-2 py-0.5 text-xs font-mono font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {importedDatasets.map(ds => (
                    <option key={ds.datasetId} value={ds.datasetId}>
                      {ds.name} ({ds.tableName})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono text-emerald-300 font-semibold">{currentDataset.tableName}</span>
              )}

              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-mono text-[11px]">{currentDataset.rowCount.toLocaleString()} rows</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono text-[11px]">{currentDataset.columns.length} columns</span>
              {effectiveQueryResult && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-mono text-[10px]">{effectiveQueryResult.executionTimeMs}ms</span>
                </>
              )}
            </div>
          )}

          {dataSourceMode === 'query_result' && effectiveQueryResult && (
            <div className="flex items-center space-x-2 bg-slate-950/90 border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">SQL Run:</span>
              <span className="font-mono text-slate-200 font-medium">{effectiveQueryResult.rowCount.toLocaleString()} rows</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">{effectiveQueryResult.columns.length} cols</span>
            </div>
          )}
        </div>

        {/* Right: Actions (SQL Preview, Insights, Save, Export, Fullscreen) */}
        <div className="flex items-center space-x-2">
          {/* Generated Dialect SQL Preview Toggle */}
          {generatedSql && (
            <button
              id="btn-toggle-sql-preview"
              onClick={() => setIsSqlPreviewOpen(prev => !prev)}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isSqlPreviewOpen
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
              }`}
              title={`View generated ${activeDialect.toUpperCase()} SQL query`}
            >
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>SQL</span>
              {isSqlPreviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {/* Refresh Query Button */}
          {(dataSourceMode === 'database' || dataSourceMode === 'imported') && (
            <button
              id="btn-refresh-vis-query"
              onClick={() => executeAnalyticalQuery(dataSourceMode, config)}
              disabled={isQueryLoading}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh visualization query"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isQueryLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          {/* Generate Insights Button */}
          <button
            id="btn-generate-insights"
            onClick={handleGenerateInsights}
            disabled={!effectiveQueryResult || isGeneratingInsights}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Generate factual data insights"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Generate Insights</span>
          </button>

          {/* Save Visualization */}
          <button
            id="btn-save-visualization"
            onClick={() => setIsSaveDialogOpen(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title="Save current visualization configuration"
          >
            <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
            <span>Save</span>
          </button>

          {/* Add to Dashboard */}
          {onAddToDashboard && (
            <button
              id="btn-add-to-dashboard-vis"
              onClick={() => {
                const resToPass = effectiveQueryResult || {
                  query: generatedSql,
                  columns: activeSchemaColumns.map(c => ({ name: c.name, dataType: c.dataType })),
                  rows: [],
                  rowCount: currentDbTable?.approximateRowCount || currentDataset?.rowCount || 0,
                  executionTimeMs: 0,
                  status: 'success'
                };
                onAddToDashboard(
                  config,
                  resToPass,
                  currentDbTable?.name || currentDataset?.tableName || selectedTable?.name,
                  currentDataset?.datasetId
                );
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 hover:text-white border border-emerald-700/60 transition-colors cursor-pointer"
              title="Add this chart to an executive dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add to Dashboard</span>
            </button>
          )}

          {/* Saved Visualizations Drawer Toggle */}
          {savedVisualizations.length > 0 && (
            <button
              onClick={() => setIsSavedModalOpen(true)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs flex items-center space-x-1 cursor-pointer"
            >
              <span>Saved</span>
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {savedVisualizations.length}
              </span>
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              id="btn-export-menu"
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-30 text-xs"
                onMouseLeave={() => setIsExportMenuOpen(false)}
              >
                <button
                  onClick={() => {
                    handleDownloadPng();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-850 flex items-center space-x-2 text-slate-200 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download Chart as PNG</span>
                </button>
                <button
                  onClick={() => {
                    handleExportCsv();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-850 flex items-center space-x-2 text-slate-200 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Data as CSV</span>
                </button>
                <button
                  onClick={() => {
                    handleCopyConfig();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-850 flex items-center space-x-2 text-slate-200 cursor-pointer"
                >
                  {copiedConfig ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{copiedConfig ? 'Copied Config!' : 'Copy Chart Config'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Collapsible Generated SQL Banner */}
      {isSqlPreviewOpen && generatedSql && (
        <div id="vis-sql-preview-drawer" className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex flex-col space-y-1.5 text-xs flex-shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Server-Side Aggregated {activeDialect.toUpperCase()} Query
              </span>
            </span>
            <button
              onClick={handleCopySql}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>
          <pre className="font-mono text-[11px] text-emerald-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto">
            {generatedSql}
          </pre>
        </div>
      )}

      {/* Query Error Banner */}
      {queryError && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-between text-rose-300 text-xs flex-shrink-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>Unable to load database table data: {queryError}</span>
          </div>
          <button
            onClick={() => executeAnalyticalQuery(dataSourceMode === 'database' ? 'database' : 'imported', config)}
            className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Truncated Result Protection Banner */}
      {isTruncated && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 flex items-center space-x-2 text-amber-300 text-xs flex-shrink-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>Visualization uses the available result set. Query result was limited.</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Configuration Panel (Hidden in Table Mode) */}
        {activeViewMode === 'chart' && (
          <ChartConfigPanel
            config={config}
            onChangeConfig={handleChangeConfig}
            columns={activeSchemaColumns}
            validation={validation}
            onAskAiForChart={handleAskAiForChart}
            isAiLoading={isAiRecommending}
          />
        )}

        {/* Center: Stage Canvas */}
        <div className="flex-1 flex flex-col h-full overflow-hidden p-4 min-w-0 relative">
          {/* Query Loading Overlay */}
          {(isQueryLoading || isLoadingTableDetails) && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-20">
              <div className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-slate-200 text-xs">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>
                  {isLoadingTableDetails
                    ? 'Loading database table schema...'
                    : 'Querying and aggregating database table...'}
                </span>
              </div>
            </div>
          )}

          {activeViewMode === 'table' ? (
            effectiveQueryResult ? (
              <TableView columns={effectiveQueryResult.columns} rows={effectiveQueryResult.rows} />
            ) : (
              <div className="text-center p-8 text-slate-400 text-xs">No tabular data to display.</div>
            )
          ) : (
            <div
              ref={chartContainerRef}
              id="chart-display-canvas"
              className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col shadow-inner relative overflow-hidden"
            >
              {/* Chart Header */}
              <div className="mb-4 flex-shrink-0 flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {config.title || 'Data Visualization'}
                  </h3>
                  {config.subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5">{config.subtitle}</p>
                  )}
                </div>
                {effectiveQueryResult && (
                  <div className="text-[11px] font-mono text-slate-400">
                    {effectiveQueryResult.rowCount.toLocaleString()} aggregated data point{effectiveQueryResult.rowCount === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {/* Chart Render Area */}
              <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center overflow-hidden">
                {!validation.isValid ? (
                  <div className="text-center p-8 max-w-md">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <div className="text-sm font-semibold text-slate-200 mb-1">
                      Incompatible Configuration
                    </div>
                    <p className="text-xs text-slate-400">
                      {validation.errors[0] || 'Please adjust the selected X or Y columns.'}
                    </p>
                  </div>
                ) : !effectiveQueryResult || effectiveQueryResult.rows.length === 0 ? (
                  <div className="text-center p-8 max-w-md text-slate-400 text-xs">
                    {queryError ? (
                      <span className="text-rose-400">{queryError}</span>
                    ) : (
                      'No records matched the analytical query. Adjust dimensions or filters.'
                    )}
                  </div>
                ) : config.chartType === 'kpi' ? (
                  <KpiCardView rows={effectiveQueryResult.rows} config={config} />
                ) : config.chartType === 'bar' || config.chartType === 'grouped_bar' || config.chartType === 'stacked_bar' || config.chartType === 'percent_bar' ? (
                  <BarChartView data={processedData} config={config} isHorizontal={false} />
                ) : config.chartType === 'horizontal_bar' ? (
                  <BarChartView data={processedData} config={config} isHorizontal={true} />
                ) : config.chartType === 'line' ? (
                  <LineChartView data={processedData} config={config} />
                ) : config.chartType === 'area' || config.chartType === 'stacked_area' ? (
                  <AreaChartView data={processedData} config={config} />
                ) : config.chartType === 'pie' ? (
                  <PieDonutView data={processedData} config={config} isDonut={false} />
                ) : config.chartType === 'donut' ? (
                  <PieDonutView data={processedData} config={config} isDonut={true} />
                ) : config.chartType === 'scatter' ? (
                  <ScatterPlotView data={processedData} config={config} />
                ) : config.chartType === 'histogram' ? (
                  <HistogramView rows={effectiveQueryResult.rows} config={config} />
                ) : config.chartType === 'composed' ? (
                  <ComposedChartView data={processedData} config={config} />
                ) : config.chartType === 'radar' ? (
                  <RadarChartView data={processedData} config={config} />
                ) : config.chartType === 'radial_bar' ? (
                  <RadialBarChartView data={processedData} config={config} />
                ) : config.chartType === 'funnel' ? (
                  <FunnelChartView data={processedData} config={config} />
                ) : config.chartType === 'treemap' ? (
                  <TreemapView data={processedData} config={config} />
                ) : (
                  <TableView columns={effectiveQueryResult.columns} rows={effectiveQueryResult.rows} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Insights Drawer */}
        <InsightsDrawer
          isOpen={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          insights={insights}
          isLoading={isGeneratingInsights}
          onRegenerate={handleGenerateInsights}
        />
      </div>

      {/* Save Dialog */}
      <SaveVisualizationDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        config={config}
        onSave={handleSaveVisualization}
      />

      {/* Saved List Modal */}
      <SavedVisualizationsModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedList={savedVisualizations}
        onLoadVisualization={handleLoadSavedVisualization}
        onDeleteVisualization={handleDeleteSavedVisualization}
      />
    </div>
  );
};
