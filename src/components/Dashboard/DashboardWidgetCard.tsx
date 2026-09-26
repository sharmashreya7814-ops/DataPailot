import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  RefreshCw,
  Trash2,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileCode,
  TrendingUp,
  BarChart3,
  PieChart,
  Table as TableIcon,
  Activity,
  Layers,
  HelpCircle,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Sliders,
  Filter,
  GripVertical
} from 'lucide-react';
import { DashboardWidget } from '../../types/dashboard';
import { QueryResult } from '../../types/database';
import { ColumnTypeDetector } from '../../services/columnTypeDetector';
import { VisualizationDataProcessor } from '../../services/visualizationDataProcessor';
import { VisualizationExportService } from '../../services/visualizationExportService';

// Reusable Chart views
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

export interface FilterCompatibilityInfo {
  isCompatible: boolean;
  filterLabel: string;
  columnName?: string;
  reason?: string;
}

interface DashboardWidgetCardProps {
  widget: DashboardWidget;
  result?: QueryResult;
  isLoading?: boolean;
  onRefreshWidget?: (widgetId: string) => void;
  onRemoveWidget?: (widgetId: string) => void;
  onResizeWidget?: (widgetId: string, colSpan: 3 | 4 | 6 | 8 | 12) => void;
  onResizeCustom?: (widgetId: string, size: { colSpan: number; height?: number; preset?: string }) => void;
  onDuplicateWidget?: (widgetId: string) => void;
  onMoveWidget?: (widgetId: string, direction: 'prev' | 'next') => void;
  onEditQuery?: (sql: string) => void;
  onRepairWidget?: (widget: DashboardWidget) => void;
  onCrossFilter?: (column: string, value: string) => void;
  onDragStart?: (e: React.DragEvent, widgetId: string) => void;
  onDragOver?: (e: React.DragEvent, widgetId: string) => void;
  onDrop?: (e: React.DragEvent, widgetId: string) => void;
  onDragEnd?: () => void;
  isDraggedOver?: boolean;
  filterCompatibility?: FilterCompatibilityInfo | null;
  isPresentationMode?: boolean;
}

