import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  BarChart2,
  BarChartHorizontal,
  LineChart,
  PieChart,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
  Activity,
  Layers,
  Sliders,
  Grid,
  TrendingUp,
  Percent,
  Compass,
  Settings2,
  Eye
} from 'lucide-react';
import { DashboardWidget } from '../../types/dashboard';
import { QueryResult } from '../../types/database';
import {
  ChartConfig,
  ChartType,
  ChartAggregation,
  SortOrder,
  ChartLimit
} from '../../types/visualization';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';
import { ChartRecommender } from '../../services/chartRecommender';

// Chart components
import { KpiCardView } from '../Visualization/charts/KpiCardView';
import { BarChartView } from '../Visualization/charts/BarChartView';
import { LineChartView } from '../Visualization/charts/LineChartView';
import { AreaChartView } from '../Visualization/charts/AreaChartView';
import { PieDonutView } from '../Visualization/charts/PieDonutView';
import { ScatterPlotView } from '../Visualization/charts/ScatterPlotView';
import { HistogramView } from '../Visualization/charts/HistogramView';
import { TableView } from '../Visualization/charts/TableView';
import { ComposedChartView } from '../Visualization/charts/ComposedChartView';
import { RadarChartView } from '../Visualization/charts/RadarChartView';
import { RadialBarChartView } from '../Visualization/charts/RadialBarChartView';
import { FunnelChartView } from '../Visualization/charts/FunnelChartView';
import { TreemapView } from '../Visualization/charts/TreemapView';

interface WidgetEditModalProps {
  widget: DashboardWidget | null;
  result?: QueryResult;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: DashboardWidget) => void;
}

const ALL_CHART_TYPES: { type: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'bar', label: 'Bar', icon: BarChart2 },
  { type: 'horizontal_bar', label: 'Horiz. Bar', icon: BarChartHorizontal },
  { type: 'grouped_bar', label: 'Grouped Bar', icon: BarChart2 },
  { type: 'stacked_bar', label: 'Stacked Bar', icon: BarChart2 },
  { type: 'percent_bar', label: '100% Stacked', icon: Percent },
  { type: 'line', label: 'Line', icon: LineChart },
  { type: 'area', label: 'Area', icon: Layers },
  { type: 'stacked_area', label: 'Stacked Area', icon: Layers },
  { type: 'pie', label: 'Pie', icon: PieChart },
  { type: 'donut', label: 'Donut', icon: PieChart },
  { type: 'scatter', label: 'Scatter', icon: ScatterIcon },
  { type: 'composed', label: 'Composed', icon: Layers },
  { type: 'radar', label: 'Radar', icon: Compass },
  { type: 'radial_bar', label: 'Radial Bar', icon: Activity },
  { type: 'funnel', label: 'Funnel', icon: Sliders },
  { type: 'treemap', label: 'Treemap', icon: Grid },
  { type: 'histogram', label: 'Histogram', icon: BarChart2 },
  { type: 'kpi', label: 'KPI Card', icon: TrendingUp },
  { type: 'table', label: 'Table', icon: TableIcon }
];

