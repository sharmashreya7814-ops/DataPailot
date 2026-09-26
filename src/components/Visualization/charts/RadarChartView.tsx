import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface RadarChartViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6'  // Violet
];

export const RadarChartView: React.FC<RadarChartViewProps> = ({ data, config }) => {
  const measures = [config.yAxis, ...(config.secondaryMeasures || [])];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          <div className="font-semibold text-slate-200 mb-1.5 pb-1 border-b border-slate-800">
            {label}
          </div>
          {payload.map((entry: any, idx: number) => (
            <div key={`tip-${idx}`} className="flex items-center justify-between space-x-4 py-0.5">
              <span className="flex items-center space-x-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-mono font-medium text-slate-100">
                {VisualizationDataProcessor.formatNumber(entry.value, config)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="radar-chart-stage" className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          {config.showGrid && <PolarGrid stroke="#334155" />}
          <PolarAngleAxis
            dataKey="xLabel"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={30}
            stroke="#475569"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickFormatter={val => VisualizationDataProcessor.formatNumber(val, config)}
          />

          {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
          {config.showLegend && <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />}

          {measures.map((mKey, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            return (
              <Radar
                key={mKey}
                name={mKey.replace(/_/g, ' ')}
                dataKey={mKey}
                stroke={color}
                fill={color}
                fillOpacity={0.4}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
