import React, { useEffect, useMemo } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileImage,
  RefreshCw
} from 'lucide-react';
import { DashboardWidget } from '../../types/dashboard';
import { QueryResult } from '../../types/database';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';
import { DashboardExportService } from '../../services/dashboardExportService';

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

interface WidgetFullscreenModalProps {
  widget: DashboardWidget | null;
  result?: QueryResult;
  isOpen: boolean;
  onClose: () => void;
  onRefreshWidget?: (widgetId: string) => void;
  isLoading?: boolean;
}

export const WidgetFullscreenModal: React.FC<WidgetFullscreenModalProps> = ({
  widget,
  result,
  isOpen,
  onClose,
  onRefreshWidget,
  isLoading
}) => {
  if (!isOpen || !widget) return null;

  const activeResult = result || widget.cachedResult;

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const detectedColumns = useMemo(() => {
    if (!activeResult || !activeResult.columns) return [];
    return ColumnTypeDetector.detect(activeResult.columns, activeResult.rows);
  }, [activeResult]);

  const processedData = useMemo(() => {
    if (!activeResult || !activeResult.rows) return [];
    try {
      return VisualizationDataProcessor.process(
        activeResult.rows,
        widget.chartConfig,
        detectedColumns
      );
    } catch {
      return [];
    }
  }, [activeResult, widget.chartConfig, detectedColumns]);

  const handleExportCsv = () => {
    DashboardExportService.exportWidgetCsv(widget, activeResult);
  };

  const handleExportPng = () => {
    DashboardExportService.exportWidgetPng('fullscreen-chart-stage-container', widget.title);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{widget.title}</h2>
            {widget.description && (
              <p className="text-xs text-slate-400 mt-0.5">{widget.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onRefreshWidget && (
            <button
              type="button"
              onClick={() => onRefreshWidget(widget.id)}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
              title="Refresh widget data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            title="Export CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPng}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            title="Export PNG"
          >
            <FileImage className="w-3.5 h-3.5 text-cyan-400" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors ml-2"
            title="Close Fullscreen (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Enlarged Chart Canvas */}
      <div id="fullscreen-chart-stage-container" className="flex-1 w-full h-full relative overflow-hidden py-4 flex flex-col justify-center">
        {!activeResult || activeResult.rows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <p className="text-sm font-medium">No rows returned for this query</p>
          </div>
        ) : (
          <div className="w-full h-full min-h-[400px] flex-1">
            {widget.chartType === 'kpi' && (
              <KpiCardView rows={activeResult.rows} config={widget.chartConfig} />
            )}

            {(widget.chartType === 'bar' ||
              widget.chartType === 'grouped_bar' ||
              widget.chartType === 'stacked_bar' ||
              widget.chartType === 'percent_bar') && (
              <BarChartView
                data={processedData}
                config={widget.chartConfig}
                isHorizontal={false}
              />
            )}

            {widget.chartType === 'horizontal_bar' && (
              <BarChartView
                data={processedData}
                config={widget.chartConfig}
                isHorizontal={true}
              />
            )}

            {widget.chartType === 'line' && (
              <LineChartView data={processedData} config={widget.chartConfig} />
            )}

            {(widget.chartType === 'area' || widget.chartType === 'stacked_area') && (
              <AreaChartView data={processedData} config={widget.chartConfig} />
            )}

            {(widget.chartType === 'pie' || widget.chartType === 'donut') && (
              <PieDonutView
                data={processedData}
                config={widget.chartConfig}
                isDonut={widget.chartType === 'donut'}
              />
            )}

            {widget.chartType === 'scatter' && (
              <ScatterPlotView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'histogram' && (
              <HistogramView rows={activeResult.rows} config={widget.chartConfig} />
            )}

            {widget.chartType === 'composed' && (
              <ComposedChartView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'radar' && (
              <RadarChartView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'radial_bar' && (
              <RadialBarChartView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'funnel' && (
              <FunnelChartView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'treemap' && (
              <TreemapView data={processedData} config={widget.chartConfig} />
            )}

            {widget.chartType === 'table' && (
              <TableView columns={activeResult.columns} rows={activeResult.rows} />
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {activeResult && (
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>{activeResult.rowCount.toLocaleString()} rows</span>
          {activeResult.executionTimeMs !== undefined && (
            <span>Execution time: {activeResult.executionTimeMs}ms</span>
          )}
        </div>
      )}
    </div>
  );
};
