import React from 'react';
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip
} from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface FunnelChartViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
}

const PALETTE = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ec4899', // Pink
  '#8b5cf6'  // Violet
];

export const FunnelChartView: React.FC<FunnelChartViewProps> = ({ data, config }) => {
  const measure = config.yAxis;

  const funnelData = React.useMemo(() => {
    return data.map((pt, idx) => ({
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
    <div id="funnel-chart-stage" className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
          <Funnel
            dataKey="value"
            data={funnelData}
            isAnimationActive
          >
            {config.showDataLabels && (
              <LabelList
                position="right"
                fill="#cbd5e1"
                stroke="none"
                dataKey="name"
                fontSize={11}
              />
            )}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
};