export const WidgetEditModal: React.FC<WidgetEditModalProps> = ({
  widget,
  result,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen || !widget) return null;

  const activeResult = result || widget.cachedResult;

  const [title, setTitle] = useState(widget.title);
  const [description, setDescription] = useState(widget.description || '');
  const [config, setConfig] = useState<ChartConfig>({ ...widget.chartConfig });

  const detectedColumns = useMemo(() => {
    if (!activeResult || !activeResult.columns) return [];
    return ColumnTypeDetector.detect(activeResult.columns, activeResult.rows);
  }, [activeResult]);

  const processedData = useMemo(() => {
    if (!activeResult || !activeResult.rows) return [];
    try {
      return VisualizationDataProcessor.process(activeResult.rows, config, detectedColumns);
    } catch {
      return [];
    }
  }, [activeResult, config, detectedColumns]);

  const numericColumns = detectedColumns.filter(c => c.isNumeric);
  const categoricalColumns = detectedColumns.filter(c => !c.isNumeric || c.isDateOrTime);

  const recommendations = useMemo(() => {
    return ChartRecommender.getRecommendations(detectedColumns, activeResult?.rows?.length || 10);
  }, [detectedColumns, activeResult]);

  const recommendedSet = useMemo(() => {
    return new Set(recommendations.map(r => r.chartType));
  }, [recommendations]);

  const handleSave = () => {
    const updated: DashboardWidget = {
      ...widget,
      title: title.trim() || 'Untitled Widget',
      description: description.trim() || undefined,
      chartType: config.chartType,
      chartConfig: config
    };
    onSave(updated);
    onClose();
  };

  const handleTypeSelect = (type: ChartType) => {
    const next = { ...config, chartType: type };
    if (type === 'kpi' && (!config.yAxis || !numericColumns.some(c => c.name === config.yAxis))) {
      next.yAxis = numericColumns[0]?.name || 'All Rows';
    }
    if (type === 'histogram' && (!config.xAxis || !numericColumns.some(c => c.name === config.xAxis))) {
      next.xAxis = numericColumns[0]?.name || '';
      next.yAxis = numericColumns[0]?.name || '';
    }
    setConfig(next);
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 select-none">
          <div className="flex items-center space-x-2">
            <Settings2 className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Edit Widget Configuration</h3>
              <p className="text-xs text-slate-400">Configure chart type, measures, formatting, and visualization layout</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Settings Form */}
          <div className="w-96 border-r border-slate-800 p-5 overflow-y-auto space-y-5 text-xs bg-slate-900/60">
            {/* Title & Description */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional summary..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Chart Type Selector */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Chart Type
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {ALL_CHART_TYPES.map(ct => {
                  const Icon = ct.icon;
                  const isSelected = config.chartType === ct.type;
                  const isRecommended = recommendedSet.has(ct.type);
                  return (
                    <button
                      key={ct.type}
                      type="button"
                      onClick={() => handleTypeSelect(ct.type)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="truncate text-[11px]">{ct.label}</span>
                      </div>
                      {isRecommended && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Recommended" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field Mappings */}
            {config.chartType !== 'table' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Field Mappings
                </label>

                {config.chartType !== 'kpi' && (
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">X-Axis Dimension</label>
                    <select
                      value={config.xAxis}
                      onChange={e => setConfig({ ...config, xAxis: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none"
                    >
                      <option value="">— Select Column —</option>
                      {detectedColumns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.semanticType})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {config.chartType !== 'histogram' && (
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Y-Axis Measure</label>
                    <select
                      value={config.yAxis}
                      onChange={e => setConfig({ ...config, yAxis: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none"
                    >
                      <option value="">— Select Measure —</option>
                      <option value="All Rows">All Rows (*)</option>
                      {detectedColumns.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.semanticType})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Aggregation */}
                {config.chartType !== 'scatter' && config.chartType !== 'histogram' && (
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">Aggregation</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['count', 'sum', 'avg', 'min', 'max', 'none'] as ChartAggregation[]).map(agg => (
                        <button
                          key={agg}
                          type="button"
                          onClick={() => setConfig({ ...config, aggregation: agg })}
                          className={`py-1 rounded text-center text-[10px] font-mono border transition-all ${
                            config.aggregation === agg
                              ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {agg.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formatting */}
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px]">Number Formatting</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={config.numberFormat || 'standard'}
                      onChange={e => setConfig({ ...config, numberFormat: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
                    >
                      <option value="standard">Standard (1,234)</option>
                      <option value="compact">Compact (1.2k / 1.2M)</option>
                      <option value="currency">Currency ($)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                    <select
                      value={config.decimalPrecision !== undefined ? config.decimalPrecision : 2}
                      onChange={e => setConfig({ ...config, decimalPrecision: parseInt(e.target.value, 10) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
                    >
                      <option value={0}>0 Decimals</option>
                      <option value={1}>1 Decimal</option>
                      <option value={2}>2 Decimals</option>
                      <option value={3}>3 Decimals</option>
                    </select>
                  </div>
                </div>

                {/* Axis Titles */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">X-Axis Label</label>
                    <input
                      type="text"
                      value={config.xAxisLabel || ''}
                      onChange={e => setConfig({ ...config, xAxisLabel: e.target.value })}
                      placeholder="Title..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">Y-Axis Label</label>
                    <input
                      type="text"
                      value={config.yAxisLabel || ''}
                      onChange={e => setConfig({ ...config, yAxisLabel: e.target.value })}
                      placeholder="Title..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                {/* Display Toggles */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showLegend}
                      onChange={e => setConfig({ ...config, showLegend: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>Legend</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showDataLabels}
                      onChange={e => setConfig({ ...config, showDataLabels: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>Data Labels</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showGrid}
                      onChange={e => setConfig({ ...config, showGrid: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>Grid Lines</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showTooltip !== false}
                      onChange={e => setConfig({ ...config, showTooltip: e.target.checked })}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>Tooltips</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Chart Preview */}
          <div className="flex-1 flex flex-col p-6 bg-slate-950/40 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300">Live Preview</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {activeResult ? `${activeResult.rowCount.toLocaleString()} rows returned` : 'No data'}
              </span>
            </div>

            <div className="flex-1 w-full h-full min-h-[300px] relative bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-center">
              {!activeResult || activeResult.rows.length === 0 ? (
                <div className="text-center text-slate-400 text-xs">No data returned for this query.</div>
              ) : config.chartType === 'kpi' ? (
                <KpiCardView rows={activeResult.rows} config={config} />
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
                <HistogramView rows={activeResult.rows} config={config} />
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
                <TableView columns={activeResult.columns} rows={activeResult.rows} />
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-emerald-950"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
