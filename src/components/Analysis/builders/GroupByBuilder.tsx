import React, { useState } from 'react';
import { Plus, Trash2, Layers, Play, CheckSquare, Filter, Loader2, AlertCircle } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { AggregationItem, HavingCondition, GeneratedAnalysisQuery } from '../../../types/analysis';
import { classifyColumns } from '../../../utils/analysisCompatibility';

interface GroupByBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const GroupByBuilder: React.FC<GroupByBuilderProps> = ({ table, onPreviewQuery }) => {
  const { numericColumns, stringColumns } = classifyColumns(table.columns);

  const defaultGroupCol = stringColumns[0]?.name || table.columns[0]?.name || '';
  const defaultNumeric = numericColumns[0]?.name || table.columns[0]?.name || '';

  // Group columns
  const [groupColumns, setGroupColumns] = useState<string[]>([defaultGroupCol]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Aggregated measures
  const [aggregations, setAggregations] = useState<AggregationItem[]>([
    {
      id: 'agg-1',
      func: numericColumns.length > 0 ? 'SUM' : 'COUNT',
      column: numericColumns.length > 0 ? defaultNumeric : '*',
      alias: numericColumns.length > 0 ? `total_${defaultNumeric}` : 'total_count'
    }
  ]);

  // Having clause
  const [having, setHaving] = useState<HavingCondition>({
    enabled: false,
    func: 'SUM',
    column: defaultNumeric,
    operator: '>',
    value: '1000'
  });

  const [limit, setLimit] = useState<number>(100);

  const addGroupColumn = () => {
    setGenerateError(null);
    const unused = table.columns.find(c => !groupColumns.includes(c.name));
    if (unused) {
      setGroupColumns(prev => [...prev, unused.name]);
    }
  };

  const removeGroupColumn = (col: string) => {
    setGenerateError(null);
    setGroupColumns(prev => prev.filter(c => c !== col));
  };

  const addAggregation = () => {
    setGenerateError(null);
    setAggregations(prev => [
      ...prev,
      {
        id: `agg-${Date.now()}`,
        func: 'COUNT',
        column: '*',
        alias: 'count_all'
      }
    ]);
  };

  const updateAggregation = (id: string, updates: Partial<AggregationItem>) => {
    setGenerateError(null);
    setAggregations(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const query = await DatabaseApiClient.generateAnalysis('generateGroupBy', 
        table.schema,
        table.name,
        groupColumns.length ? groupColumns : [table.columns[0]?.name || 'id'],
        aggregations,
        having.enabled ? having : undefined,
        limit
      );
      onPreviewQuery(query);
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate grouped SQL');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <Layers className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span>
          Aggregate metrics sliced across dimensions with automatic sorting. Filter groups with an optional HAVING condition.
        </span>
      </div>

      {/* 1. Group By Columns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">
            1. Group By Dimension(s):
          </label>
          <button
            onClick={addGroupColumn}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
          >
            <Plus className="w-3 h-3" />
            <span>Add Dimension</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {groupColumns.map((colName, idx) => (
            <div
              key={idx}
              className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
            >
              <select
                value={colName}
                onChange={e => {
                  const val = e.target.value;
                  setGroupColumns(prev => prev.map((c, i) => (i === idx ? val : c)));
                }}
                className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none"
              >
                {table.columns.map(col => (
                  <option key={col.name} value={col.name} className="bg-slate-950">
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>

              {groupColumns.length > 1 && (
                <button
                  onClick={() => removeGroupColumn(colName)}
                  className="text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Measures & Aggregations */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 block">
          2. Metrics & Measures:
        </label>

        {aggregations.map((agg, idx) => (
          <div
            key={agg.id}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
          >
            <span className="text-xs font-mono text-slate-500">M{idx + 1}</span>

            <select
              value={agg.func}
              onChange={e => updateAggregation(agg.id, { func: e.target.value as any })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-cyan-300 focus:outline-none"
            >
              <option value="SUM">SUM</option>
              <option value="COUNT">COUNT</option>
              <option value="COUNT DISTINCT">COUNT DISTINCT</option>
              <option value="AVG">AVG</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
            </select>

            <select
              value={agg.column}
              onChange={e => updateAggregation(agg.id, { column: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none flex-1 min-w-[140px]"
            >
              {agg.func === 'COUNT' && <option value="*">* (All Rows)</option>}
              {table.columns.map(col => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.dataType})
                </option>
              ))}
            </select>

            <input
              type="text"
              value={agg.alias}
              onChange={e => updateAggregation(agg.id, { alias: e.target.value })}
              placeholder="alias_name"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none w-44"
            />

            {aggregations.length > 1 && (
              <button
                onClick={() => setAggregations(prev => prev.filter(a => a.id !== agg.id))}
                className="text-slate-500 hover:text-rose-400 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addAggregation}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 border border-dashed border-cyan-500/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Another Metric</span>
        </button>
      </div>

      {/* 3. HAVING Clause Builder (Optional) */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <label className="flex items-center space-x-2 text-xs font-medium text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={having.enabled}
            onChange={e => setHaving(prev => ({ ...prev, enabled: e.target.checked }))}
            className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
          />
          <span>Include HAVING Filter on Group Results</span>
        </label>

        {having.enabled && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-xs font-semibold text-indigo-400">HAVING</span>

            <select
              value={having.func}
              onChange={e => setHaving(prev => ({ ...prev, func: e.target.value as any }))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-indigo-300 focus:outline-none"
            >
              <option value="SUM">SUM</option>
              <option value="COUNT">COUNT</option>
              <option value="COUNT DISTINCT">COUNT DISTINCT</option>
              <option value="AVG">AVG</option>
            </select>

            <select
              value={having.column}
              onChange={e => setHaving(prev => ({ ...prev, column: e.target.value }))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
            >
              {having.func === 'COUNT' && <option value="*">*</option>}
              {table.columns.map(col => (
                <option key={col.name} value={col.name}>
                  {col.name}
                </option>
              ))}
            </select>

            <select
              value={having.operator}
              onChange={e => setHaving(prev => ({ ...prev, operator: e.target.value as any }))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
            >
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
              <option value="=">=</option>
              <option value="!=">!=</option>
            </select>

            <input
              type="text"
              value={having.value}
              onChange={e => setHaving(prev => ({ ...prev, value: e.target.value }))}
              placeholder="e.g. 50000"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none w-32"
            />
          </div>
        )}
      </div>

      {/* Inline Error Message */}
      {generateError && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      {/* Row limit and preview */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-400">Limit rows:</label>
          <input
            type="number"
            min="1"
            max="1000"
            value={limit}
            onChange={e => setLimit(Math.max(1, parseInt(e.target.value) || 100))}
            className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
          />
        </div>

        <button
          onClick={handlePreview}
          disabled={isGenerating || groupColumns.length === 0}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-cyan-950/40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating SQL...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Grouped SQL</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
