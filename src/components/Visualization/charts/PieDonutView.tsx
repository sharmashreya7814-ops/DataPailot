import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';
import { AlertCircle } from 'lucide-react';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface PieDonutViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
  isDonut?: boolean;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#64748b'  // Slate
];

export const PieDonutView: React.FC<PieDonutViewProps> = ({
  data,
  config,
  isDonut = false
}) => {
  const yKey = config.yAxis;

  // Calculate total for percentage calculation
  const total = data.reduce((acc, curr) => {
    const val = Number(curr[yKey]) || 0;
    return acc + val;
  }, 0);

  const pieData = data.map(d => ({
    name: d.xLabel,
    value: Number(d[yKey]) || 0
  }));

  const hasTooManySlices = pieData.length > 8;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const val = item.value || 0;
      const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';

      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          <div className="font-semibold text-slate-200 mb-1">{item.name}</div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span>Value:</span>
            <span className="font-mono font-medium text-white">
              {VisualizationDataProcessor.formatNumber(val, config)}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400 mt-0.5">
            <span>Share:</span>
            <span className="font-mono font-semibold text-indigo-400">{pct}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="pie-chart-stage" className="w-full h-full min-h-[220px] flex flex-col items-center">
      {hasTooManySlices && (
        <div className="w-full max-w-lg mb-2 flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Pie charts work best with a small number of categories ({pieData.length} shown). Consider a Bar Chart.
          </span>
        </div>
      )}

      <div className="w-full flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
            {config.showLegend && (
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: 16, fontSize: 11 }}
              />
            )}
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={isDonut ? 110 : 120}
              innerRadius={isDonut ? 65 : 0}
              paddingAngle={isDonut ? 2 : 1}
              stroke="#0b0f19"
              strokeWidth={2}
              label={
                config.showDataLabels
                  ? ({ name, percent }: any) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                  : false
              }
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
