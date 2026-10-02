import React, { useState } from 'react';
import { Network, Users, ArrowRightLeft, Filter, Play, Sparkles, Plus, Trash2 } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { GeneratedAnalysisQuery } from '../../../types/analysis';
import { classifyColumns, SmartFieldMapper } from '../../../utils/analysisCompatibility';

interface AdvancedAnalyticsBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const AdvancedAnalyticsBuilder: React.FC<AdvancedAnalyticsBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const [activeAnalysis, setActiveAnalysis] = useState<'cohort' | 'retention' | 'funnel'>('cohort');
  const { idColumns, dateColumns, numericColumns, stringColumns } = classifyColumns(table.columns);

  const defaultUserCol = SmartFieldMapper.suggestColumn(table.columns, 'customer') || idColumns[0]?.name || table.columns[0]?.name || '';
  const defaultDateCol = SmartFieldMapper.suggestColumn(table.columns, 'date') || dateColumns[0]?.name || '';
  const defaultRevCol = SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || '';
  const defaultEventCol = SmartFieldMapper.suggestColumn(table.columns, 'event') || stringColumns[0]?.name || table.columns[0]?.name || '';

  // 1. Cohort State
  const [cohortUserCol, setCohortUserCol] = useState<string>(defaultUserCol);
  const [cohortDateCol, setCohortDateCol] = useState<string>(defaultDateCol);
  const [cohortPeriod, setCohortPeriod] = useState<'month' | 'week'>('month');
  const [cohortRevCol, setCohortRevCol] = useState<string>(defaultRevCol);

  // 2. Retention State
  const [retUserCol, setRetUserCol] = useState<string>(defaultUserCol);
  const [retDateCol, setRetDateCol] = useState<string>(defaultDateCol);
  const [retInterval, setRetInterval] = useState<'month' | 'week' | 'day'>('month');

  // 3. Funnel State
  const [funnelUserCol, setFunnelUserCol] = useState<string>(defaultUserCol);
  const [funnelStepCol, setFunnelStepCol] = useState<string>(defaultEventCol);
  const [funnelSteps, setFunnelSteps] = useState<string[]>([
    'page_view',
    'add_to_cart',
    'checkout_start',
    'purchase'
  ]);

  const addFunnelStep = () => {
    setFunnelSteps(prev => [...prev, `step_${prev.length + 1}`]);
  };

  const updateFunnelStep = (index: number, val: string) => {
    setFunnelSteps(prev => prev.map((s, i) => (i === index ? val : s)));
  };

  const removeFunnelStep = (index: number) => {
    setFunnelSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handlePreviewCohort = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateCohortAnalysis', table.schema, table.name, {
      userIdColumn: cohortUserCol,
      firstActivityDateColumn: cohortDateCol,
      activityDateColumn: cohortDateCol,
      measureColumn: cohortRevCol || undefined
    });
    onPreviewQuery(query);
  };

  const handlePreviewRetention = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateRetentionAnalysis', table.schema, table.name, {
      userIdColumn: retUserCol,
      firstActivityDateColumn: retDateCol,
      returnDateColumn: retDateCol,
      periodUnit: retInterval
    });
    onPreviewQuery(query);
  };

  const handlePreviewFunnel = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateFunnelAnalysis', table.schema, table.name, {
      userIdColumn: funnelUserCol,
      eventColumn: funnelStepCol,
      timestampColumn: defaultDateCol || 'created_at',
      steps: funnelSteps.filter(s => s.trim().length > 0).map((s, idx) => ({
        id: `step_${idx + 1}`,
        name: s.trim(),
        eventValue: s.trim()
      }))
    });
    onPreviewQuery(query);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <Network className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <span>
          Enterprise behavioral analytics: Cohort matrix, retention curve intervals, and sequential funnel conversion drop-offs built with robust CTEs.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveAnalysis('cohort')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeAnalysis === 'cohort'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Cohort Analysis</span>
        </button>

        <button
          onClick={() => setActiveAnalysis('retention')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeAnalysis === 'retention'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>User Retention Curve</span>
        </button>

        <button
          onClick={() => setActiveAnalysis('funnel')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeAnalysis === 'funnel'
              ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          <span>Conversion Funnel Drop-off</span>
        </button>
      </div>

      {/* 1. COHORT */}
      {activeAnalysis === 'cohort' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  User / Customer ID Column:
                </label>
                <select
                  value={cohortUserCol}
                  onChange={e => setCohortUserCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-purple-300 focus:outline-none"
                >
                  {table.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Activity Date Column:
                </label>
                <select
                  value={cohortDateCol}
                  onChange={e => setCohortDateCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                >
                  {table.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Cohort Period:
                </label>
                <select
                  value={cohortPeriod}
                  onChange={e => setCohortPeriod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  <option value="month">Monthly Cohorts</option>
                  <option value="week">Weekly Cohorts</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Optional Revenue Column:
                </label>
                <select
                  value={cohortRevCol}
                  onChange={e => setCohortRevCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
                >
                  <option value="">None (Count Active Users)</option>
                  {numericColumns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewCohort}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Cohort Analysis SQL</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. RETENTION */}
      {activeAnalysis === 'retention' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  User ID Column:
                </label>
                <select
                  value={retUserCol}
                  onChange={e => setRetUserCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-purple-300 focus:outline-none"
                >
                  {table.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Activity Timestamp Column:
                </label>
                <select
                  value={retDateCol}
                  onChange={e => setRetDateCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                >
                  {table.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Retention Interval:
                </label>
                <select
                  value={retInterval}
                  onChange={e => setRetInterval(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  <option value="month">Month Index (0, 1, 2...)</option>
                  <option value="week">Week Index (0, 1, 2...)</option>
                  <option value="day">Day Index (0, 1, 2...)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewRetention}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Retention Curve SQL</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. FUNNEL */}
      {activeAnalysis === 'funnel' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  User ID Column:
                </label>
                <select
                  value={funnelUserCol}
                  onChange={e => setFunnelUserCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-purple-300 focus:outline-none"
                >
                  {table.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Event / Step Name Column:
                </label>
                <select
                  value={funnelStepCol}
                  onChange={e => setFunnelStepCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
                >
                  {table.columns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Steps configuration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Funnel Milestones (Sequential Steps):
                </label>
                <button
                  onClick={addFunnelStep}
                  className="text-xs text-purple-400 hover:underline flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Step</span>
                </button>
              </div>

              <div className="space-y-2">
                {funnelSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <span className="text-xs font-mono text-purple-400 font-bold w-14">
                      Step {idx + 1}:
                    </span>
                    <input
                      type="text"
                      value={step}
                      onChange={e => updateFunnelStep(idx, e.target.value)}
                      placeholder="e.g. signup, view_item, purchase"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none flex-1"
                    />
                    {funnelSteps.length > 2 && (
                      <button
                        onClick={() => removeFunnelStep(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewFunnel}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Funnel Conversion SQL</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
