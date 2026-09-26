import React from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { ChartConfig } from '../../../types/visualization';
import { ProcessedDataPoint, VisualizationDataProcessor } from '../../../services/visualizationDataProcessor';

interface TreemapViewProps {
  data: ProcessedDataPoint[];
  config: ChartConfig;
}

const PALETTE = [
  '#6366f1',
  '#10b981',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#14b8a6',
  '#f97316'
];

interface CustomTreemapContentProps {
  root?: any;
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  value?: number;
  config?: ChartConfig;
}

const CustomizedTreemapContent: React.FC<CustomTreemapContentProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  name = '',
  value = 0,
  config
}) => {
  const bg = PALETTE[index % PALETTE.length];
  const canShowText = width > 45 && height > 30;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: bg,
          stroke: '#0f172a',
          strokeWidth: 2,
          strokeOpacity: 1
        }}
        rx={4}
      />
      {canShowText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (height > 50 ? 7 : 0)}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={width < 80 ? 10 : 12}
            fontWeight="bold"
            className="select-none pointer-events-none"
          >
            {name.length > 12 && width < 90 ? `${name.substring(0, 10)}...` : name}
          </text>
          {height > 50 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 12}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize={10}
              className="select-none pointer-events-none font-mono"
            >
              {VisualizationDataProcessor.formatNumber(value, config)}
            </text>
          )}
        </>
      )}
    </g>
  );
};

export const TreemapView: React.FC<TreemapViewProps> = ({ data, config }) => {
  const measure = config.yAxis;

  const treemapData = React.useMemo(() => {
    return data
      .filter(pt => typeof pt[measure] === 'number' && (pt[measure] as number) > 0)
      .map(pt => ({
        name: pt.xLabel,
        size: pt[measure] as number,
        value: pt[measure] as number
      }));
  }, [data, measure]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg p-3 text-xs">
          <div className="text-slate-200 font-semibold mb-1">
            {entry.payload.name}
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
    <div id="treemap-stage" className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treemapData}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#0f172a"
          content={<CustomizedTreemapContent config={config} />}
        >
          {config.showTooltip !== false && <Tooltip content={<CustomTooltip />} />}
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};
