import React from 'react';
import {
  BarChart2,
  BarChartHorizontal,
  LineChart,
  PieChart,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
  Activity,
  Layers,
  Settings2,
  Sliders,
  Sparkles,
  Info,
  Grid,
  TrendingUp,
  Percent,
  Compass
} from 'lucide-react';
import {
  ChartConfig,
  ChartType,
  DetectedColumn,
  ChartValidationResult,
  ChartLimit,
  SortOrder,
  ChartAggregation
} from '../../types/visualization';
import { ChartRecommender } from '../../services/chartRecommender';

interface ChartConfigPanelProps {
  config: ChartConfig;
  onChangeConfig: (newConfig: ChartConfig) => void;
  columns: DetectedColumn[];
  validation: ChartValidationResult;
  onAskAiForChart?: () => void;
  isAiLoading?: boolean;
}

const CORE_CHART_TYPES: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'bar', label: 'Bar Chart', icon: BarChart2 },
  { type: 'horizontal_bar', label: 'Horizontal Bar', icon: BarChartHorizontal },
  { type: 'grouped_bar', label: 'Grouped Bar', icon: BarChart2 },
  { type: 'stacked_bar', label: 'Stacked Bar', icon: BarChart2 },
  { type: 'percent_bar', label: '100% Stacked', icon: Percent },
  { type: 'line', label: 'Line Chart', icon: LineChart },
  { type: 'area', label: 'Area Chart', icon: Layers },
  { type: 'stacked_area', label: 'Stacked Area', icon: Layers },
  { type: 'pie', label: 'Pie Chart', icon: PieChart },
  { type: 'donut', label: 'Donut Chart', icon: PieChart },
  { type: 'scatter', label: 'Scatter Plot', icon: ScatterIcon }
];

