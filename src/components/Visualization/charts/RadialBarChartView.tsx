import React from 'react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Legend,
  Tooltip
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface RadialBarChartViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#14b8a6'  // Teal
];

export const RadialBarChartView: React.FC<RadialBarChartViewProps> = ({ data, config }) => {
  const measure = config.yAxis;

  // Format data for RadialBar with specific fill colors per ring
  const radialData = React.useMemo(() => {
    return data.slice(0, 10).map((pt, idx) => ({
      name: pt.xLabel,
      value: typeof pt[measure] === 'number' ? (pt[measure] as number) : 0,
      fill: PALETTE[idx % PALETTE.length]
    }));
  }, [data, measure]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-200 font-semibold mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
            <span>{entry.payload.name}</span>
          </div>
          <div className="text-slate-400">
            {measure.replace(/_/g, ' ')}:{' '}
            <span className="font-mono font-medium text-slate-100">
              {VisualizationDataProcessor.formatNumber(entry.value, config)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="radial-bar-chart-stage" className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="20%"
          outerRadius="90%"
          barSize={12}
          data={radialData}
        >
          <RadialBar
            background={{ fill: '#1e293b' }}
            dataKey="value"
          />
          {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
          {config.showLegend && (
            <Legend
              iconSize={10}
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
            />
          )}
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
};
