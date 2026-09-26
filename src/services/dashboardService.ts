import { Dashboard, DashboardWidget, DashboardFilter } from '../types/dashboard';

const DASHBOARDS_STORAGE_KEY = 'datapilot_saved_dashboards';
const LAST_OPENED_KEY = 'datapilot_last_opened_dashboard_id';

export class DashboardService {
  private static workspaceId: string = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_workspace_id')) || 'ws_primary';
  private static projectId: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_project_id')) || null;
  private static memoryStorage = new Map<string, string>();

  private static getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        return this.memoryStorage.get(key) || null;
      }
    }
    return this.memoryStorage.get(key) || null;
  }

  private static setItem(key: string, val: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, val);
        return;
      } catch {}
    }
    this.memoryStorage.set(key, val);
  }

  private static removeItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
        return;
      } catch {}
    }
    this.memoryStorage.delete(key);
  }

  public static setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  public static getWorkspaceId(): string {
    return this.workspaceId;
  }

  public static setProjectId(id: string | null) {
    this.projectId = id && id.trim() && id !== 'null' && id !== 'undefined' ? id.trim() : null;
  }

  public static getProjectId(): string | null {
    return this.projectId;
  }

  private static getStorageKey(): string {
    return `${DASHBOARDS_STORAGE_KEY}_${this.workspaceId}${this.projectId ? `_${this.projectId}` : ''}`;
  }

  private static getLastOpenedKey(): string {
    return `${LAST_OPENED_KEY}_${this.workspaceId}${this.projectId ? `_${this.projectId}` : ''}`;
  }

  /**
   * Retrieves all saved dashboards from localStorage
   */
  public static getDashboards(): Dashboard[] {
    try {
      let raw = this.getItem(this.getStorageKey());
      // Backward compatibility for primary workspace without project
      if (!raw && this.workspaceId === 'ws_primary' && !this.projectId) {
        raw = this.getItem(DASHBOARDS_STORAGE_KEY);
      }
      if (!raw) return [];
      const parsed: Dashboard[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a single dashboard by ID
   */
  public static getDashboardById(id: string): Dashboard | null {
    const list = this.getDashboards();
    return list.find(d => d.id === id) || null;
  }

  /**
   * Saves or updates a dashboard
   */
  public static saveDashboard(dashboard: Dashboard): Dashboard {
    const list = this.getDashboards();
    const now = new Date().toISOString();
    const updated: Dashboard = {
      ...dashboard,
      projectId: dashboard.projectId || (this.projectId ? this.projectId : undefined),
      updatedAt: now
    };

    const index = list.findIndex(d => d.id === dashboard.id);
    let newList: Dashboard[];
    if (index >= 0) {
      newList = [...list];
      newList[index] = updated;
    } else {
      newList = [updated, ...list];
    }

    try {
      this.setItem(this.getStorageKey(), JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to persist dashboards:', e);
    }
    return updated;
  }

  /**
   * Creates a new empty dashboard
   */
  public static createDashboard(name: string, description = ''): Dashboard {
    const now = new Date().toISOString();
    const newDashboard: Dashboard = {
      id: `dash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || 'Untitled Dashboard',
      description: description.trim(),
      widgets: [],
      filters: [],
      layout: {
        columns: 12,
        gap: 'md',
        theme: 'dark'
      },
      createdAt: now,
      updatedAt: now,
      permissions: {
        role: 'owner'
      },
      autoRefreshInterval: 0
    };

    return this.saveDashboard(newDashboard);
  }

  /**
   * Duplicates an existing dashboard
   */
  public static duplicateDashboard(id: string): Dashboard | null {
    const original = this.getDashboardById(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const duplicated: Dashboard = {
      ...original,
      id: `dash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      // Deep clone widgets with new IDs
      widgets: original.widgets.map((w, idx) => ({
        ...w,
        id: `widget-${Date.now()}-${idx}`
      })),
      isSnapshot: false,
      snapshotDate: undefined
    };

    return this.saveDashboard(duplicated);
  }

  /**
   * Deletes a dashboard
   */
  public static deleteDashboard(id: string): boolean {
    const list = this.getDashboards();
    const filtered = list.filter(d => d.id !== id);
    if (filtered.length === list.length) return false;

    try {
      this.setItem(this.getStorageKey(), JSON.stringify(filtered));
      if (this.getLastOpenedDashboardId() === id) {
        this.removeItem(this.getLastOpenedKey());
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Renames a dashboard
   */
  public static renameDashboard(id: string, name: string, description?: string): Dashboard | null {
    const d = this.getDashboardById(id);
    if (!d) return null;
    d.name = name.trim();
    if (description !== undefined) d.description = description.trim();
    return this.saveDashboard(d);
  }

  /**
   * Adds a widget to a dashboard
   */
  public static addWidget(
    dashboardId: string,
    widgetData: Omit<DashboardWidget, 'id' | 'position'>
  ): { dashboard: Dashboard; widget: DashboardWidget } | null {
    const d = this.getDashboardById(dashboardId);
    if (!d) return null;

    const newWidget: DashboardWidget = {
      ...widgetData,
      id: `widget-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      position: {
        order: d.widgets.length,
        col: 0,
        row: d.widgets.length
      }
    };

    d.widgets.push(newWidget);
    const updated = this.saveDashboard(d);
    return { dashboard: updated, widget: newWidget };
  }

  /**
   * Duplicates a widget within a dashboard
   */
  public static duplicateWidget(
    dashboardId: string,
    widgetId: string
  ): { dashboard: Dashboard; widget: DashboardWidget } | null {
    const d = this.getDashboardById(dashboardId);
    if (!d) return null;

    const originalIdx = d.widgets.findIndex(w => w.id === widgetId);
    if (originalIdx < 0) return null;
    const original = d.widgets[originalIdx];

    const newWidgetId = `widget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duplicated: DashboardWidget = {
      ...JSON.parse(JSON.stringify(original)),
      id: newWidgetId,
      title: `${original.title} (Copy)`,
      position: {
        ...original.position,
        order: original.position.order + 1
      }
    };

    // Insert directly after the original widget
    d.widgets.splice(originalIdx + 1, 0, duplicated);

    // Re-index all orders
    d.widgets.forEach((w, idx) => {
      w.position = { ...w.position, order: idx };
    });

    const updated = this.saveDashboard(d);
    return { dashboard: updated, widget: duplicated };
  }

  /**
   * Reorders widgets according to the specified array of widget IDs
   */
  public static reorderWidgets(dashboardId: string, widgetIds: string[]): Dashboard | null {
    const d = this.getDashboardById(dashboardId);
    if (!d) return null;

    const widgetMap = new Map(d.widgets.map(w => [w.id, w]));
    const reordered: DashboardWidget[] = [];

    widgetIds.forEach((id, idx) => {
      const w = widgetMap.get(id);
      if (w) {
        w.position = { ...w.position, order: idx };
        reordered.push(w);
      }
    });

    // Add any remaining widgets
    d.widgets.forEach(w => {
      if (!widgetIds.includes(w.id)) {
        w.position = { ...w.position, order: reordered.length };
        reordered.push(w);
      }
    });

    d.widgets = reordered;
    return this.saveDashboard(d);
  }

  /**
   * Removes a widget from a dashboard
   */
  public static removeWidget(dashboardId: string, widgetId: string): Dashboard | null {
    const d = this.getDashboardById(dashboardId);
    if (!d) return null;

    d.widgets = d.widgets.filter(w => w.id !== widgetId);
    // Reorder remaining
    d.widgets.forEach((w, idx) => {
      w.position.order = idx;
    });

    return this.saveDashboard(d);
  }

  /**
   * Updates a single widget within a dashboard
   */
  public static updateWidget(
    dashboardId: string,
    widgetOrId: DashboardWidget | string,
    partial?: Partial<DashboardWidget>
  ): Dashboard | null {
    const d = this.getDashboardById(dashboardId);
    if (!d) return null;

    if (typeof widgetOrId === 'string') {
      const idx = d.widgets.findIndex(w => w.id === widgetOrId);
      if (idx < 0) return null;
      d.widgets[idx] = { ...d.widgets[idx], ...(partial || {}) };
    } else {
      const idx = d.widgets.findIndex(w => w.id === widgetOrId.id);
      if (idx < 0) return null;
      d.widgets[idx] = { ...widgetOrId };
    }

    return this.saveDashboard(d);
  }

  /**
   * Configures auto-refresh interval for a dashboard
   */
  public static setAutoRefresh(id: string, interval: number): Dashboard | null {
    const d = this.getDashboardById(id);
    if (!d) return null;
    d.autoRefreshInterval = interval;
    return this.saveDashboard(d);
  }

  public static getLastOpenedDashboardId(): string | null {
    return this.getItem(this.getLastOpenedKey()) || this.getItem(LAST_OPENED_KEY);
  }

  public static setLastOpenedDashboardId(id: string): void {
    this.setItem(this.getLastOpenedKey(), id);
  }
}
