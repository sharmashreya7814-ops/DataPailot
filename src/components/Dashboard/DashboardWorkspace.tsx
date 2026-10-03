import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Plus,
  RefreshCw,
  Sparkles,
  Grid,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  SlidersHorizontal,
  Layers,
  ArrowLeft,
  Trash2,
  Copy,
  Edit3,
  Check,
  X,
  Play,
  Maximize2,
  Minimize2,
  Clock,
  Camera,
  AlertTriangle,
  HelpCircle,
  Database,
  Search,
  Filter,
  BarChart3
} from 'lucide-react';
import {
  Dashboard,
  DashboardWidget,
  DashboardFilter,
  DashboardInsightItem,
  WidgetPreset,
  WidgetColSpan,
  WidgetSize
} from '../../types/dashboard';
import { DiscoveredTable, QueryResult } from '../../types/database';
import { DashboardService } from '../../services/dashboardService';
import { DashboardRefreshService } from '../../services/dashboardRefreshService';
import { DashboardFilterEngine } from '../../services/dashboardFilterEngine';
import { DashboardExportService } from '../../services/dashboardExportService';
import { DatabaseApiClient } from '../../services/databaseApi';

import { DashboardList } from './DashboardList';
import { DashboardWidgetCard, FilterCompatibilityInfo } from './DashboardWidgetCard';
import { DashboardFilterBar } from './DashboardFilterBar';
import { DashboardTemplatesModal } from './DashboardTemplatesModal';
import { DashboardAiBuilderModal } from './DashboardAiBuilderModal';
import { DashboardInsightsDrawer } from './DashboardInsightsDrawer';
import { AddToDashboardModal } from './AddToDashboardModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PromptDialog } from '../common/PromptDialog';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';

interface DashboardWorkspaceProps {
  discoveredTables: DiscoveredTable[];
  isConnected: boolean;
  onNavigateToSqlEditor: (sql: string) => void;
  onNavigateToVisualization: (result?: QueryResult) => void;
  onNavigateToAnalysis: () => void;
}