export const DashboardWidgetCard: React.FC<DashboardWidgetCardProps> = ({
  widget,
  result,
  isLoading,
  onRefreshWidget,
  onRemoveWidget,
  onResizeWidget,
  onResizeCustom,
  onDuplicateWidget,
  onMoveWidget,
  onEditQuery,
  onRepairWidget,
  onCrossFilter,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDraggedOver = false,
  filterCompatibility,
  isPresentationMode = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Resize drag state
  const [isResizing, setIsResizing] = useState(false);
  const [previewColSpan, setPreviewColSpan] = useState<number | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeResult = result || widget.cachedResult;

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  // Handle Fullscreen Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Process data for charts
  const detectedColumns = React.useMemo(() => {
    if (!activeResult || !activeResult.columns) return [];
    return ColumnTypeDetector.detect(activeResult.columns, activeResult.rows);
  }, [activeResult]);

  const processedData = React.useMemo(() => {
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

  const currentColSpan = previewColSpan ?? widget.size.colSpan;
  const currentHeight = previewHeight ?? widget.size.height ?? 340;

  const colSpanClasses: Record<number, string> = {
    3: 'col-span-12 sm:col-span-6 lg:col-span-3',
    4: 'col-span-12 sm:col-span-6 lg:col-span-4',
    6: 'col-span-12 lg:col-span-6',
    8: 'col-span-12 lg:col-span-8',
    9: 'col-span-12 lg:col-span-9',
    12: 'col-span-12'
  };

  const cardClass = colSpanClasses[currentColSpan] || 'col-span-12 lg:col-span-6';

  // Handle Interactive Drag Resize
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialHeight = currentHeight;
    const initialColSpan = currentColSpan;

    const parentGrid = cardRef.current?.parentElement;
    const gridWidth = parentGrid ? parentGrid.clientWidth : 1200;
    const singleColWidth = gridWidth / 12;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Calculate new colSpan
      const deltaCols = Math.round(deltaX / singleColWidth);
      const rawCol = initialColSpan + deltaCols;
      // Snap to standard grid spans: 3, 4, 6, 8, 9, 12
      const allowedSpans = [3, 4, 6, 8, 9, 12];
      const closestSpan = allowedSpans.reduce((prev, curr) =>
        Math.abs(curr - rawCol) < Math.abs(prev - rawCol) ? curr : prev
      );
      setPreviewColSpan(closestSpan);

      // Calculate new height, bounded [220px, 800px] and snapped in 20px increments
      const rawHeight = initialHeight + deltaY;
      const boundedHeight = Math.max(220, Math.min(800, rawHeight));
      const snappedHeight = Math.round(boundedHeight / 20) * 20;
      setPreviewHeight(snappedHeight);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIsResizing(false);

      const deltaX = upEvent.clientX - startX;
      const deltaY = upEvent.clientY - startY;
      const deltaCols = Math.round(deltaX / singleColWidth);
      const rawCol = initialColSpan + deltaCols;
      const allowedSpans = [3, 4, 6, 8, 9, 12];
      const finalCol = allowedSpans.reduce((prev, curr) =>
        Math.abs(curr - rawCol) < Math.abs(prev - rawCol) ? curr : prev
      );

      const rawHeight = initialHeight + deltaY;
      const boundedHeight = Math.max(220, Math.min(800, rawHeight));
      const finalHeight = Math.round(boundedHeight / 20) * 20;

      setPreviewColSpan(null);
      setPreviewHeight(null);

      if (onResizeCustom) {
        onResizeCustom(widget.id, { colSpan: finalCol, height: finalHeight });
      } else if (onResizeWidget) {
        onResizeWidget(widget.id, finalCol as any);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Preset size handlers
  const handleApplyPreset = (preset: 'small' | 'medium' | 'large' | 'full' | 'reset') => {
    let colSpan: number = 6;
    let height: number = 340;

    switch (preset) {
      case 'small':
        colSpan = 3;
        height = 260;
        break;
      case 'medium':
        colSpan = 6;
        height = 340;
        break;
      case 'large':
        colSpan = 9;
        height = 440;
        break;
      case 'full':
        colSpan = 12;
        height = 500;
        break;
      case 'reset':
      default:
        colSpan = 6;
        height = 340;
        break;
    }

    if (onResizeCustom) {
      onResizeCustom(widget.id, { colSpan, height, preset });
    } else if (onResizeWidget) {
      onResizeWidget(widget.id, colSpan as any);
    }
    setIsMenuOpen(false);
  };

  // Export handlers
  const handleExportCsv = () => {
    if (!activeResult || !activeResult.columns || !activeResult.rows) return;
    setIsMenuOpen(false);
    VisualizationExportService.exportToCsv(
      widget.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      activeResult.columns,
      activeResult.rows
    );
  };

  const handleExportPng = async () => {
    if (!chartContainerRef.current) return;
    setIsMenuOpen(false);
    setIsExporting(true);
    try {
      await VisualizationExportService.downloadChartAsPng(
        chartContainerRef.current,
        widget.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      );
    } catch (err) {
      console.warn('PNG export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Render Chart Visualization
  const renderChart = (isEnlarged = false) => {
    if (!activeResult || activeResult.rows.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <HelpCircle className="w-7 h-7 text-slate-600 mb-2" />
          <p className="text-xs font-medium text-slate-300">No data returned</p>
          <p className="text-[11px] text-slate-400 mt-1">Query returned 0 rows for this widget.</p>
        </div>
      );
    }

    const chartType = widget.chartType;

    switch (chartType) {
      case 'kpi':
        return <KpiCardView rows={activeResult.rows} config={widget.chartConfig} />;

      case 'table':
        return <TableView columns={activeResult.columns} rows={activeResult.rows} />;

      case 'bar':
      case 'grouped_bar':
      case 'stacked_bar':
      case 'percent_bar':
        return (
          <BarChartView
            data={processedData}
            config={widget.chartConfig}
            isHorizontal={false}
          />
        );

      case 'horizontal_bar':
        return (
          <BarChartView
            data={processedData}
            config={widget.chartConfig}
            isHorizontal={true}
          />
        );

      case 'line':
        return <LineChartView data={processedData} config={widget.chartConfig} />;

      case 'area':
      case 'stacked_area':
        return <AreaChartView data={processedData} config={widget.chartConfig} />;

      case 'pie':
      case 'donut':
        return (
          <PieDonutView
            data={processedData}
            config={widget.chartConfig}
            isDonut={chartType === 'donut'}
          />
        );

      case 'scatter':
        return <ScatterPlotView data={processedData} config={widget.chartConfig} />;

      case 'histogram':
        return <HistogramView rows={activeResult.rows} config={widget.chartConfig} />;

      case 'composed':
        return <ComposedChartView data={processedData} config={widget.chartConfig} />;

      case 'radar':
        return <RadarChartView data={processedData} config={widget.chartConfig} />;

      case 'radial_bar':
        return <RadialBarChartView data={processedData} config={widget.chartConfig} />;

      case 'funnel':
        return <FunnelChartView data={processedData} config={widget.chartConfig} />;

      case 'treemap':
        return <TreemapView data={processedData} config={widget.chartConfig} />;

      default:
        return (
          <BarChartView
            data={processedData}
            config={widget.chartConfig}
            isHorizontal={false}
          />
        );
    }
  };

  return (
    <>
      {/* Widget Card on Grid */}
      <div
        ref={cardRef}
        draggable={!isPresentationMode && !isResizing}
        onDragStart={e => onDragStart?.(e, widget.id)}
        onDragOver={e => onDragOver?.(e, widget.id)}
        onDrop={e => onDrop?.(e, widget.id)}
        onDragEnd={onDragEnd}
        className={`${cardClass} bg-slate-900 border rounded-xl overflow-hidden flex flex-col shadow-lg transition-all relative group print:break-inside-avoid print:shadow-none print:border-slate-300 print:bg-white ${
          isDraggedOver
            ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-emerald-950/50'
            : isResizing
            ? 'border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-2xl'
            : 'border-slate-800/90 hover:border-slate-700/80'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!isMenuOpen) setIsMenuOpen(false);
        }}
        style={{ minHeight: `${currentHeight}px`, height: `${currentHeight}px` }}
      >
        {/* Widget Header */}
        <div className="px-3.5 py-2.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 select-none print:bg-white print:border-slate-200">
          <div className="flex items-center space-x-2 min-w-0 pr-2">
            {!isPresentationMode && (
              <GripVertical
                className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0"
                title="Drag to reorder widget"
              />
            )}
            <span className="w-2 h-2 rounded-full bg-emerald-500/80 flex-shrink-0 print:bg-emerald-600" />
            <div className="truncate">
              <h4 className="text-xs font-semibold text-slate-100 truncate tracking-wide print:text-slate-900">
                {widget.title}
              </h4>
              {widget.description && (
                <p className="text-[11px] text-slate-400 truncate print:text-slate-600">
                  {widget.description}
                </p>
              )}
            </div>

            {/* Filter Compatibility Indicator */}
            {filterCompatibility && (
              <span
                className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                  filterCompatibility.isCompatible
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'
                }`}
                title={filterCompatibility.reason}
              >
                {filterCompatibility.isCompatible ? (
                  <>
                    <Filter className="w-2.5 h-2.5" />
                    <span>Filtered</span>
                  </>
                ) : (
                  <span>Unaffected</span>
                )}
              </span>
            )}
          </div>

          {/* Header Right Actions */}
          {!isPresentationMode && (
            <div className="flex items-center space-x-1 flex-shrink-0 print:hidden">
              {/* Move Prev/Next Controls on hover */}
              {onMoveWidget && isHovered && (
                <div className="hidden sm:flex items-center space-x-0.5 bg-slate-800/70 rounded p-0.5 border border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => onMoveWidget(widget.id, 'prev')}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                    title="Move widget left / up"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveWidget(widget.id, 'next')}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
                    title="Move widget right / down"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Refresh Button */}
              {onRefreshWidget && (
                <button
                  type="button"
                  onClick={() => onRefreshWidget(widget.id)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                  title="Refresh this widget"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`}
                  />
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                title="Fullscreen mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Dropdown Menu Trigger */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(prev => !prev)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-40 text-xs divide-y divide-slate-800 animate-in fade-in zoom-in-95">
                    {/* Size Presets */}
                    <div className="p-2">
                      <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5 px-1">
                        Widget Size Preset
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('small')}
                          className="px-2 py-1 rounded text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                        >
                          <span>Small</span>
                          <span className="text-[10px] text-slate-400">3 col</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('medium')}
                          className="px-2 py-1 rounded text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                        >
                          <span>Medium</span>
                          <span className="text-[10px] text-slate-400">6 col</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('large')}
                          className="px-2 py-1 rounded text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                        >
                          <span>Large</span>
                          <span className="text-[10px] text-slate-400">9 col</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyPreset('full')}
                          className="px-2 py-1 rounded text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                        >
                          <span>Full Width</span>
                          <span className="text-[10px] text-slate-400">12 col</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('reset')}
                        className="w-full mt-1 text-center py-1 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded"
                      >
                        Reset Size (Default)
                      </button>
                    </div>

                    {/* Widget Operations */}
                    <div className="py-1">
                      {onDuplicateWidget && (
                        <button
                          type="button"
                          onClick={() => {
                            onDuplicateWidget(widget.id);
                            setIsMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                        >
                          <Copy className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Duplicate Widget</span>
                        </button>
                      )}

                      {onEditQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            onEditQuery(widget.queryRef.sql);
                            setIsMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                        >
                          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Edit Query in SQL Editor</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsFullscreen(true);
                          setIsMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Fullscreen</span>
                      </button>
                    </div>

                    {/* Export Actions */}
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Export as CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPng}
                        disabled={isExporting}
                        className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-800 flex items-center space-x-2"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isExporting ? 'Exporting PNG...' : 'Export as PNG'}</span>
                      </button>
                    </div>

                    {/* Remove Action */}
                    {onRemoveWidget && (
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveWidget(widget.id);
                            setIsMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-center space-x-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Remove Widget</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Widget Body */}
        <div
          ref={chartContainerRef}
          className="flex-1 p-3.5 flex flex-col justify-center relative overflow-hidden"
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center space-y-2 backdrop-blur-[2px]">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <p className="text-xs font-medium text-slate-300">Refreshing query data...</p>
            </div>
          )}

          {/* State 1: Schema Changed */}
          {widget.status === 'schema_changed' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-amber-300 bg-amber-950/20 rounded-lg border border-amber-900/50">
              <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
              <h5 className="text-xs font-semibold text-amber-200">Data source changed</h5>
              <p className="text-[11px] text-amber-300/80 mt-1 max-w-sm">
                {widget.schemaChangeDetails?.description ||
                  widget.errorMessage ||
                  'The underlying table or columns for this widget have been modified.'}
              </p>
              <div className="flex items-center space-x-2 mt-4">
                {onRepairWidget && (
                  <button
                    type="button"
                    onClick={() => onRepairWidget(widget)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-medium transition-colors"
                  >
                    <span>Repair Query</span>
                  </button>
                )}
                {onEditQuery && (
                  <button
                    type="button"
                    onClick={() => onEditQuery(widget.queryRef.sql)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Edit Query</span>
                  </button>
                )}
              </div>
            </div>
          ) : widget.status === 'error' ? (
            /* State 2: Query Execution Error */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-rose-300 bg-rose-950/20 rounded-lg border border-rose-900/50">
              <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
              <h5 className="text-xs font-semibold text-rose-200">Unable to load visualization</h5>
              <p className="text-[11px] text-rose-300/80 mt-1 max-w-sm">
                {widget.errorMessage || 'The query failed to execute against the active connection.'}
              </p>
              <div className="flex items-center space-x-2 mt-4">
                {onRefreshWidget && (
                  <button
                    type="button"
                    onClick={() => onRefreshWidget(widget.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-medium transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}
                {onEditQuery && (
                  <button
                    type="button"
                    onClick={() => onEditQuery(widget.queryRef.sql)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Edit Query</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* State 3: Normal Visualization */
            <div className="flex-1 w-full h-full min-h-[180px] relative">
              {renderChart(false)}
            </div>
          )}
        </div>

        {/* Widget Footer */}
        {activeResult && (
          <div className="px-3.5 py-1.5 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/20 select-none">
            <span className="truncate">
              {activeResult.rowCount.toLocaleString()} rows
              {activeResult.executionTimeMs !== undefined && ` • ${activeResult.executionTimeMs}ms`}
            </span>
            <div className="flex items-center space-x-2 text-slate-400">
              <span className="font-mono text-[9px] uppercase tracking-wider">
                {currentColSpan} col • {currentHeight}px
              </span>
            </div>
          </div>
        )}

        {/* Free Grid Resize Handle (bottom-right) */}
        {!isPresentationMode && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 text-slate-600 hover:text-emerald-400 group-hover:opacity-100 opacity-60 transition-opacity select-none z-10"
            title="Drag to resize widget horizontally and vertically"
          >
            <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current">
              <circle cx="5" cy="5" r="0.8" />
              <circle cx="5" cy="2.5" r="0.8" />
              <circle cx="2.5" cy="5" r="0.8" />
            </svg>
          </div>
        )}
      </div>

      {/* Fullscreen Modal View */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-150">
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 select-none">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <div>
                <h3 className="text-base font-semibold text-white tracking-wide">
                  {widget.title}
                </h3>
                {widget.description && (
                  <p className="text-xs text-slate-400 mt-0.5">{widget.description}</p>
                )}
              </div>
              {filterCompatibility && (
                <span
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium ml-4 ${
                    filterCompatibility.isCompatible
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span>
                    {filterCompatibility.isCompatible ? 'Filtered by Active Filter' : 'Unaffected'}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-200 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Body */}
          <div className="flex-1 w-full h-full min-h-[400px] py-6 relative">
            {renderChart(true)}
          </div>

          {/* Fullscreen Footer */}
          {activeResult && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{activeResult.rowCount.toLocaleString()} total rows</span>
              {activeResult.executionTimeMs !== undefined && (
                <span>Query execution: {activeResult.executionTimeMs}ms</span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
