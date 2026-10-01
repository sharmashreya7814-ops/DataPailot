import { useState, useEffect, useRef, useMemo } from 'react';
import { DatabaseExplorer } from './components/Sidebar/DatabaseExplorer';
import { ConnectionModal } from './components/Sidebar/ConnectionModal';
import { SqlEditor } from './components/Editor/SqlEditor';
import { SqlEditorTabs } from './components/Editor/SqlEditorTabs';
import { SqlWorkspace } from './components/Editor/SqlWorkspace';
import { QueryLibraryModal } from './components/Editor/QueryLibraryModal';
import { SaveQueryModal } from './components/Editor/SaveQueryModal';
import { SavedQuery } from './types/database';
import { QueryResults } from './components/Results/QueryResults';
import { AiAssistantPanel } from './components/Assistant/AiAssistantPanel';
import { Navbar } from './components/Header/Navbar';
import { AnalysisStudio } from './components/Analysis/AnalysisStudio';
import { VisualizationWorkspace } from './components/Visualization/VisualizationWorkspace';
import { DashboardWorkspace } from './components/Dashboard/DashboardWorkspace';
import { AddToDashboardModal } from './components/Dashboard/AddToDashboardModal';
import { DataLineageWorkspace } from './components/Lineage/DataLineageWorkspace';
import { DataQualityWorkspace } from './components/DataQuality/DataQualityWorkspace';
import { DataCleaningWorkspace } from './components/DataCleaning/DataCleaningWorkspace';
import {
  DiscoveredTable, DatabaseRelationship,
  SanitizedConnectionInfo,
  TableDetailsResult,
  QueryExecutionResult,
  QueryHistoryItem,
  QueryResult,
  SqlEditorTab
} from './types/database';
import { ChartConfig, ChartType } from './types/visualization';
import { GeneratedAnalysisQuery } from './types/analysis';
import { DatabaseApiClient } from './services/databaseApi';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PerformanceAnalyzerModal } from './components/Editor/PerformanceAnalyzerModal';
import { PerformanceAnalysis } from './types/performance';
import { analyzePlan } from './utils/performanceParser';
import { PlanNode } from './types/performance';
import { ImportedDataset } from './types/import';
import { ImportApiClient } from './services/importApi';
import { DataImportModal } from './components/Import/DataImportModal';
import { DatasetDetailModal } from './components/Import/DatasetDetailModal';
import { CollaborationProvider, useCollaboration } from './context/CollaborationContext';
import { CollaborationApiClient } from './services/collaborationApi';
import { AuthModal } from './components/Collaboration/AuthModal';
import { AuthPage } from './components/Collaboration/AuthPage';
import { DataPilotLogo } from './components/common/DataPilotLogo';
import { AdminConsoleModal } from './components/Collaboration/AdminConsoleModal';
import { ActivityFeedDrawer } from './components/Collaboration/ActivityFeedDrawer';
import { GlobalSearchModal } from './components/Collaboration/GlobalSearchModal';
import { ReportsWorkspace } from './components/Collaboration/ReportsWorkspace';
import { Loader2, AlertTriangle, Check } from 'lucide-react';