export const DashboardWorkspace: React.FC<DashboardWorkspaceProps> = ({
  discoveredTables,
  isConnected,
  onNavigateToSqlEditor,
  onNavigateToVisualization,
  onNavigateToAnalysis
}) => {
  const { activeWorkspace, activeProjectId } = useCollaboration();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);

  // Results cache for the active dashboard widgets
  const [widgetResults, setWidgetResults] = useState<Map<string, QueryResult>>(new Map());
  const [refreshingWidgets, setRefreshingWidgets] = useState<Set<string>>(new Set());
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Interactive modes
  const [isSnapshotMode, setIsSnapshotMode] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [crossFilter, setCrossFilter] = useState<{ column: string; value: string } | null>(null);

  // Modals & Drawers
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isAiBuilderOpen, setIsAiBuilderOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<{ id: string; name: string } | null>(null);
  const [dashboardToDuplicate, setDashboardToDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [dashboardToRename, setDashboardToRename] = useState<{ id: string; name: string } | null>(null);

  // Inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState('');

  // Insights State
  const [insights, setInsights] = useState<DashboardInsightItem[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Drag-and-drop state
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  const isRefreshingRef = useRef(false);
  const filterDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceTimerRef.current) {
        clearTimeout(filterDebounceTimerRef.current);
      }
    };
  }, []);

  // Reload dashboards whenever active workspace or active project changes
  useEffect(() => {
    if (activeWorkspace?.id) {
      DashboardService.setWorkspaceId(activeWorkspace.id);
    }
    DashboardService.setProjectId(activeProjectId);
    const list = DashboardService.getDashboards();
    setDashboards(list);
    setCurrentDashboardId(null);
    setWidgetResults(new Map());

    // Sync from collaboration API
    CollaborationApiClient.listDashboards(activeProjectId || undefined)
      .then(res => {
        if (res && res.success && Array.isArray(res.dashboards)) {
          const local = DashboardService.getDashboards();
          const map = new Map<string, Dashboard>();
          local.forEach(d => map.set(d.id, d));
          res.dashboards.forEach(d => {
            const mapped: Dashboard = {
              id: d.id,
              name: d.title,
              description: d.description,
              widgets: d.widgets || [],
              filters: d.filters || [],
              layout: d.layout || { columns: 3, rowHeight: 180, gap: 16 },
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
              autoRefreshInterval: d.autoRefreshInterval || 0,
              projectId: d.projectId
            };
            map.set(d.id, mapped);
            DashboardService.saveDashboard(mapped);
          });
          setDashboards(Array.from(map.values()));
        }
      })
      .catch(() => {});
  }, [activeWorkspace?.id, activeProjectId]);

  const currentDashboard = dashboards.find(d => d.id === currentDashboardId) || null;

  // Sync title inputs when currentDashboard changes
  useEffect(() => {
    if (currentDashboard) {
      setTitleInput(currentDashboard.name);
      setDescInput(currentDashboard.description || '');
      setAutoRefreshInterval(currentDashboard.autoRefreshInterval || 0);

      // Hydrate cached widget results if available
      const cached = new Map<string, QueryResult>();
      for (const w of currentDashboard.widgets) {
        if (w.cachedResult) {
          cached.set(w.id, w.cachedResult);
        }
      }
      setWidgetResults(cached);
    }
  }, [currentDashboardId]);

  // Handle Fullscreen Keydown (Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode]);

  // Handle Auto-Refresh Timer
  useEffect(() => {
    if (!currentDashboard || autoRefreshInterval <= 0 || isSnapshotMode) {
      return;
    }

    const timer = setInterval(() => {
      handleRefreshAll();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [currentDashboard, autoRefreshInterval, isSnapshotMode, crossFilter]);

  // Centralized Refresh Handler
  const handleRefreshAll = async (
    targetDash?: Dashboard,
    overrideFilters?: DashboardFilter[]
  ) => {
    const dash = targetDash || currentDashboard;
    if (!dash || isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshingAll(true);

    try {
      // Build effective filters including cross-filter if present
      let effectiveFilters = overrideFilters ? [...overrideFilters] : [...dash.filters];
      if (crossFilter) {
        effectiveFilters.push({
          id: 'cross-filter-active',
          label: `Filter by ${crossFilter.column}`,
          type: 'text',
          targetColumn: crossFilter.column,
          currentValue: crossFilter.value
        });
      }

      const summary = await DashboardRefreshService.refreshDashboard(
        dash,
        effectiveFilters,
        discoveredTables
      );

      // Update widget results
      const newResults = new Map(widgetResults);
      let updatedWidgets = [...dash.widgets];

      summary.results.forEach((res, widgetId) => {
        if (res.result) {
          newResults.set(widgetId, res.result);
        }
        const wIdx = updatedWidgets.findIndex(w => w.id === widgetId);
        if (wIdx >= 0) {
          updatedWidgets[wIdx] = {
            ...updatedWidgets[wIdx],
            status: res.status,
            cachedResult: res.result || updatedWidgets[wIdx].cachedResult,
            errorMessage: res.errorMessage,
            schemaChangeDetails: res.schemaChangeDetails,
            lastExecutedAt: new Date().toISOString()
          };
        }
      });

      setWidgetResults(newResults);
      setLastRefreshedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );

      // Persist updated widget statuses
      const updatedDash: Dashboard = {
        ...dash,
        widgets: updatedWidgets,
        updatedAt: new Date().toISOString()
      };
      DashboardService.saveDashboard(updatedDash);
      setDashboards(DashboardService.getDashboards());
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshingAll(false);
    }
  };

  // Refresh single widget
  const handleRefreshWidget = async (widgetId: string) => {
    if (!currentDashboard) return;
    const widget = currentDashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;

    setRefreshingWidgets(prev => new Set(prev).add(widgetId));

    try {
      let effectiveFilters = [...currentDashboard.filters];
      if (crossFilter) {
        effectiveFilters.push({
          id: 'cross-filter-active',
          label: crossFilter.column,
          type: 'text',
          targetColumn: crossFilter.column,
          currentValue: crossFilter.value
        });
      }

      // Safe refresh single widget
      const res = await DashboardRefreshService.refreshSingleWidget(
        widget,
        effectiveFilters,
        discoveredTables
      );

      if (res.result) {
        setWidgetResults(prev => new Map(prev).set(widgetId, res.result!));
      }

      const updated = DashboardService.updateWidget(currentDashboard.id, widgetId, {
        status: res.status,
        cachedResult: res.result || widget.cachedResult,
        errorMessage: res.errorMessage,
        schemaChangeDetails: res.schemaChangeDetails,
        lastExecutedAt: new Date().toISOString()
      });

      if (updated) {
        setDashboards(DashboardService.getDashboards());
      }
    } finally {
      setRefreshingWidgets(prev => {
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
    }
  };

  // Create New Blank Dashboard
  const handleCreateNew = () => {
    const created = DashboardService.createDashboard('New Executive Dashboard');
    setDashboards(DashboardService.getDashboards());
    setCurrentDashboardId(created.id);
  };

  // Duplicate Dashboard (Opens reusable DataPilot PromptDialog)
  const handleDuplicate = (id: string) => {
    const target = dashboards.find(d => d.id === id);
    if (target) {
      setDashboardToDuplicate({
        id: target.id,
        name: target.name
      });
    }
  };

  const handleConfirmDuplicate = (enteredName: string) => {
    if (!dashboardToDuplicate) return;
    const dup = DashboardService.duplicateDashboard(dashboardToDuplicate.id, enteredName);
    if (dup) {
      setDashboards(DashboardService.getDashboards());
      setCurrentDashboardId(dup.id);
    }
    setDashboardToDuplicate(null);
  };

  // Rename Dashboard (Opens reusable DataPilot PromptDialog)
  const handleRenameRequest = (id: string, currentName: string) => {
    setDashboardToRename({ id, name: currentName });
  };

  const handleConfirmRename = (newName: string) => {
    if (!dashboardToRename) return;
    DashboardService.renameDashboard(dashboardToRename.id, newName);
    setDashboards(DashboardService.getDashboards());
    setDashboardToRename(null);
  };

  // Delete Dashboard (Opens reusable DataPilot ConfirmDialog)
  const handleDelete = (id: string) => {
    const target = dashboards.find(d => d.id === id);
    setDashboardToDelete({
      id,
      name: target?.name || 'this dashboard'
    });
  };

  const handleConfirmDelete = () => {
    if (!dashboardToDelete) return;
    DashboardService.deleteDashboard(dashboardToDelete.id);
    setDashboards(DashboardService.getDashboards());
    if (currentDashboardId === dashboardToDelete.id) {
      setCurrentDashboardId(null);
    }
    setDashboardToDelete(null);
  };

  // Save Inline Title
  const handleSaveTitle = () => {
    if (!currentDashboard || !titleInput.trim()) return;
    DashboardService.renameDashboard(currentDashboard.id, titleInput.trim());
    setDashboards(DashboardService.getDashboards());
    setIsEditingTitle(false);
  };

  // Save Inline Description
  const handleSaveDesc = () => {
    if (!currentDashboard) return;
    const updated = {
      ...currentDashboard,
      description: descInput.trim(),
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(updated);
    setDashboards(DashboardService.getDashboards());
    setIsEditingDesc(false);
  };

  // Widget Actions: Resize, Duplicate, Remove, Move, Drag
  const handleResizeWidget = (widgetId: string, colSpan: WidgetColSpan) => {
    if (!currentDashboard) return;
    const widget = currentDashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    DashboardService.updateWidget(currentDashboard.id, widgetId, {
      size: { ...widget.size, colSpan }
    });
    setDashboards(DashboardService.getDashboards());
  };

  const handleResizeCustom = (
    widgetId: string,
    size: { colSpan: number; height?: number; preset?: WidgetPreset }
  ) => {
    if (!currentDashboard) return;
    const widget = currentDashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    const rawSpan = Math.max(3, Math.min(12, size.colSpan));
    const validColSpans: WidgetColSpan[] = [3, 4, 6, 8, 9, 12];
    const colSpan = validColSpans.reduce((prev, curr) =>
      Math.abs(curr - rawSpan) < Math.abs(prev - rawSpan) ? curr : prev
    );
    const height = size.height ? Math.max(220, Math.min(800, size.height)) : widget.size.height;
    DashboardService.updateWidget(currentDashboard.id, widgetId, {
      size: {
        ...widget.size,
        colSpan,
        height,
        ...(size.preset ? { preset: size.preset } : {})
      }
    });
    setDashboards(DashboardService.getDashboards());
  };

  const handleDuplicateWidget = (widgetId: string) => {
    if (!currentDashboard) return;
    const res = DashboardService.duplicateWidget(currentDashboard.id, widgetId);
    if (res) {
      setDashboards(DashboardService.getDashboards());
      const originalResult = widgetResults.get(widgetId);
      if (originalResult) {
        setWidgetResults(prev => new Map(prev).set(res.widget.id, originalResult));
      }
    }
  };

  const handleUpdateWidgetTitle = (widgetId: string, newTitle: string) => {
    if (!currentDashboard || !newTitle.trim()) return;
    const widget = currentDashboard.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    const trimmedTitle = newTitle.trim();
    DashboardService.updateWidget(currentDashboard.id, widgetId, {
      title: trimmedTitle,
      chartConfig: {
        ...widget.chartConfig,
        title: trimmedTitle
      }
    });
    setDashboards(DashboardService.getDashboards());
  };

  const handleRemoveWidget = (widgetId: string) => {
    if (!currentDashboard) return;
    DashboardService.removeWidget(currentDashboard.id, widgetId);
    setDashboards(DashboardService.getDashboards());
    setWidgetResults(prev => {
      const next = new Map(prev);
      next.delete(widgetId);
      return next;
    });
  };

  const handleMoveWidget = (widgetId: string, direction: 'prev' | 'next') => {
    if (!currentDashboard) return;
    const widgets = [...currentDashboard.widgets];
    const idx = widgets.findIndex(w => w.id === widgetId);
    if (idx < 0) return;

    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= widgets.length) return;

    // Swap
    const temp = widgets[idx];
    widgets[idx] = widgets[targetIdx];
    widgets[targetIdx] = temp;

    // Update positions
    widgets.forEach((w, i) => {
      w.position = { ...w.position, order: i };
    });

    const updated = {
      ...currentDashboard,
      widgets,
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(updated);
    setDashboards(DashboardService.getDashboards());
  };

  // Drag and Drop Widget Reordering
  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedWidgetId(widgetId);
    e.dataTransfer.setData('text/plain', widgetId);
    e.dataTransfer.setData('application/json', JSON.stringify({ widgetId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedWidgetId && draggedWidgetId !== targetWidgetId && dragOverWidgetId !== targetWidgetId) {
      setDragOverWidgetId(targetWidgetId);
    }
  };

  const handleDragEnter = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    if (draggedWidgetId && draggedWidgetId !== targetWidgetId) {
      setDragOverWidgetId(targetWidgetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !related.closest(`[data-widget-id="${targetWidgetId}"]`)) {
      if (dragOverWidgetId === targetWidgetId) {
        setDragOverWidgetId(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetWidgetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedWidgetId;
    setDragOverWidgetId(null);
    setDraggedWidgetId(null);
    if (!sourceId || sourceId === targetWidgetId || !currentDashboard) return;

    const widgetIds = currentDashboard.widgets.map(w => w.id);
    const sourceIdx = widgetIds.indexOf(sourceId);
    const targetIdx = widgetIds.indexOf(targetWidgetId);
    if (sourceIdx < 0 || targetIdx < 0) return;

    const updatedIds = [...widgetIds];
    const [movedId] = updatedIds.splice(sourceIdx, 1);
    updatedIds.splice(targetIdx, 0, movedId);

    const reordered = DashboardService.reorderWidgets(currentDashboard.id, updatedIds);
    if (reordered) {
      setDashboards(DashboardService.getDashboards());
    }
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // Filter Actions: Update, Add, Remove, Clear with reactive widget re-querying
  const handleUpdateFilter = (
    filterId: string,
    value: any,
    dateFrom?: string,
    dateTo?: string
  ) => {
    if (!currentDashboard) return;
    const updatedFilters = currentDashboard.filters.map(f => {
      if (f.id === filterId) {
        return {
          ...f,
          currentValue: value,
          dateFrom: dateFrom !== undefined ? dateFrom : f.dateFrom,
          dateTo: dateTo !== undefined ? dateTo : f.dateTo
        };
      }
      return f;
    });

    const updated = {
      ...currentDashboard,
      filters: updatedFilters,
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(updated);
    setDashboards(DashboardService.getDashboards());

    // Debounce text/number inputs; trigger immediately for single_select and dates
    const targetFilter = currentDashboard.filters.find(f => f.id === filterId);
    if (targetFilter?.type === 'text' || targetFilter?.type === 'number') {
      if (filterDebounceTimerRef.current) {
        clearTimeout(filterDebounceTimerRef.current);
      }
      filterDebounceTimerRef.current = setTimeout(() => {
        handleRefreshAll(updated, updatedFilters);
      }, 350);
    } else {
      if (filterDebounceTimerRef.current) {
        clearTimeout(filterDebounceTimerRef.current);
      }
      handleRefreshAll(updated, updatedFilters);
    }
  };

  const handleAddFilter = (newFilter: DashboardFilter) => {
    if (!currentDashboard) return;
    const updatedFilters = [...currentDashboard.filters, newFilter];
    const updated = {
      ...currentDashboard,
      filters: updatedFilters,
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(updated);
    setDashboards(DashboardService.getDashboards());

    if (newFilter.currentValue && newFilter.currentValue !== 'ALL') {
      handleRefreshAll(updated, updatedFilters);
    }
  };

  const handleRemoveFilter = (filterId: string) => {
    if (!currentDashboard) return;
    const updatedFilters = currentDashboard.filters.filter(f => f.id !== filterId);
    const updated = {
      ...currentDashboard,
      filters: updatedFilters,
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(updated);
    setDashboards(DashboardService.getDashboards());
    handleRefreshAll(updated, updatedFilters);
  };

  const handleClearAllFilters = () => {
    if (!currentDashboard) return;
    const cleared = currentDashboard.filters.map(f => ({
      ...f,
      currentValue: f.type === 'single_select' ? 'ALL' : '',
      dateFrom: undefined,
      dateTo: undefined
    }));
    const updated = {
      ...currentDashboard,
      filters: cleared,
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(updated);
    setDashboards(DashboardService.getDashboards());
    handleRefreshAll(updated, cleared);
  };

  // Generate Insights Handler
  const handleGenerateInsights = async () => {
    if (!currentDashboard) return;
    setIsLoadingInsights(true);
    setIsInsightsOpen(true);

    try {
      const widgetSummaries = currentDashboard.widgets
        .filter(w => widgetResults.has(w.id) || w.cachedResult)
        .map(w => {
          const res = widgetResults.get(w.id) || w.cachedResult!;
          return {
            title: w.title,
            chartType: w.chartType,
            rowCount: res.rowCount,
            columns: res.columns.map(c => c.name),
            sampleMetrics: res.rows.slice(0, 3).reduce((acc: any, row, i) => {
              acc[`sample_row_${i + 1}`] = row;
              return acc;
            }, {})
          };
        });

      const res = await DatabaseApiClient.generateDashboardInsightsWithAi(
        currentDashboard.name,
        widgetSummaries
      );
      setInsights(res.insights || []);
    } catch (err) {
      console.error('Failed to generate insights:', err);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // If viewing the dashboard list
  if (!currentDashboardId || !currentDashboard) {
    return (
      <>
        <DashboardList
          dashboards={dashboards}
          onOpenDashboard={id => setCurrentDashboardId(id)}
          onCreateNew={handleCreateNew}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
          onOpenAiBuilder={() => setIsAiBuilderOpen(true)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onRename={handleRenameRequest}
        />

        {/* Starter Templates Modal */}
        <DashboardTemplatesModal
          isOpen={isTemplatesOpen}
          onClose={() => setIsTemplatesOpen(false)}
          discoveredTables={discoveredTables}
          onSelectTemplate={created => {
            setDashboards(DashboardService.getDashboards());
            setCurrentDashboardId(created.id);
          }}
        />

        {/* AI Builder Modal */}
        <DashboardAiBuilderModal
          isOpen={isAiBuilderOpen}
          onClose={() => setIsAiBuilderOpen(false)}
          onApplyPlan={created => {
            DashboardService.saveDashboard(created);
            setDashboards(DashboardService.getDashboards());
            setCurrentDashboardId(created.id);
          }}
          isConnected={isConnected}
        />

        {/* Duplicate Dashboard Custom Modal */}
        <PromptDialog
          isOpen={Boolean(dashboardToDuplicate)}
          title="Duplicate Dashboard"
          message="Enter a name for the duplicated dashboard."
          initialValue={dashboardToDuplicate ? `${dashboardToDuplicate.name} (Copy)` : ''}
          placeholder="Enter dashboard name..."
          confirmText="Duplicate Dashboard"
          cancelText="Cancel"
          confirmVariant="primary"
          icon={<Copy className="w-4 h-4" />}
          onConfirm={handleConfirmDuplicate}
          onCancel={() => setDashboardToDuplicate(null)}
        />

        {/* Rename Dashboard Custom Modal */}
        <PromptDialog
          isOpen={Boolean(dashboardToRename)}
          title="Rename Dashboard"
          message="Enter a new name for this dashboard."
          initialValue={dashboardToRename?.name || ''}
          placeholder="Enter new dashboard name..."
          confirmText="Rename Dashboard"
          cancelText="Cancel"
          confirmVariant="primary"
          icon={<Edit3 className="w-4 h-4" />}
          onConfirm={handleConfirmRename}
          onCancel={() => setDashboardToRename(null)}
        />

        {/* Delete Dashboard Confirmation Dialog */}
        <ConfirmDialog
          isOpen={Boolean(dashboardToDelete)}
          title="Delete Dashboard"
          message={
            dashboardToDelete?.name && dashboardToDelete.name !== 'this dashboard'
              ? `Are you sure you want to delete '${dashboardToDelete.name}'?`
              : 'Are you sure you want to delete this dashboard?'
          }
          itemName={dashboardToDelete?.name}
          itemDetails="This will permanently delete this dashboard and all of its configured widgets and filters."
          confirmText="Delete Dashboard"
          cancelText="Cancel"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDashboardToDelete(null)}
        />
      </>
    );
  }

  // Active Dashboard Canvas View
  return (
    <div
      ref={canvasRef}
      className={`flex-1 flex flex-col h-full bg-slate-950 overflow-hidden print:overflow-visible print:h-auto print:bg-white print:block ${
        isPresentationMode ? 'fixed inset-0 z-50 p-4 bg-slate-950' : ''
      }`}
    >
      {/* Canvas Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 select-none flex-shrink-0 print:bg-white print:border-none print:px-0 print:py-4">
        {/* Left: Back button & Title */}
        <div className="flex items-center space-x-3 min-w-0">
          {!isPresentationMode && (
            <button
              type="button"
              onClick={() => setCurrentDashboardId(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors print:hidden"
              title="Back to All Dashboards"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 group">
                <h2 className="text-sm font-bold text-white tracking-tight truncate print:text-black print:text-xl">
                  {currentDashboard.name}
                </h2>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60 print:hidden">
                  {currentDashboard.widgets.length} {currentDashboard.widgets.length === 1 ? 'widget' : 'widgets'}
                </span>
                {!isPresentationMode && (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity print:hidden"
                    title="Edit dashboard title"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {isEditingDesc ? (
              <div className="flex items-center space-x-1 mt-0.5 print:hidden">
                <input
                  type="text"
                  value={descInput}
                  onChange={e => setDescInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveDesc();
                    if (e.key === 'Escape') setIsEditingDesc(false);
                  }}
                  autoFocus
                  placeholder="Add a description..."
                  className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 w-64"
                />
                <button
                  type="button"
                  onClick={handleSaveDesc}
                  className="p-0.5 text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(false)}
                  className="p-0.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <p
                onClick={() => !isPresentationMode && setIsEditingDesc(true)}
                className="text-xs text-slate-400 truncate cursor-pointer hover:text-slate-300 transition-colors print:text-slate-600 print:text-sm"
                title="Click to edit description"
              >
                {currentDashboard.description || 'Add an executive summary or description...'}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 print:hidden">
          {/* Snapshot Badge */}
          {isSnapshotMode ? (
            <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Snapshot — data not live</span>
            </span>
          ) : lastRefreshedAt ? (
            <span className="hidden md:flex items-center space-x-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>Updated at {lastRefreshedAt}</span>
            </span>
          ) : null}

          {/* Refresh Dashboard Button */}
          <button
            type="button"
            onClick={() => handleRefreshAll()}
            disabled={isRefreshingAll || isSnapshotMode}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700/60 transition-colors"
            title="Refresh all queries across this dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isRefreshingAll ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Auto Refresh Dropdown */}
          <select
            value={autoRefreshInterval}
            disabled={isSnapshotMode}
            onChange={e => {
              const val = Number(e.target.value);
              setAutoRefreshInterval(val);
              DashboardService.setAutoRefresh(currentDashboard.id, val);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            title="Auto-refresh interval"
          >
            <option value={0}>Auto-refresh: Off</option>
            <option value={30}>Every 30 sec</option>
            <option value={60}>Every 1 min</option>
            <option value={300}>Every 5 min</option>
            <option value={900}>Every 15 min</option>
            <option value={1800}>Every 30 min</option>
          </select>

          {/* Snapshot Toggle */}
          <button
            type="button"
            onClick={() => setIsSnapshotMode(prev => !prev)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isSnapshotMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white'
            }`}
            title={isSnapshotMode ? 'Resume live query updates' : 'Freeze as snapshot'}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Insights Button */}
          <button
            type="button"
            onClick={handleGenerateInsights}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 hover:text-white rounded-lg text-xs font-medium border border-indigo-800/60 transition-colors"
            title="Derive factual cross-widget insights"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Insights</span>
          </button>

          {/* Export Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700/60 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-30 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    DashboardExportService.printDashboardAsPdf();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>Print as PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    DashboardExportService.exportAllWidgetsCsv(currentDashboard, widgetResults);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Data (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    DashboardExportService.exportDashboardJson(currentDashboard);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center space-x-2 border-t border-slate-800"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Export Config (JSON)</span>
                </button>
              </div>
            )}
          </div>

          {/* Presentation Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsPresentationMode(prev => !prev)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700/60 transition-colors"
            title={isPresentationMode ? 'Exit Present Mode (Esc)' : 'Present Dashboard'}
          >
            {isPresentationMode ? (
              <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Add Widget Button */}
          {!isPresentationMode && (
            <button
              type="button"
              onClick={() => setIsAddWidgetOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-lg shadow-emerald-950"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Widget</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <DashboardFilterBar
        filters={currentDashboard.filters}
        onUpdateFilter={handleUpdateFilter}
        onAddFilter={handleAddFilter}
        onRemoveFilter={handleRemoveFilter}
        onClearAllFilters={handleClearAllFilters}
        crossFilterActive={crossFilter}
        onClearCrossFilter={() => setCrossFilter(null)}
      />

      {/* Responsive Widget Grid Canvas */}
      <div className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0 print:h-auto print:block">
        {currentDashboard.widgets.length === 0 ? (
          <div className="h-full border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">This Dashboard is Empty</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Add widgets from your queries, build with AI, or launch a starter template.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsAddWidgetOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                Add First Widget
              </button>
              <button
                type="button"
                onClick={() => setIsAiBuilderOpen(true)}
                className="px-4 py-2 bg-purple-950/60 hover:bg-purple-900 text-purple-200 rounded-xl text-xs font-medium border border-purple-800/60 transition-colors"
              >
                Build with AI
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-5 auto-rows-min">
            {currentDashboard.widgets.map(widget => {
              const widgetRes = widgetResults.get(widget.id);

              // Calculate filter compatibility for active filters
              let compInfo: FilterCompatibilityInfo | null = null;
              const activeFilters = currentDashboard.filters.filter(f =>
                f.type === 'date_range'
                  ? Boolean(f.dateFrom || f.dateTo)
                  : f.currentValue !== undefined && f.currentValue !== null && f.currentValue !== '' && f.currentValue !== 'ALL'
              );
              if (activeFilters.length > 0) {
                const firstActive = activeFilters[0];
                const comp = DashboardFilterEngine.checkCompatibility(
                  firstActive,
                  widget,
                  widgetRes?.columns
                );
                compInfo = {
                  isCompatible: comp.isCompatible,
                  filterLabel: firstActive.label,
                  columnName: comp.columnName,
                  reason: comp.reason
                };
              }

              return (
                <DashboardWidgetCard
                  key={widget.id}
                  widget={widget}
                  result={widgetRes}
                  isLoading={refreshingWidgets.has(widget.id) || isRefreshingAll}
                  isDragging={draggedWidgetId === widget.id}
                  isDraggedOver={dragOverWidgetId === widget.id && draggedWidgetId !== widget.id}
                  onRefreshWidget={handleRefreshWidget}
                  onRemoveWidget={handleRemoveWidget}
                  onResizeWidget={handleResizeWidget}
                  onResizeCustom={handleResizeCustom}
                  onDuplicateWidget={handleDuplicateWidget}
                  onUpdateTitle={handleUpdateWidgetTitle}
                  onMoveWidget={handleMoveWidget}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  filterCompatibility={compInfo}
                  onEditQuery={sql => onNavigateToSqlEditor(sql)}
                  onRepairWidget={() => onNavigateToSqlEditor(widget.queryRef.sql)}
                  onCrossFilter={(col, val) => setCrossFilter({ column: col, value: val })}
                  isPresentationMode={isPresentationMode}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      <AddToDashboardModal
        isOpen={isAddWidgetOpen}
        onClose={() => setIsAddWidgetOpen(false)}
        query={
          discoveredTables.length > 0
            ? `SELECT * FROM "${discoveredTables[0].schema}"."${discoveredTables[0].name}" LIMIT 50;`
            : 'SELECT 1 AS metric;'
        }
        sourceTable={discoveredTables[0]?.name}
        defaultTitle="New Dashboard Widget"
        onSuccess={() => {
          setDashboards(DashboardService.getDashboards());
        }}
      />

      {/* Starter Templates Modal */}
      <DashboardTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        discoveredTables={discoveredTables}
        onSelectTemplate={created => {
          setDashboards(DashboardService.getDashboards());
          setCurrentDashboardId(created.id);
        }}
      />

      {/* AI Builder Modal */}
      <DashboardAiBuilderModal
        isOpen={isAiBuilderOpen}
        onClose={() => setIsAiBuilderOpen(false)}
        onApplyPlan={created => {
          DashboardService.saveDashboard(created);
          setDashboards(DashboardService.getDashboards());
          setCurrentDashboardId(created.id);
        }}
        isConnected={isConnected}
      />

      {/* Insights Drawer */}
      <DashboardInsightsDrawer
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
        insights={insights}
        isLoading={isLoadingInsights}
        onRefresh={handleGenerateInsights}
      />

      {/* Delete Dashboard Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(dashboardToDelete)}
        title="Delete Dashboard"
        message={
          dashboardToDelete?.name && dashboardToDelete.name !== 'this dashboard'
            ? `Are you sure you want to delete '${dashboardToDelete.name}'?`
            : 'Are you sure you want to delete this dashboard?'
        }
        itemName={dashboardToDelete?.name}
        itemDetails="This will permanently delete this dashboard and all of its configured widgets and filters."
        confirmText="Delete Dashboard"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDashboardToDelete(null)}
      />

      {/* Duplicate Dashboard Custom Modal */}
      <PromptDialog
        isOpen={Boolean(dashboardToDuplicate)}
        title="Duplicate Dashboard"
        message="Enter a name for the duplicated dashboard."
        initialValue={dashboardToDuplicate ? `${dashboardToDuplicate.name} (Copy)` : ''}
        placeholder="Enter dashboard name..."
        confirmText="Duplicate Dashboard"
        cancelText="Cancel"
        confirmVariant="primary"
        icon={<Copy className="w-4 h-4" />}
        onConfirm={handleConfirmDuplicate}
        onCancel={() => setDashboardToDuplicate(null)}
      />

      {/* Rename Dashboard Custom Modal */}
      <PromptDialog
        isOpen={Boolean(dashboardToRename)}
        title="Rename Dashboard"
        message="Enter a new name for this dashboard."
        initialValue={dashboardToRename?.name || ''}
        placeholder="Enter new dashboard name..."
        confirmText="Rename Dashboard"
        cancelText="Cancel"
        confirmVariant="primary"
        icon={<Edit3 className="w-4 h-4" />}
        onConfirm={handleConfirmRename}
        onCancel={() => setDashboardToRename(null)}
      />
    </div>
  );
};
