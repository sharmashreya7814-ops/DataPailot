import { ChartConfig, ChartType } from './visualization';
import { QueryResult } from './database';

export type FilterType =
  | 'text'
  | 'number'
  | 'date'
  | 'date_range'
  | 'single_select'
  | 'multi_select';

export interface DashboardFilter {
  id: string;
  label: string;
  type: FilterType;
  targetColumn: string;
  targetTable?: string;
  currentValue: any;
  options?: string[]; // for select filters
  dateFrom?: string; // for date_range
  dateTo?: string;   // for date_range
}

export interface WidgetQueryReference {
  type: 'raw_sql' | 'analysis_operation';
  sql: string;
  sourceTable?: string;
  referencedTables?: string[];
  referencedColumns?: string[];
  analysisId?: string;
  datasetId?: string;
}

export type WidgetPreset = 'small' | 'medium' | 'large' | 'full' | 'reset';
export type WidgetColSpan = 3 | 4 | 6 | 8 | 9 | 12;

export interface WidgetSize {
  colSpan: WidgetColSpan; // 12-column grid layout (3: Small, 6: Medium, 9: Large, 12: Full Width)
  height?: number; // pixel height, e.g. 280, 340, 420
  preset?: WidgetPreset;
}

export interface WidgetPosition {
  order: number;
  row?: number;
  col?: number;
}

export interface DashboardWidget {
  id: string;
  title: string;
  description?: string;
  chartType: ChartType;
  queryRef: WidgetQueryReference;
  chartConfig: ChartConfig;
  size: WidgetSize;
  position: WidgetPosition;
  status?: 'idle' | 'loading' | 'success' | 'error' | 'schema_changed';
  errorMessage?: string;
  schemaChangeDetails?: {
    missingTable?: string;
    missingColumn?: string;
    description?: string;
  };
  lastExecutedAt?: string;
  cachedResult?: QueryResult; // used for snapshot mode & instant render
}

export interface DashboardLayout {
  columns: 12;
  gap: 'sm' | 'md' | 'lg';
  theme?: 'dark';
}

export interface DashboardPermission {
  role: 'owner' | 'editor' | 'viewer';
  ownerId?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  title?: string;
  description?: string;
  workspaceId?: string;
  projectId?: string | null;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  layout: DashboardLayout;
  createdAt: string;
  updatedAt: string;
  permissions?: DashboardPermission;
  autoRefreshInterval: number; // in seconds: 0, 300 (5m), 900 (15m), 1800 (30m), 3600 (60m)
  isSnapshot?: boolean;
  snapshotDate?: string;
}

export interface DashboardTemplate {
  id: 'sales' | 'customer' | 'product' | 'operations';
  name: string;
  description: string;
  suggestedWidgets: {
    title: string;
    description: string;
    chartType: ChartType;
    requiredRole: string; // e.g. "Revenue measure", "Order date", "Customer identifier"
  }[];
}

export interface DashboardInsightItem {
  id: string;
  title: string;
  text: string;
  type: 'trend' | 'outlier' | 'benchmark' | 'metric';
  widgetSourceTitle?: string;
  evidence?: string;
}