function AppContent() {
  const { user, activeWorkspace, activeProject, activeProjectId, emailVerificationRequired, resendVerification } = useCollaboration();

  // Email verification banner state
  const [isResendingBanner, setIsResendingBanner] = useState(false);
  const [resendBannerSuccess, setResendBannerSuccess] = useState<string | null>(null);
  const [bannerCooldown, setBannerCooldown] = useState(0);

  useEffect(() => {
    if (bannerCooldown <= 0) return;
    const timer = setInterval(() => {
      setBannerCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [bannerCooldown]);

  const handleResendBanner = async () => {
    if (bannerCooldown > 0 || isResendingBanner) return;
    setIsResendingBanner(true);
    setResendBannerSuccess(null);
    try {
      const res = await resendVerification();
      if (res.success) {
        setResendBannerSuccess(res.message || 'Verification link sent!');
        setBannerCooldown(60);
      }
    } catch {
      // Ignored
    } finally {
      setIsResendingBanner(false);
    }
  };

  // Connection state
  const [connection, setConnection] = useState<SanitizedConnectionInfo | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // Imported Datasets (Unified Data Layer)
  const [importedDatasets, setImportedDatasets] = useState<ImportedDataset[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [inspectingDataset, setInspectingDataset] = useState<ImportedDataset | null>(null);

  // Active workspace view: 'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage' | 'data-quality' | 'cleaning' | 'reports'
  const [activeWorkspaceView, setActiveWorkspaceView] = useState<'editor' | 'analysis' | 'visualization' | 'dashboards' | 'lineage' | 'data-quality' | 'cleaning' | 'reports'>('editor');

  // Collaboration UI states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Add to Dashboard Modal State
  const [addToDashboardData, setAddToDashboardData] = useState<{
    isOpen: boolean;
    sqlQuery: string;
    sourceTable?: string;
    datasetId?: string;
    chartType?: ChartType;
    chartConfig?: ChartConfig;
    cachedResult?: QueryResult;
    defaultTitle?: string;
  }>({
    isOpen: false,
    sqlQuery: ''
  });

  // Active dataset state for Visualization and imported analytical workflows
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);

  // Dynamic schema discovery state
  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [relationships, setRelationships] = useState<DatabaseRelationship[]>([]);
  const [tableDetailsCache, setTableDetailsCache] = useState<Record<string, TableDetailsResult>>({});
  const [selectedTable, setSelectedTable] = useState<TableDetailsResult | null>(null);
  const [isLoadingTableDetails, setIsLoadingTableDetails] = useState(false);
  const [isRefreshingSchema, setIsRefreshingSchema] = useState(false);

  // Performance Analyzer State
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

  // Active dataset computation
  const activeDataset = useMemo(() => {
    if (activeDatasetId) {
      const found = importedDatasets.find(d => d.datasetId === activeDatasetId);
      if (found) return found;
    }
    if (selectedTable?.schema === 'imported') {
      const found = importedDatasets.find(d => d.tableName === selectedTable.name);
      if (found) return found;
    }
    return importedDatasets.length > 0 ? importedDatasets[0] : null;
  }, [importedDatasets, activeDatasetId, selectedTable]);

  // Combined table discovery including imported SQLite datasets
  const allDiscoveredTables = useMemo(() => {
    const combined = [...tables];
    for (const ds of importedDatasets) {
      if (!combined.some(t => t.name === ds.tableName)) {
        combined.push({
          schema: 'imported',
          name: ds.tableName,
          type: 'TABLE' as const,
          approximateRowCount: ds.rowCount
        });
      }
    }
    return combined;
  }, [tables, importedDatasets]);
  const [currentPerformanceAnalysis, setCurrentPerformanceAnalysis] = useState<PerformanceAnalysis | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceAnalysis[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_performance_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('datapilot_performance_history', JSON.stringify(performanceHistory.slice(0, 10))); // keep last 10
  }, [performanceHistory]);

  const handleAnalyzePerformance = async (sql: string) => {
    setIsPerformanceModalOpen(true);
    setCurrentPerformanceAnalysis(null);
    try {
      // Execute safe EXPLAIN (FORMAT JSON)
      const explainSql = `EXPLAIN (FORMAT JSON) ${sql}`;
      const result = await DatabaseApiClient.executeQuery(explainSql);
      
      if (result.status === 'error' || result.errorMessage) {
        alert(`Performance Analysis Error: ${result.errorMessage}`);
        setIsPerformanceModalOpen(false);
        return;
      }
      
      if (result.rows && result.rows.length > 0) {
        let planData = result.rows[0];
        const planKey = Object.keys(planData)[0];
        const planArray = planData[planKey];
        
        if (Array.isArray(planArray) && planArray.length > 0 && planArray[0].Plan) {
          const analysis = analyzePlan(planArray[0].Plan, sql, tableDetailsCache);
          
          // Try to fetch indexes
          try {
            const rels = new Set<string>();
            const findRelations = (node: any, set: Set<string>) => {
              if (node['Relation Name']) set.add(node['Relation Name']);
              if (node.Plans) node.Plans.forEach((child: any) => findRelations(child, set));
            };
            findRelations(planArray[0].Plan, rels);
            
            if (rels.size > 0) {
              const tablesList = Array.from(rels).map(r => `'${r}'`).join(',');
              const indexQuery = `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN (${tablesList})`;
              const idxResult = await DatabaseApiClient.executeQuery(indexQuery);
              
              if (idxResult.status !== 'error' && idxResult.rows) {
                analysis.indexes = idxResult.rows.map(r => {
                  const def = String(r.indexdef || '');
                  const isUnique = def.toLowerCase().includes('unique index');
                  
                  // Extract columns from between parentheses
                  const colMatch = def.match(/\((.*?)\)/);
                  const columns = colMatch ? colMatch[1].split(',').map((c:string) => c.trim()) : [];
                  
                  return {
                    tableName: String(r.tablename),
                    indexName: String(r.indexname),
                    columns,
                    isUnique
                  };
                });
              }
            }
          } catch (e) {
            console.error('Failed to fetch indexes', e);
          }

          setCurrentPerformanceAnalysis(analysis);
          setPerformanceHistory(prev => [analysis, ...prev]);
        } else {
          alert('Could not parse EXPLAIN JSON result.');
          setIsPerformanceModalOpen(false);
        }
      } else {
        alert('No plan returned from database.');
        setIsPerformanceModalOpen(false);
      }
    } catch (err: any) {
      alert(`Analysis Failed: ${err.message}`);
      setIsPerformanceModalOpen(false);
    }
  };

  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  
  // SQL Editor Tabs state
  const [tabs, setTabs] = useState<SqlEditorTab[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_sql_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed.map((t: any) => ({ ...t, isRunning: false, result: null }));
      }
    } catch {}
    return [{
      id: 'tab-1',
      name: 'Query 1.sql',
      query: `-- Write your read-only SQL query here
SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public';
`,
      result: null,
      isRunning: false
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('datapilot_active_tab_id') || 'tab-1';
  });

  const [tabCounter, setTabCounter] = useState<number>(() => {
    const saved = localStorage.getItem('datapilot_tab_counter');
    return saved ? parseInt(saved, 10) : 2;
  });

  useEffect(() => {
    const tabsToSave = tabs.map(t => ({ id: t.id, name: t.name, query: t.query }));
    localStorage.setItem('datapilot_sql_tabs', JSON.stringify(tabsToSave));
    localStorage.setItem('datapilot_active_tab_id', activeTabId);
    localStorage.setItem('datapilot_tab_counter', tabCounter.toString());
  }, [tabs, activeTabId, tabCounter]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const sqlQuery = activeTab.query;
  const isRunningQuery = activeTab.isRunning;
  const queryResult = activeTab.result;
  const queryAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const setSqlQuery = (val: string | ((prev: string) => string)) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newQuery = typeof val === 'function' ? val(t.query) : val;
        let isModified = t.isModified;
        if (t.savedQueryId) {
          const sq = savedQueries.find(q => q.id === t.savedQueryId);
          isModified = sq ? newQuery !== sq.query : true;
        } else {
           isModified = true;
        }
        return { ...t, query: newQuery, isModified };
      }
      return t;
    }));
  };
  const setIsRunningQuery = (val: boolean | ((prev: boolean) => boolean), targetId = activeTabId) => {
    setTabs(prev => prev.map(t => t.id === targetId ? { ...t, isRunning: typeof val === 'function' ? val(t.isRunning) : val } : t));
  };
  const setQueryResult = (val: QueryExecutionResult | null | ((prev: QueryExecutionResult | null) => QueryExecutionResult | null), targetId = activeTabId) => {
    setTabs(prev => prev.map(t => t.id === targetId ? { ...t, result: typeof val === 'function' ? val(t.result) : val } : t));
  };

  const handleAddTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: SqlEditorTab = {
      id: newId,
      name: `Query ${tabCounter}.sql`,
      query: '',
      result: null,
      isRunning: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setTabCounter(prev => prev + 1);
  };

  const handleCloseTab = (id: string) => {
    const tabToClose = tabs.find(t => t.id === id);
    if (!tabToClose) return;
    
    // Prevent accidental loss
    const isUnsaved = tabToClose.query.trim().length > 0 && tabToClose.query !== `-- Write your read-only SQL query here
SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public';
`;
    if (isUnsaved) {
      if (!window.confirm(`Close ${tabToClose.name}? Unsaved SQL will be lost.`)) {
        return;
      }
    }
    
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (filtered.length === 0) {
        // Always keep at least one tab
        const newId = `tab-${Date.now()}`;
        setActiveTabId(newId);
        setTabCounter(prevC => prevC + 1);
        return [{ id: newId, name: `Query ${tabCounter}.sql`, query: '', result: null, isRunning: false }];
      }
      if (activeTabId === id) {
        const idx = prev.findIndex(t => t.id === id);
        const nextTab = prev[idx - 1] || prev[idx + 1] || filtered[0];
        setActiveTabId(nextTab.id);
      }
      return filtered;
    });
    
    // Cancel query if running
    const controller = queryAbortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      queryAbortControllersRef.current.delete(id);
    }
  };

  const handleRenameTab = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const handleDuplicateTab = (id: string) => {
    const tabToDup = tabs.find(t => t.id === id);
    if (!tabToDup) return;
    const newId = `tab-${Date.now()}`;
    const newTab: SqlEditorTab = {
      id: newId,
      name: `${tabToDup.name} (copy)`,
      query: tabToDup.query,
      result: null,
      isRunning: false
    };
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      const newTabs = [...prev];
      newTabs.splice(idx + 1, 0, newTab);
      return newTabs;
    });
    setActiveTabId(newId);
  };


  // Query Library state (project-scoped)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);

  useEffect(() => {
    const storageKey = `datapilot_saved_queries_${activeWorkspace?.id || 'ws_primary'}${activeProjectId ? `_${activeProjectId}` : ''}`;
    let localQueries: SavedQuery[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        localQueries = JSON.parse(saved);
      }
    } catch {
      localQueries = [];
    }
    setSavedQueries(localQueries);

    // Fetch from backend API
    CollaborationApiClient.listSavedQueries(activeProjectId || undefined)
      .then(res => {
        if (res && res.success && Array.isArray(res.queries)) {
          const map = new Map<string, SavedQuery>();
          localQueries.forEach(q => map.set(q.id, q));
          res.queries.forEach(q => {
            const mapped: SavedQuery = {
              id: q.id,
              name: q.name,
              query: q.query,
              description: q.description,
              tags: q.tags || [],
              isFavorite: false,
              createdAt: q.createdAt,
              updatedAt: q.updatedAt
            };
            map.set(q.id, mapped);
          });
          const merged = Array.from(map.values());
          setSavedQueries(merged);
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {}
        }
      })
      .catch(() => {});
  }, [activeWorkspace?.id, activeProjectId]);

  useEffect(() => {
    const storageKey = `datapilot_saved_queries_${activeWorkspace?.id || 'ws_primary'}${activeProjectId ? `_${activeProjectId}` : ''}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedQueries));
    } catch {}
  }, [savedQueries, activeWorkspace?.id, activeProjectId]);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [saveModalState, setSaveModalState] = useState<{ isOpen: boolean; mode: 'save' | 'save_as' }>({ isOpen: false, mode: 'save' });

  const handleSaveQuerySubmit = (name: string, description: string, tags: string[]) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    
    if (saveModalState.mode === 'save' && tab.savedQueryId) {
      // Update existing
      setSavedQueries(prev => prev.map(q => q.id === tab.savedQueryId ? {
        ...q, name, description, tags, query: tab.query, updatedAt: new Date().toISOString()
      } : q));
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name, isModified: false } : t));
      CollaborationApiClient.saveSavedQuery({
        id: tab.savedQueryId,
        name,
        description,
        query: tab.query,
        tags,
        projectId: activeProjectId || undefined
      }).catch(() => {});
    } else {
      // Create new
      const newId = `sq-${Date.now()}`;
      const newSavedQuery: SavedQuery = {
        id: newId,
        name,
        query: tab.query,
        description,
        tags,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setSavedQueries(prev => [...prev, newSavedQuery]);
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name, savedQueryId: newId, isModified: false } : t));
      CollaborationApiClient.saveSavedQuery({
        id: newId,
        name,
        description,
        query: tab.query,
        tags,
        projectId: activeProjectId || undefined
      }).catch(() => {});
    }
    setSaveModalState({ isOpen: false, mode: 'save' });
  };

  const handleOpenLibraryQuery = (q: SavedQuery) => {
    // Open in current tab if it's empty/untouched, otherwise create new tab
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && !tab.isModified && !tab.savedQueryId && tab.query.trim() === '' || (tab && tab.query.includes('SELECT table_name, table_type'))) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name: q.name, query: q.query, savedQueryId: q.id, isModified: false } : t));
    } else {
      const newId = `tab-${Date.now()}`;
      setTabs(prev => [...prev, { id: newId, name: q.name, query: q.query, result: null, isRunning: false, savedQueryId: q.id, isModified: false }]);
      setActiveTabId(newId);
      setTabCounter(prev => prev + 1);
    }
    setIsLibraryOpen(false);
  };

  // Query History state (persisted locally)

  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('datapilot_query_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('datapilot_query_history', JSON.stringify(queryHistory));
    } catch {
      // Ignore storage errors
    }
  }, [queryHistory]);

  // Right-side AI Assistant panel visibility
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);

  // AI Assistant Pending Triggers
  const [pendingExplainSql, setPendingExplainSql] = useState<string | null>(null);
  const [pendingExplainResults, setPendingExplainResults] = useState<{
    query: string;
    columns: { name: string; type?: string }[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
  } | null>(null);
  const [pendingFixSql, setPendingFixSql] = useState<{
    failedSql: string;
    errorMessage: string;
  } | null>(null);

  const loadImportedDatasets = async () => {
    try {
      const ds = await ImportApiClient.getDatasets();
      setImportedDatasets(ds || []);
    } catch {
      setImportedDatasets([]);
    }
  };

  // Check connection status and load workspace datasets on mount or workspace change
  useEffect(() => {
    let isMounted = true;
    loadImportedDatasets();

    DatabaseApiClient.getStatus()
      .then(res => {
        if (isMounted && res.isConnected && res.connection) {
          setConnection(res.connection);
        }
        if (isMounted) {
          loadTables();
        }
      })
      .catch(() => {
        if (isMounted) {
          loadTables();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id, activeProjectId]);

  const loadTables = async () => {
    try {
      const [discovered, discoveredSchemas] = await Promise.all([
        DatabaseApiClient.getTables().catch(() => []),
        DatabaseApiClient.getSchemas().catch(() => ['public'])
      ]);
      setTables(discovered || []);
      setSchemas(discoveredSchemas || []);
      try {
        const rels = await DatabaseApiClient.getRelationships();
        setRelationships(rels || []);
      } catch {
        setRelationships([]);
      }
    } catch {
      setTables([]);
      setSchemas([]);
    }
  };

  const handleImportSuccess = async (
    dataset: ImportedDataset,
    navigateTo?: 'analysis' | 'visualization' | 'sql' | 'dashboard'
  ) => {
    await loadImportedDatasets();
    await loadTables();

    setActiveDatasetId(dataset.datasetId);

    const importedTable: DiscoveredTable = {
      schema: 'imported',
      name: dataset.tableName,
      type: 'TABLE',
      approximateRowCount: dataset.rowCount
    };

    handleSelectTable(importedTable);

    if (navigateTo === 'analysis') {
      setActiveWorkspaceView('analysis');
    } else if (navigateTo === 'visualization') {
      setActiveWorkspaceView('visualization');
    } else if (navigateTo === 'sql') {
      setActiveWorkspaceView('editor');
    } else if (navigateTo === 'dashboard') {
      setActiveWorkspaceView('dashboards');
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    await loadImportedDatasets();
    await loadTables();
    if (selectedTable && inspectingDataset?.datasetId === datasetId) {
      setSelectedTable(null);
    }
  };

  const handleRenameDataset = async (updated: ImportedDataset) => {
    await loadImportedDatasets();
    await loadTables();
    setInspectingDataset(updated);
  };

  // Connected to a real database
  const handleConnected = async (connInfo: SanitizedConnectionInfo) => {
    setConnection(connInfo);
    setIsRefreshingSchema(true);
    try {
      const [discovered, discSchemas] = await Promise.all([
        DatabaseApiClient.getTables(),
        DatabaseApiClient.getSchemas().catch(() => ['public'])
      ]);
      setTables(discovered);
      setSchemas(discSchemas);
      setRefreshMessage(`Connected to ${connInfo.database}. Discovered ${discovered.length} tables.`);
      setTimeout(() => setRefreshMessage(null), 4000);
      if (discovered.length > 0) {
        // Auto-introspect first table
        handleSelectTable(discovered[0]);
      }
    } catch (err: any) {
      setRefreshMessage(`Connected, but failed to list tables: ${err.message}`);
    } finally {
      setIsRefreshingSchema(false);
    }
  };

  // Disconnect from database
  const handleDisconnect = async () => {
    try {
      await DatabaseApiClient.disconnect();
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setConnection(null);
      setSchemas([]);
      setSelectedSchema('');
      setRelationships([]);
      setSelectedTable(null);
      setQueryResult(null);
      setRefreshMessage(null);
      // Reload tables so imported datasets remain visible
      loadTables();
    }
  };

  // Introspect table details when user selects a table
  const handleSelectTable = async (table: DiscoveredTable) => {
    if (table.schema === 'imported') {
      const ds = importedDatasets.find(d => d.tableName === table.name);
      if (ds) setActiveDatasetId(ds.datasetId);
    } else {
      setActiveDatasetId(null);
    }

    setIsLoadingTableDetails(true);
    try {
      let details = tableDetailsCache[`${table.schema}.${table.name}`];
      if (!details) {
        details = await DatabaseApiClient.getTableDetails(table.schema, table.name);
        setTableDetailsCache(prev => ({ ...prev, [`${table.schema}.${table.name}`]: details }));
      }
      setSelectedTable(details);

      // Auto-generate clean read-only SELECT template in the editor
      let qualifiedName = `"${table.name}"`;
      if (table.schema === 'imported') {
        qualifiedName = `"${table.name}"`;
      } else if (connection?.type === 'mysql') {
        qualifiedName = table.schema ? `\`${table.schema}\`.\`${table.name}\`` : `\`${table.name}\``;
      } else if (connection?.type === 'sqlserver') {
        qualifiedName = table.schema ? `[${table.schema}].[${table.name}]` : `[${table.name}]`;
      } else {
        qualifiedName = table.schema ? `"${table.schema}"."${table.name}"` : `"${table.name}"`;
      }
      setSqlQuery(`SELECT *\nFROM ${qualifiedName}\nLIMIT 50;\n`);
    } catch (err: any) {
      console.error('Failed to inspect table:', err);
    } finally {
      setIsLoadingTableDetails(false);
    }
  };

  // Refresh Schema from backend
  const handleRefreshSchema = async () => {
    if (!connection) return;

    setIsRefreshingSchema(true);
    try {
      const [res, discSchemas] = await Promise.all([
        DatabaseApiClient.refreshSchema(),
        DatabaseApiClient.getSchemas().catch(() => ['public'])
      ]);
      setTables(res.tables);
      setSchemas(discSchemas);
      setRelationships(res.relationships);
      setRefreshMessage(`Schema updated (${res.tableCount} tables discovered)`);
      setTimeout(() => setRefreshMessage(null), 3500);

      // If a table was selected, re-fetch its details
      if (selectedTable) {
        const stillExists = res.tables.find(
          t => t.schema === selectedTable.schema && t.name === selectedTable.name
        );
        if (stillExists) {
          const updatedDetails = await DatabaseApiClient.getTableDetails(
            selectedTable.schema,
            selectedTable.name
          );
          setSelectedTable(updatedDetails);
        } else {
          setSelectedTable(null);
        }
      }
    } catch (err: any) {
      setRefreshMessage(`Refresh failed: ${err.message}`);
      setTimeout(() => setRefreshMessage(null), 4000);
    } finally {
      setIsRefreshingSchema(false);
    }
  };

  // Insert column identifier into query editor
  const handleInsertColumnToQuery = (columnIdentifier: string) => {
    setSqlQuery(prev => {
      const trimmed = prev.trimEnd();
      if (!trimmed) {
        return `SELECT ${columnIdentifier} FROM ...`;
      }
      return `${prev} ${columnIdentifier}`;
    });
  };

  // Execute read-only SQL query via backend
  const executeSql = async (sqlToRun: string) => {
    const queryStr = sqlToRun.trim();
    const targetTabId = activeTabId;
    const targetTab = tabs.find(t => t.id === targetTabId) || tabs[0];
    
    if (!queryStr || targetTab.isRunning) return;

    const controller = new AbortController();
    queryAbortControllersRef.current.set(targetTabId, controller);
    setIsRunningQuery(true, targetTabId);

    try {
      const result = await DatabaseApiClient.executeQuery(queryStr, 1000, controller.signal);
      setQueryResult(result, targetTabId);

      if (result.status === 'success' || result.status === 'error' || result.status === 'cancelled') {
        const historyItem: QueryHistoryItem = {
          id: String(Date.now()),
          query: queryStr,
          timestamp: new Date().toISOString(),
          status: result.status,
          executionTimeMs: result.executionTimeMs,
          rowCount: result.rowCount,
          errorMessage: result.errorMessage
        };
        setQueryHistory(prev => [historyItem, ...prev.filter(h => h.query !== queryStr).slice(0, 49)]);
      }
    } catch (err: any) {
      const errResult: QueryExecutionResult = {
        query: queryStr,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        status: 'error',
        errorMessage: err.message || 'Failed to execute query',
        timestamp: new Date()
      };
      setQueryResult(errResult, targetTabId);
      
      const historyItem: QueryHistoryItem = {
        id: String(Date.now()),
        query: queryStr,
        timestamp: new Date().toISOString(),
        status: 'error',
        executionTimeMs: 0,
        rowCount: 0,
        errorMessage: err.message || 'Failed to execute query'
      };
      setQueryHistory(prev => [historyItem, ...prev.filter(h => h.query !== queryStr).slice(0, 49)]);
    } finally {
      setIsRunningQuery(false, targetTabId);
      queryAbortControllersRef.current.delete(targetTabId);
    }
  };

  const handleRunQuery = () => {
    executeSql(sqlQuery);
  };

  // AI Assistant Action Handlers
  const handleRunGeneratedQuery = (sql: string) => {
    setSqlQuery(sql);
    executeSql(sql);
  };

  const handleEditGeneratedQuery = (sql: string) => {
    setSqlQuery(sql);
  };

  const handleExplainSql = (sql: string) => {
    setPendingExplainSql(sql);
    setIsAiPanelOpen(true);
  };

  const handleExplainResults = (result: QueryExecutionResult) => {
    setPendingExplainResults({
      query: result.query,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs
    });
    setIsAiPanelOpen(true);
  };

  const handleFixSqlError = (failedSql: string, errorMessage: string) => {
    setPendingFixSql({ failedSql, errorMessage });
    setIsAiPanelOpen(true);
  };

  // Cancel query execution in progress
  const handleCancelQuery = () => {
    const controller = queryAbortControllersRef.current.get(activeTabId);
    if (controller) {
      controller.abort();
      queryAbortControllersRef.current.delete(activeTabId);
    }
    setIsRunningQuery(false, activeTabId);
  };

  const handleClearQuery = () => {
    setSqlQuery('');
  };

  const handleSelectHistoryItem = (item: QueryHistoryItem) => {
    setSqlQuery(item.query);
  };

  const handleClearHistory = () => {
    setQueryHistory([]);
    try {
      localStorage.removeItem('datapilot_query_history');
    } catch {
      // Ignore storage errors
    }
  };

  const handleEditInEditorFromAnalysis = (sql: string) => {
    setSqlQuery(sql);
    setActiveWorkspaceView('editor');
  };

  const handleRunQueryFromAnalysis = async (sql: string): Promise<QueryExecutionResult> => {
    setSqlQuery(sql);
    await executeSql(sql);
    return queryResult || {
      query: sql,
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: 0,
      status: 'success',
      timestamp: new Date()
    };
  };

  // Dashboard integration handlers
  const handleAddToDashboardFromResults = (res: QueryExecutionResult) => {
    setAddToDashboardData({
      isOpen: true,
      sqlQuery: res.query || sqlQuery,
      sourceTable: selectedTable?.name,
      cachedResult: res,
      defaultTitle: selectedTable ? `${selectedTable.name} Metric` : 'Query Metric'
    });
  };

  const handleAddToDashboardFromVis = (
    config: ChartConfig,
    res: QueryResult,
    sourceTable?: string,
    datasetId?: string
  ) => {
    setAddToDashboardData({
      isOpen: true,
      sqlQuery: res.query || sqlQuery,
      sourceTable: sourceTable || selectedTable?.name,
      datasetId: datasetId || (selectedTable?.schema === 'imported' ? activeDataset?.datasetId : undefined),
      chartType: config.chartType,
      chartConfig: config,
      cachedResult: res,
      defaultTitle: config.title || 'Chart Widget'
    });
  };

  const handleAddToDashboardFromAnalysis = (meta: GeneratedAnalysisQuery) => {
    setAddToDashboardData({
      isOpen: true,
      sqlQuery: meta.sql,
      sourceTable: meta.tablesUsed?.[0] || selectedTable?.name,
      defaultTitle: meta.title || meta.name || 'Analysis Metric'
    });
  };

  const handleNavigateToSqlEditorFromDashboard = (sql: string) => {
    setSqlQuery(sql);
    setActiveWorkspaceView('editor');
  };

  const handleNavigateToVisualizationFromDashboard = (result: QueryResult) => {
    setQueryResult(result as QueryExecutionResult);
    setActiveWorkspaceView('visualization');
  };

  const handleNavigateToAnalysisFromDashboard = (tableName?: string) => {
    if (tableName) {
      const tbl = tables.find(t => t.name === tableName || `${t.schema}.${t.name}` === tableName);
      if (tbl) {
        handleSelectTable(tbl);
      }
    }
    setActiveWorkspaceView('analysis');
  };

  return (
    <div id="datapilot-workspace" className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        connection={connection}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onDisconnect={handleDisconnect}
        onRefreshSchema={handleRefreshSchema}
        isRefreshing={isRefreshingSchema}
        isAiPanelOpen={isAiPanelOpen}
        onToggleAiPanel={() => setIsAiPanelOpen(prev => !prev)}
        activeView={activeWorkspaceView}
        onViewChange={setActiveWorkspaceView}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenAdminConsole={() => setIsAdminConsoleOpen(true)}
        onOpenActivityFeed={() => setIsActivityFeedOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
      />

      {/* Unverified Email Warning Banner */}
      {user && emailVerificationRequired && (
        <div className="bg-amber-950/70 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-30">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Your email address (<strong>{user.email}</strong>) is not verified. Please verify your email to unlock project and workspace creation.
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {resendBannerSuccess ? (
              <span className="text-emerald-400 text-xs flex items-center space-x-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>{resendBannerSuccess}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendBanner}
                disabled={isResendingBanner || bannerCooldown > 0}
                className="text-amber-300 hover:text-white underline font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isResendingBanner ? 'Sending...' : bannerCooldown > 0 ? `Resend in ${bannerCooldown}s` : 'Resend Verification Link'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Body: 3-Panel Layout + Optional Right AI Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Database Explorer */}
        <DatabaseExplorer
          connection={connection}
          tables={tables}
          schemas={schemas}
          selectedSchema={selectedSchema}
          onSelectSchema={setSelectedSchema}
          importedDatasets={importedDatasets}
          selectedTable={selectedTable}
          isLoadingTableDetails={isLoadingTableDetails}
          onSelectTable={handleSelectTable}
          onCloseTableDetails={() => setSelectedTable(null)}
          onRefreshSchema={handleRefreshSchema}
          isRefreshing={isRefreshingSchema}
          refreshMessage={refreshMessage}
          onOpenConnectModal={() => setIsConnectModalOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onInspectDataset={ds => setInspectingDataset(ds)}
          onCleanDataset={ds => {
            setActiveDatasetId(ds.datasetId);
            setActiveWorkspaceView('cleaning');
          }}
          onDisconnect={handleDisconnect}
          onInsertColumnToQuery={handleInsertColumnToQuery}
        />

        {/* Center & Bottom Area: SQL Editor + Query Results OR Analysis Studio */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950">
          <ErrorBoundary
            fallbackTitle="Error in Workspace View"
            onReset={() => {
              setActiveWorkspaceView('editor');
              setQueryResult(null);
            }}
          >
            {activeWorkspaceView === 'editor' ? (
              <SqlWorkspace
                tabs={tabs}
                activeTabId={activeTabId}
                onTabSelect={setActiveTabId}
                onTabClose={handleCloseTab}
                onTabAdd={handleAddTab}
                onTabRename={handleRenameTab}
                onTabDuplicate={handleDuplicateTab}
                sqlQuery={sqlQuery}
                onChangeQuery={setSqlQuery}
                onRunQuery={handleRunQuery}
                onCancelQuery={handleCancelQuery}
                onClearQuery={handleClearQuery}
                onExplainSql={handleExplainSql}
                onAnalyzePerformance={handleAnalyzePerformance}
                isRunningQuery={isRunningQuery}
                queryResult={queryResult}
                queryHistory={queryHistory}
                onSelectHistoryItem={handleSelectHistoryItem}
                onClearHistory={handleClearHistory}
                tables={tables}
                tableDetailsCache={tableDetailsCache}
                onSaveQuery={() => setSaveModalState({ isOpen: true, mode: 'save' })}
                onSaveAsQuery={() => setSaveModalState({ isOpen: true, mode: 'save_as' })}
                onOpenLibrary={() => setIsLibraryOpen(true)}
                activeTab={activeTab}
                savedQueries={savedQueries}
                onExplainResults={handleExplainResults}
                onFixSqlError={handleFixSqlError}
                onNavigateToVisualization={() => setActiveWorkspaceView('visualization')}
                onAddToDashboardFromResults={handleAddToDashboardFromResults}
                selectedTable={selectedTable}
                dialect={connection?.type || 'postgresql'}
              />
            ) : activeWorkspaceView === 'analysis' ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className={`${queryResult ? 'h-3/5' : 'h-full'} flex flex-col overflow-hidden`}>
                  <AnalysisStudio
                    connectionType={connection?.type || 'postgresql'}
                    selectedTable={
                      selectedTable
                        ? {
                            schema: selectedTable.schema,
                            name: selectedTable.name,
                            type: selectedTable.type,
                            approximateRowCount: selectedTable.approximateRowCount
                          }
                        : tables[0] || null
                    }
                    allTables={tables}
                    onSelectTable={handleSelectTable}
                    onExecuteQuery={handleRunQueryFromAnalysis}
                    onEditInEditor={handleEditInEditorFromAnalysis}
                    isRunningQuery={isRunningQuery}
                    onAddToDashboard={handleAddToDashboardFromAnalysis}
                  />
                </div>

                {/* Query Results visible if an analysis query was executed */}
                {queryResult && (
                  <div className="h-2/5 min-h-[180px] flex flex-col border-t border-slate-800">
                    <QueryResults
                      result={queryResult}
                      isRunning={isRunningQuery}
                      onCancelQuery={handleCancelQuery}
                      onExplainResults={handleExplainResults}
                      onFixSqlError={handleFixSqlError}
                      onNavigateToVisualization={() => setActiveWorkspaceView('visualization')}
                      onAddToDashboard={handleAddToDashboardFromResults}
                      sourceName={selectedTable?.name}
                    />
                  </div>
                )}
              </div>
            ) : activeWorkspaceView === 'visualization' ? (
              <VisualizationWorkspace
                queryResult={queryResult}
                isConnected={Boolean(connection?.isConnected)}
                connection={connection}
                onOpenConnectModal={() => setIsConnectModalOpen(true)}
                isAiConfigured={true}
                onAddToDashboard={handleAddToDashboardFromVis}
                importedDatasets={importedDatasets}
                activeDataset={activeDataset}
                onSelectDataset={ds => {
                  setActiveDatasetId(ds.datasetId);
                  handleSelectTable({
                    schema: 'imported',
                    name: ds.tableName,
                    type: 'TABLE',
                    approximateRowCount: ds.rowCount
                  });
                }}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                selectedTable={selectedTable}
                tables={tables}
                onSelectTable={handleSelectTable}
              />
            
            ) : activeWorkspaceView === 'lineage' ? (
              <DataLineageWorkspace
                tables={tables}
                relationships={relationships}
                tableDetailsCache={tableDetailsCache}
                onSelectTable={handleSelectTable}
                onLoadTableDetails={async (schema, name) => {
                  try {
                    const details = await DatabaseApiClient.getTableDetails(schema, name);
                    setTableDetailsCache(prev => ({ ...prev, [`${schema}.${name}`]: details }));
                  } catch (e) {}
                }}
              />
            ) : activeWorkspaceView === 'data-quality' ? (
              <DataQualityWorkspace
                selectedTable={selectedTable}
                connection={connection}
                tables={tables}
                onSelectTable={handleSelectTable}
                activeDatasetId={activeDatasetId}
                dataset={activeDataset}
              />
            ) : activeWorkspaceView === 'cleaning' ? (
              <DataCleaningWorkspace
                dataset={activeDataset}
                allDatasets={importedDatasets}
                tables={tables}
                selectedTable={selectedTable}
                connection={connection}
                onSelectDataset={ds => {
                  setActiveDatasetId(ds.datasetId);
                  handleSelectTable({
                    schema: 'imported',
                    name: ds.tableName,
                    type: 'TABLE',
                    approximateRowCount: ds.rowCount
                  });
                }}
                onSelectTable={table => {
                  handleSelectTable(table);
                }}
                onDatasetCreated={async newDs => {
                  setImportedDatasets(prev => [newDs, ...prev]);
                  setActiveDatasetId(newDs.datasetId);
                  await loadTables();
                  handleSelectTable({
                    schema: 'imported',
                    name: newDs.tableName,
                    type: 'TABLE',
                    approximateRowCount: newDs.rowCount
                  });
                }}
                onOpenImportModal={() => setIsImportModalOpen(true)}
                onOpenConnectModal={() => setIsConnectModalOpen(true)}
              />
            ) : activeWorkspaceView === 'reports' ? (
              <ReportsWorkspace />
            ) : (
              <DashboardWorkspace
                discoveredTables={allDiscoveredTables}
                isConnected={Boolean(connection?.isConnected) || importedDatasets.length > 0}
                onNavigateToSqlEditor={handleNavigateToSqlEditorFromDashboard}
                onNavigateToVisualization={handleNavigateToVisualizationFromDashboard}
                onNavigateToAnalysis={handleNavigateToAnalysisFromDashboard}
              />
            )}
          </ErrorBoundary>
        </main>

        {/* Right-Side Optional Panel: AI Data Assistant */}
        <AiAssistantPanel
          isOpen={isAiPanelOpen}
          onToggle={() => setIsAiPanelOpen(prev => !prev)}
          selectedTable={
            selectedTable
              ? {
                  schema: selectedTable.schema,
                  name: selectedTable.name,
                  type: selectedTable.type
                }
              : null
          }
          onRunGeneratedQuery={handleRunGeneratedQuery}
          onEditGeneratedQuery={handleEditGeneratedQuery}
          pendingExplainSql={pendingExplainSql}
          onClearPendingExplainSql={() => setPendingExplainSql(null)}
          pendingExplainResults={pendingExplainResults}
          onClearPendingExplainResults={() => setPendingExplainResults(null)}
          pendingFixSql={pendingFixSql}
          onClearPendingFixSql={() => setPendingFixSql(null)}
        />
      </div>

      {/* Add To Dashboard Modal */}
      <AddToDashboardModal
        isOpen={addToDashboardData.isOpen}
        onClose={() => setAddToDashboardData(prev => ({ ...prev, isOpen: false }))}
        query={addToDashboardData.sqlQuery}
        sourceTable={addToDashboardData.sourceTable}
        datasetId={addToDashboardData.datasetId}
        chartType={addToDashboardData.chartType}
        chartConfig={addToDashboardData.chartConfig}
        cachedResult={addToDashboardData.cachedResult}
        defaultTitle={addToDashboardData.defaultTitle}
        onSuccess={() => {
          setActiveWorkspaceView('dashboards');
        }}
      />

      {/* Collaboration Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <AdminConsoleModal
        isOpen={isAdminConsoleOpen}
        onClose={() => setIsAdminConsoleOpen(false)}
      />

      <ActivityFeedDrawer
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
      />

      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectResource={(type, id, name) => {
          if (type === 'query') {
            const sq = savedQueries.find(q => q.id === id);
            if (sq) {
              handleOpenLibraryQuery(sq);
            } else {
              setActiveWorkspaceView('editor');
            }
          } else if (type === 'dashboard') {
            setActiveWorkspaceView('dashboards');
          } else if (type === 'report') {
            setActiveWorkspaceView('reports');
          } else if (type === 'dataset') {
            const ds = importedDatasets.find(d => d.datasetId === id);
            if (ds) {
              setActiveDatasetId(ds.datasetId);
              handleSelectTable({
                schema: 'imported',
                name: ds.tableName,
                type: 'TABLE',
                approximateRowCount: ds.rowCount
              });
              setActiveWorkspaceView('analysis');
            }
          }
        }}
      />
      
      {/* Modals */}
      
      <PerformanceAnalyzerModal
        isOpen={isPerformanceModalOpen}
        onClose={() => setIsPerformanceModalOpen(false)}
        analysis={currentPerformanceAnalysis}
        history={performanceHistory}
        tables={tables}
        tableDetailsCache={tableDetailsCache}
      />

      <QueryLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        savedQueries={savedQueries}
        onOpenQuery={handleOpenLibraryQuery}
        onDeleteQuery={(id) => {
          setSavedQueries(prev => prev.filter(q => q.id !== id));
          CollaborationApiClient.deleteSavedQuery(id).catch(() => {});
        }}
        onToggleFavorite={(id) => setSavedQueries(prev => prev.map(q => q.id === id ? { ...q, isFavorite: !q.isFavorite } : q))}
        onDuplicateQuery={(q) => {
          const newId = `sq-${Date.now()}`;
          setSavedQueries(prev => [...prev, { ...q, id: newId, name: `${q.name} (Copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        }}
      />
      <SaveQueryModal
        isOpen={saveModalState.isOpen}
        onClose={() => setSaveModalState({ isOpen: false, mode: 'save' })}
        onSave={handleSaveQuerySubmit}
        initialData={
          saveModalState.isOpen && activeTab?.savedQueryId
            ? savedQueries.find(q => q.id === activeTab.savedQueryId)
            : { name: activeTab?.name === `Query ${tabCounter - 1}.sql` || activeTab?.name.startsWith('Query ') ? '' : activeTab?.name }
        }
      />

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnected={handleConnected}
        currentConnection={connection}
      />

      {/* Data Import Modal */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Dataset Detail / Management Modal */}
      <DatasetDetailModal
        dataset={inspectingDataset}
        isOpen={Boolean(inspectingDataset)}
        onClose={() => setInspectingDataset(null)}
        onDatasetDeleted={handleDeleteDataset}
        onDatasetRenamed={handleRenameDataset}
        onCleanDataset={ds => {
          setActiveDatasetId(ds.datasetId);
          setActiveWorkspaceView('cleaning');
        }}
        onAnalyzeDataset={ds => {
          const importedTable: DiscoveredTable = {
            schema: 'imported',
            name: ds.tableName,
            type: 'TABLE',
            approximateRowCount: ds.rowCount
          };
          handleSelectTable(importedTable);
          setActiveWorkspaceView('analysis');
        }}
      />
    </div>
  );
}

function MainAppRouter() {
  const { user, isLoadingAuth } = useCollaboration();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <DataPilotLogo size="xl" showTagline={true} />
        <div className="flex items-center space-x-2 text-xs text-slate-400 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Verifying secure session & workspace membership...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppContent />;
}

export default function App() {
  return (
    <CollaborationProvider>
      <MainAppRouter />
    </CollaborationProvider>
  );
}