const ANALYTICAL_CHART_TYPES: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'composed', label: 'Composed Chart', icon: Layers },
  { type: 'radar', label: 'Radar Chart', icon: Compass },
  { type: 'radial_bar', label: 'Radial Bar', icon: Activity },
  { type: 'funnel', label: 'Funnel Chart', icon: Sliders },
  { type: 'treemap', label: 'Treemap', icon: Grid },
  { type: 'histogram', label: 'Histogram', icon: BarChart2 },
  { type: 'kpi', label: 'KPI Card', icon: TrendingUp },
  { type: 'table', label: 'Data Table', icon: TableIcon }
];

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({
  config,
  onChangeConfig,
  columns,
  validation,
  onAskAiForChart,
  isAiLoading = false
}) => {
  const numericColumns = columns.filter(c => c.isNumeric);
  const categoricalColumns = columns.filter(c => !c.isNumeric || c.isDateOrTime);

  const recommendations = React.useMemo(() => {
    return ChartRecommender.getRecommendations(columns, columns[0]?.sampleValues?.length || 10);
  }, [columns]);

  const recommendedMap = React.useMemo(() => {
    const map = new Map<string, string>();
    recommendations.forEach(r => map.set(r.chartType, r.reason));
    return map;
  }, [recommendations]);

  const isCount = config.aggregation === 'count' || config.aggregation === 'count_distinct';
  const isSumOrAvg = config.aggregation === 'sum' || config.aggregation === 'avg' || config.aggregation === 'median';
  const isMinOrMax = config.aggregation === 'min' || config.aggregation === 'max';

  // Filter selectable measure columns based on active aggregation
  const selectableMeasureColumns = React.useMemo(() => {
    if (config.chartType === 'scatter') {
      return columns.filter(c => c.isNumeric);
    }
    if (isCount) {
      // COUNT is valid for ALL column types: text, date, numeric, boolean
      return columns;
    }
    if (isSumOrAvg) {
      // SUM, AVG, MEDIAN strictly require numeric columns
      return columns.filter(c => c.isNumeric);
    }
    if (isMinOrMax) {
      // MIN and MAX support numeric and date columns
      return columns.filter(c => c.isNumeric || c.isDateOrTime);
    }
    return columns;
  }, [columns, config.chartType, isCount, isSumOrAvg, isMinOrMax]);

  const handleAggregationChange = (newAgg: ChartAggregation) => {
    let nextY = config.yAxis;
    if (newAgg === 'sum' || newAgg === 'avg' || newAgg === 'median') {
      const currentCol = columns.find(c => c.name === config.yAxis);
      if (config.yAxis === 'All Rows' || !currentCol || !currentCol.isNumeric) {
        nextY = numericColumns[0]?.name || '';
      }
    } else if (newAgg === 'min' || newAgg === 'max') {
      const currentCol = columns.find(c => c.name === config.yAxis);
      if (config.yAxis === 'All Rows' || !currentCol || (!currentCol.isNumeric && !currentCol.isDateOrTime)) {
        nextY = columns.find(c => c.isNumeric || c.isDateOrTime)?.name || '';
      }
    }
    onChangeConfig({ ...config, aggregation: newAgg, yAxis: nextY });
  };

  const handleTypeSelect = (type: ChartType) => {
    const updated = { ...config, chartType: type };
    // If switching to KPI, set yAxis to first numeric if not set
    if (type === 'kpi' && (!config.yAxis || !numericColumns.some(c => c.name === config.yAxis))) {
      updated.yAxis = isCount ? (config.yAxis || 'All Rows') : (numericColumns[0]?.name || '');
    }
    // If switching to Histogram, set xAxis/yAxis to numeric
    if (type === 'histogram' && (!config.xAxis || !numericColumns.some(c => c.name === config.xAxis))) {
      updated.xAxis = numericColumns[0]?.name || '';
      updated.yAxis = numericColumns[0]?.name || '';
    }
    onChangeConfig(updated);
  };

  const handleSecondaryMeasureToggle = (colName: string) => {
    const current = config.secondaryMeasures || [];
    const exists = current.includes(colName);
    const updated = exists ? current.filter(c => c !== colName) : [...current, colName];
    onChangeConfig({ ...config, secondaryMeasures: updated });
  };

  const isMultiSeriesSupported =
    config.chartType === 'bar' ||
    config.chartType === 'horizontal_bar' ||
    config.chartType === 'grouped_bar' ||
    config.chartType === 'stacked_bar' ||
    config.chartType === 'percent_bar' ||
    config.chartType === 'line' ||
    config.chartType === 'area' ||
    config.chartType === 'stacked_area' ||
    config.chartType === 'composed' ||
    config.chartType === 'radar';

  return (
    <div id="chart-config-panel" className="w-80 flex flex-col h-full bg-slate-900 border-r border-slate-800 text-xs overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-2 font-semibold text-slate-200">
          <Settings2 className="w-4 h-4 text-indigo-400" />
          <span>Chart Configuration</span>
        </div>

        {onAskAiForChart && (
          <button
            id="btn-ask-ai-chart"
            onClick={onAskAiForChart}
            disabled={isAiLoading}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium transition-colors"
            title="Ask AI to recommend optimal chart and mapping"
          >
            <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
            <span>{isAiLoading ? 'Analyzing...' : 'Ask AI'}</span>
          </button>
        )}
      </div>

      {/* Validation Banner if any */}
      {!validation.isValid && validation.errors.length > 0 && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
          {validation.errors.map((err, idx) => (
            <div key={idx} className="flex items-start space-x-1.5">
              <span className="text-rose-400">•</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
          {validation.warnings.map((warn, idx) => (
            <div key={idx} className="flex items-start space-x-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* 1. Core Chart Types */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Core Visualizations
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {CORE_CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              const isSelected = config.chartType === ct.type;
              const isRecommended = recommendedMap.has(ct.type);
              const recReason = recommendedMap.get(ct.type);
              return (
                <button
                  key={ct.type}
                  id={`chart-type-${ct.type}`}
                  onClick={() => handleTypeSelect(ct.type)}
                  title={isRecommended ? `Recommended: ${recReason}` : undefined}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all relative cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-xs'
                      : 'bg-slate-850/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate text-[11px]">{ct.label}</span>
                  </div>
                  {isRecommended && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Recommended for this dataset" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Analytical Chart Types */}
        <div className="pt-2 border-t border-slate-800/80">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Analytical & Specialized
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {ANALYTICAL_CHART_TYPES.map(ct => {
              const Icon = ct.icon;
              const isSelected = config.chartType === ct.type;
              const isRecommended = recommendedMap.has(ct.type);
              const recReason = recommendedMap.get(ct.type);
              return (
                <button
                  key={ct.type}
                  id={`chart-type-${ct.type}`}
                  onClick={() => handleTypeSelect(ct.type)}
                  title={isRecommended ? `Recommended: ${recReason}` : undefined}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-xs'
                      : 'bg-slate-850/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate text-[11px]">{ct.label}</span>
                  </div>
                  {isRecommended && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Recommended for this dataset" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {config.chartType !== 'table' && (
          <>
            {/* 3. Dimensions & Measures Axis Mapping */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Field Mappings
                </label>
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* X Axis (Dimension/Category) */}
              {config.chartType !== 'kpi' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">
                    {config.chartType === 'scatter'
                      ? 'X Axis (Numeric)'
                      : config.chartType === 'histogram'
                      ? 'Numeric Column (Distribution)'
                      : config.chartType === 'funnel'
                      ? 'Stage / Step Column'
                      : 'X Axis (Category / Date)'}
                  </label>
                  <select
                    id="select-chart-x-axis"
                    value={config.xAxis}
                    onChange={e => onChangeConfig({ ...config, xAxis: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="">— Select Column —</option>
                    {columns.map(col => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.semanticType})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Y Axis (Primary Measure / Count Target) */}
              {config.chartType !== 'histogram' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-400 text-[11px]">
                      {config.chartType === 'scatter'
                        ? 'Y Axis (Numeric)'
                        : config.chartType === 'kpi'
                        ? (isCount ? 'KPI Metric (Count Target / All Rows)' : 'KPI Metric (Numeric)')
                        : isCount
                        ? 'Y Axis (Measure / Count Target)'
                        : 'Y Axis (Measure)'}
                    </label>
                  </div>
                  <select
                    id="select-chart-y-axis"
                    value={config.yAxis}
                    onChange={e => onChangeConfig({ ...config, yAxis: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="">— Select Measure or Count —</option>
                    <option value="All Rows">All Rows (*)</option>
                    {selectableMeasureColumns.map(col => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.semanticType})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Aggregation Method */}
              {config.chartType !== 'scatter' && config.chartType !== 'histogram' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Aggregation</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        { id: 'count', label: 'COUNT' },
                        { id: 'count_distinct', label: 'COUNT DIST' },
                        { id: 'sum', label: 'SUM' },
                        { id: 'avg', label: 'AVG' },
                        { id: 'min', label: 'MIN' },
                        { id: 'max', label: 'MAX' },
                        { id: 'median', label: 'MEDIAN' },
                        { id: 'none', label: 'NONE' }
                      ] as const
                    ).map(agg => (
                      <button
                        key={agg.id}
                        type="button"
                        id={`btn-agg-${agg.id}`}
                        onClick={() => handleAggregationChange(agg.id as ChartAggregation)}
                        className={`py-1 rounded text-center text-[10px] font-mono border transition-all cursor-pointer ${
                          config.aggregation === agg.id
                            ? 'bg-indigo-600 border-indigo-500 text-white font-semibold shadow-xs'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {agg.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Secondary Measures (Multi-Series) */}
              {isMultiSeriesSupported && numericColumns.length > 1 && (
                <div>
                  <label className="block text-slate-400 mb-1.5 text-[11px]">
                    Additional Series Measures
                  </label>
                  <div className="space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 max-h-32 overflow-y-auto">
                    {numericColumns
                      .filter(c => c.name !== config.yAxis)
                      .map(col => {
                        const isChecked = (config.secondaryMeasures || []).includes(col.name);
                        return (
                          <label
                            key={col.name}
                            className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSecondaryMeasureToggle(col.name)}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500/40 focus:ring-offset-0 focus:outline-hidden cursor-pointer accent-indigo-600"
                            />
                            <span className="truncate text-xs">{col.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Scatter Plot Optional Series Group */}
              {config.chartType === 'scatter' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">
                    Group / Color by (Optional)
                  </label>
                  <select
                    value={config.seriesGroup || ''}
                    onChange={e => onChangeConfig({ ...config, seriesGroup: e.target.value || undefined })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="">(None - Single Color)</option>
                    {categoricalColumns.map(col => (
                      <option key={col.name} value={col.name}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Histogram Bins */}
              {config.chartType === 'histogram' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Number of Bins</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[10, 20, 30, 50].map(b => (
                      <button
                        key={b}
                        onClick={() => onChangeConfig({ ...config, binCount: b })}
                        className={`py-1 rounded text-center font-mono border transition-all cursor-pointer ${
                          config.binCount === b
                            ? 'bg-indigo-600 border-indigo-500 text-white font-semibold shadow-xs'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Sorting & Limiting */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Sorting & Row Limits
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Sort Order</label>
                  <select
                    value={config.sortOrder}
                    onChange={e => onChangeConfig({ ...config, sortOrder: e.target.value as SortOrder })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="none">Default (None)</option>
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Limit Rows</label>
                  <select
                    value={config.limit}
                    onChange={e =>
                      onChangeConfig({
                        ...config,
                        limit: e.target.value === 'all' ? 'all' : (parseInt(e.target.value, 10) as ChartLimit)
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="all">All Returned</option>
                    <option value="5">Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="20">Top 20</option>
                    <option value="50">Top 50</option>
                    <option value="100">Top 100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 5. Axis Titles (Phase 4) */}
            {config.chartType !== 'kpi' && config.chartType !== 'pie' && config.chartType !== 'donut' && config.chartType !== 'treemap' && (
              <div className="space-y-2 pt-3 border-t border-slate-800/80">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Axis Titles
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">X Axis Title</label>
                    <input
                      type="text"
                      value={config.xAxisLabel || ''}
                      onChange={e => onChangeConfig({ ...config, xAxisLabel: e.target.value })}
                      placeholder="e.g. Month"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">Y Axis Title</label>
                    <input
                      type="text"
                      value={config.yAxisLabel || ''}
                      onChange={e => onChangeConfig({ ...config, yAxisLabel: e.target.value })}
                      placeholder="e.g. Revenue ($)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 6. Number & Measure Formatting (Phase 4) */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Number & Metric Formatting
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 text-[10px]">Format Style</label>
                  <select
                    value={config.numberFormat || 'standard'}
                    onChange={e => onChangeConfig({ ...config, numberFormat: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value="standard">Standard (1,234.56)</option>
                    <option value="compact">Compact (1.2k / 1.2M)</option>
                    <option value="currency">Currency ($ / € / £)</option>
                    <option value="percent">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 text-[10px]">Decimal Precision</label>
                  <select
                    value={config.decimalPrecision !== undefined ? config.decimalPrecision : 2}
                    onChange={e => onChangeConfig({ ...config, decimalPrecision: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <option value={0}>0 decimals (12)</option>
                    <option value={1}>1 decimal (12.3)</option>
                    <option value={2}>2 decimals (12.34)</option>
                    <option value={3}>3 decimals (12.345)</option>
                  </select>
                </div>
              </div>

              {config.numberFormat === 'currency' && (
                <div>
                  <label className="block text-slate-400 mb-1 text-[10px]">Currency Symbol</label>
                  <input
                    type="text"
                    value={config.currencySymbol || '$'}
                    onChange={e => onChangeConfig({ ...config, currencySymbol: e.target.value })}
                    className="w-20 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* 7. Display & Toggles */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Labels & Display
              </label>

              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">Chart Title</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={e => onChangeConfig({ ...config, title: e.target.value })}
                  placeholder="e.g., Revenue by Month"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 text-[11px]">Description / Context</label>
                <input
                  type="text"
                  value={config.subtitle || ''}
                  onChange={e => onChangeConfig({ ...config, subtitle: e.target.value })}
                  placeholder="e.g., Q1 - Q4 Analysis"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 hover:border-slate-700 transition-colors"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.showLegend}
                    onChange={e => onChangeConfig({ ...config, showLegend: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500/40 focus:ring-offset-0 focus:outline-hidden cursor-pointer accent-indigo-600"
                  />
                  <span>Legend</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.showDataLabels}
                    onChange={e => onChangeConfig({ ...config, showDataLabels: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500/40 focus:ring-offset-0 focus:outline-hidden cursor-pointer accent-indigo-600"
                  />
                  <span>Data Labels</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.showGrid}
                    onChange={e => onChangeConfig({ ...config, showGrid: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500/40 focus:ring-offset-0 focus:outline-hidden cursor-pointer accent-indigo-600"
                  />
                  <span>Grid Lines</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.showTooltip !== false}
                    onChange={e => onChangeConfig({ ...config, showTooltip: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500/40 focus:ring-offset-0 focus:outline-hidden cursor-pointer accent-indigo-600"
                  />
                  <span>Tooltips</span>
                </label>
              </div>

              {/* Safe NULL Handling Toggle */}
              <label className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 cursor-pointer pt-2 border-t border-slate-800/40 select-none">
                <input
                  type="checkbox"
                  checked={config.treatNullAsZero}
                  onChange={e => onChangeConfig({ ...config, treatNullAsZero: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-1 focus:ring-indigo-500/40 focus:ring-offset-0 focus:outline-hidden cursor-pointer accent-indigo-600"
                />
                <span>Treat NULL values as 0</span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
