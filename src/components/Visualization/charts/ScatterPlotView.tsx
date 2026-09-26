import React from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface ScatterPlotViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

export const ScatterPlotView: React.FC<ScatterPlotViewProps> = ({ data, config }) => {
  const xKey = config.xAxis;
  const yKey = config.yAxis;
  const groupKey = config.seriesGroup;

  // Group data by categorical series if seriesGroup is set
  const seriesMap = new Map<string, any[]>();

  if (groupKey) {
    for (const d of data) {
      const gVal = String(d[groupKey] || 'All');
      if (!seriesMap.has(gVal)) seriesMap.set(gVal, []);
      seriesMap.get(gVal)!.push({
        x: Number(d[xKey]) || 0,
        y: Number(d[yKey]) || 0,
        label: d.xLabel || '',
        name: d.xLabel || gVal
      });
    }
  } else {
    seriesMap.set('Points', data.map(d => ({
      x: Number(d[xKey]) || 0,
      y: Number(d[yKey]) || 0,
      label: d.xLabel || '',
      name: d.xLabel || 'Point'
    })));
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const pt = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          {pt.label && <div className="font-semibold text-slate-200 mb-1">{pt.label}</div>}
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="text-slate-400">{config.xAxis}:</span>
            <span className="font-mono font-medium text-white">{VisualizationDataProcessor.formatNumber(pt.x, config)}</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-300 mt-0.5">
            <span className="text-slate-400">{config.yAxis}:</span>
            <span className="font-mono font-medium text-indigo-400">{VisualizationDataProcessor.formatNumber(pt.y, config)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="scatter-plot-stage" className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: config.xAxisLabel ? 45 : 35 }}>
          {config.showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
          )}

          <XAxis
            type="number"
            dataKey="x"
            name={config.xAxis}
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={val => VisualizationDataProcessor.formatNumber(val, config)}
            label={config.xAxisLabel ? { value: config.xAxisLabel, position: 'bottom', fill: '#94a3b8', fontSize: 11, offset: 15 } : undefined}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={config.yAxis}
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={val => VisualizationDataProcessor.formatNumber(val, config)}
            label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: 'left', fill: '#94a3b8', fontSize: 11, offset: 10 } : undefined}
          />

          {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
          {config.showLegend && groupKey && (
            <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
          )}

          {Array.from(seriesMap.entries()).map(([gName, pts], idx) => {
            const color = PALETTE[idx % PALETTE.length];
            return (
              <Scatter
                key={gName}
                name={gName}
                data={pts}
                fill={color}
                opacity={0.8}
              />
            );
          })}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
