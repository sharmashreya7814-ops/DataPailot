import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface BarChartViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
  isHorizontal?: boolean;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#f97316'  // Orange
];

export const BarChartView: React.FC<BarChartViewProps> = ({
  data,
  config,
  isHorizontal = false
}) => {
  const isStacked = config.chartType === 'stacked_bar' || config.chartType === 'percent_bar';
  const isPercent = config.chartType === 'percent_bar';
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
                {isPercent ? `${entry.value}%` : VisualizationDataProcessor.formatNumber(entry.value, config)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div id="bar-chart-stage" className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 20, right: 30, left: 20, bottom: config.xAxisLabel ? 45 : 35 }}
        >
          {config.showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
          )}

          {isHorizontal ? (
            <>
              <XAxis
                type="number"
                domain={isPercent ? [0, 100] : ['auto', 'auto']}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={val => isPercent ? `${val}%` : VisualizationDataProcessor.formatNumber(val, config)}
                label={config.xAxisLabel ? { value: config.xAxisLabel, position: 'bottom', fill: '#94a3b8', fontSize: 11, offset: 5 } : undefined}
              />
              <YAxis
                type="category"
                dataKey="xLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={120}
                label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: 'left', fill: '#94a3b8', fontSize: 11 } : undefined}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="xLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                angle={-25}
                textAnchor="end"
                height={50}
                label={config.xAxisLabel ? { value: config.xAxisLabel, position: 'bottom', fill: '#94a3b8', fontSize: 11, offset: 15 } : undefined}
              />
              <YAxis
                type="number"
                domain={isPercent ? [0, 100] : ['auto', 'auto']}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={val => isPercent ? `${val}%` : VisualizationDataProcessor.formatNumber(val, config)}
                label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: 'left', fill: '#94a3b8', fontSize: 11, offset: 10 } : undefined}
              />
            </>
          )}

          {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
          {config.showLegend && <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />}

          {measures.map((mKey, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            return (
              <Bar
                key={mKey}
                dataKey={mKey}
                name={mKey.replace(/_/g, ' ')}
                fill={color}
                stackId={isStacked ? 'a' : undefined}
                radius={isStacked ? [0, 0, 0, 0] : isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              >
                {config.showDataLabels && (
                  <LabelList
                    dataKey={mKey}
                    position={isHorizontal ? (isStacked ? 'inside' : 'right') : (isStacked ? 'inside' : 'top')}
                    formatter={(val: any) =>
                      typeof val === 'number'
                        ? isPercent ? `${val}%` : VisualizationDataProcessor.formatNumber(val, config)
                        : ''
                    }
                    fill={isStacked ? '#ffffff' : '#94a3b8'}
                    fontSize={10}
                  />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
