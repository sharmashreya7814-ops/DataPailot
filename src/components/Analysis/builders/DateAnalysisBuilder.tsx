import React, { useState } from 'react';
import { Calendar, TrendingUp, ArrowUpRight, BarChart2, Play, AlertCircle } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { GeneratedAnalysisQuery } from '../../../types/analysis';
import { classifyColumns, AnalysisCompatibility } from '../../../utils/analysisCompatibility';

interface DateAnalysisBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const DateAnalysisBuilder: React.FC<DateAnalysisBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const compatibility = AnalysisCompatibility.checkDateAnalysis(table.columns);
  const { dateColumns, numericColumns } = classifyColumns(table.columns);

  const [dateColumn, setDateColumn] = useState<string>(
    dateColumns[0]?.name || table.columns[0]?.name || ''
  );
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [measureColumn, setMeasureColumn] = useState<string>(
    numericColumns[0]?.name || '*'
  );
  const [measureFunction, setMeasureFunction] = useState<'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'>('SUM');
  const [mode, setMode] = useState<
    'trend' | 'mom' | 'yoy' | 'running_sum' | 'running_count' | 'rolling_avg'
  >('trend');
  const [rollingWindow, setRollingWindow] = useState<number>(3);

  if (!compatibility.isCompatible) {
    return (
      <div className="p-6 rounded-xl bg-amber-950/20 border border-amber-500/30 text-slate-200 space-y-3">
        <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>Date Analysis Unavailable for {table.name}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {compatibility.missingMessage}
        </p>
        <p className="text-[11px] text-slate-500">
          Tip: Date analysis requires at least one date or timestamp column (e.g. created_at, order_date, timestamp). Select another table with timestamp information to use date analysis.
        </p>
      </div>
    );
  }

  const handlePreview = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateDateAnalysis', table.schema, table.name, {
      dateColumn,
      period,
      measureColumn,
      measureFunction,
      mode,
      rollingWindow
    });
    onPreviewQuery(query);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>
          Perform time-series aggregations, Month-over-Month growth calculations, running totals, and rolling moving averages.
        </span>
      </div>

      {/* Mode Selector Cards */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Choose Date Analysis Mode:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[
            {
              id: 'trend',
              title: 'Time-Series Trend',
              desc: 'Daily, Weekly, Monthly, or Yearly breakdown by period',
              icon: BarChart2
            },
            {
              id: 'mom',
              title: 'Month-over-Month (MoM)',
              desc: 'Automated MoM growth % using window LAG()',
              icon: ArrowUpRight
            },
            {
              id: 'yoy',
              title: 'Year-over-Year (YoY)',
              desc: 'YoY comparative growth % using window LAG()',
              icon: TrendingUp
            },
            {
              id: 'running_sum',
              title: 'Running Total (SUM)',
              desc: 'Cumulative cumulative sum ordered by date',
              icon: BarChart2
            },
            {
              id: 'running_count',
              title: 'Running Event Count',
              desc: 'Cumulative transaction counter over time',
              icon: BarChart2
            },
            {
              id: 'rolling_avg',
              title: 'Rolling Moving Average',
              desc: 'Multi-period smoothing average using moving frame',
              icon: TrendingUp
            }
          ].map(item => {
            const Icon = item.icon;
            const isSelected = mode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-600/15 border-emerald-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">{item.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Field Configuration */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Column */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Date / Timestamp Column:
            </label>
            <select
              value={dateColumn}
              onChange={e => setDateColumn(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
            >
              {dateColumns.map(col => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.dataType})
                </option>
              ))}
            </select>
          </div>

          {/* Granularity Period (if trend or rolling) */}
          {['trend', 'rolling_avg'].includes(mode) && (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Granularity Period:
              </label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
              >
                <option value="day">Daily (day)</option>
                <option value="week">Weekly (week)</option>
                <option value="month">Monthly (month)</option>
                <option value="quarter">Quarterly (quarter)</option>
                <option value="year">Yearly (year)</option>
              </select>
            </div>
          )}

          {/* Measure Column */}
          {mode !== 'running_count' && (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Metric Measure Column:
              </label>
              <select
                value={measureColumn}
                onChange={e => setMeasureColumn(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
              >
                <option value="*">* (Row Count / Volume)</option>
                {numericColumns.map(col => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rolling window periods */}
          {mode === 'rolling_avg' && (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Moving Window Size (Periods):
              </label>
              <input
                type="number"
                min="2"
                max="30"
                value={rollingWindow}
                onChange={e => setRollingWindow(Math.max(2, parseInt(e.target.value) || 3))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handlePreview}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950/40"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Preview Date Analysis SQL</span>
        </button>
      </div>
    </div>
  );
};
