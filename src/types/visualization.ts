import { QueryResult } from './database';

export type ChartType =
  | 'table'
  | 'kpi'
  | 'bar'
  | 'horizontal_bar'
  | 'grouped_bar'
  | 'stacked_bar'
  | 'percent_bar'
  | 'line'
  | 'area'
  | 'stacked_area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'histogram'
  | 'composed'
  | 'radar'
  | 'radial_bar'
  | 'funnel'
  | 'treemap'
  // Extensible for future visualization additions:
  | 'heatmap'
  | 'box_plot'
  | 'map';

export type ColumnSemanticType =
  | 'text'
  | 'integer'
  | 'numeric'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'unknown';

export interface DetectedColumn {
  name: string;
  dataType: string;
  semanticType: ColumnSemanticType;
  isNumeric: boolean;
  isDateOrTime: boolean;
  isCategorical: boolean;
  isBoolean: boolean;
  isNullable: boolean;
  distinctCount: number;
  nullCount: number;
  sampleValues: unknown[];
  min?: number | string | null;
  max?: number | string | null;
}

export interface ChartRecommendation {
  chartType: ChartType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  xAxis?: string;
  yAxis?: string;
  secondaryMeasures?: string[];
  seriesGroup?: string;
  title?: string;
  warning?: string;
}

export type AggregationType =
  | 'none'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'count_distinct'
  | 'median';
export type ChartAggregation = AggregationType;
export type SortOrder = 'none' | 'asc' | 'desc';
export type ChartLimit = 'all' | 5 | 10 | 20 | 50 | 100;

export interface ChartConfig {
  chartType: ChartType;
  xAxis: string;
  yAxis: string; // primary numeric measure
  secondaryMeasures: string[]; // additional measures for multi-series
  seriesGroup?: string; // categorical dimension for breakdown/color
  aggregation: AggregationType;
  sortOrder: SortOrder;
  sortBy: 'x' | 'y';
  limit: ChartLimit;
  title: string;
  subtitle?: string;
  showLegend: boolean;
  showDataLabels: boolean;
  showGrid: boolean;
  showTooltip?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  binCount: number; // For histogram: 10, 20, 30, 50
  treatNullAsZero: boolean;
  samplingEnabled?: boolean;
  numberFormat?: 'standard' | 'compact' | 'currency' | 'percent';
  currencySymbol?: string;
  decimalPrecision?: number;
  dateFormat?: string;
}

export interface SavedVisualization {
  id: string;
  name: string;
  chartType: ChartType;
  sourceQueryId?: string;
  querySql?: string;
  dimensions: string[];
  measures: string[];
  config: ChartConfig;
  createdAt: string;
}

export interface VisualizationInsight {
  title: string;
  type: 'trend' | 'extreme' | 'distribution' | 'summary';
  text: string;
  evidence?: string;
}

export interface AiChartRecommendationResult {
  chartType: ChartType;
  xAxis: string;
  yAxis: string;
  secondaryMeasures?: string[];
  seriesGroup?: string;
  reason: string;
  suggestedTitle: string;
}

export interface ChartValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
