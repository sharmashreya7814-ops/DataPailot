import React, { useState } from 'react';
import { Plus, Trash2, Sigma, Play, Hash, Loader2, AlertCircle } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { AggregationItem, GeneratedAnalysisQuery } from '../../../types/analysis';
import { classifyColumns } from '../../../utils/analysisCompatibility';

interface AggregationBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const AggregationBuilder: React.FC<AggregationBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const { numericColumns } = classifyColumns(table.columns);
  const defaultNumeric = numericColumns[0]?.name || table.columns[0]?.name || '*';
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [aggregations, setAggregations] = useState<AggregationItem[]>([
    {
      id: 'agg-1',
      func: 'COUNT',
      column: '*',
      alias: 'total_records'
    },
    ...(numericColumns.length > 0
      ? [
          {
            id: 'agg-2',
            func: 'SUM' as const,
            column: defaultNumeric,
            alias: `total_${defaultNumeric}`
          }
        ]
      : [])
  ]);

  const addAggregation = () => {
    setAggregations(prev => [
      ...prev,
      {
        id: `agg-${Date.now()}`,
        func: 'AVG',
        column: defaultNumeric,
        alias: `avg_${defaultNumeric}`
      }
    ]);
  };

  const removeAggregation = (id: string) => {
    setAggregations(prev => prev.filter(a => a.id !== id));
  };

  const updateAggregation = (id: string, updates: Partial<AggregationItem>) => {
    setGenerateError(null);
    setAggregations(prev =>
      prev.map(a => {
        if (a.id === id) {
          const updated = { ...a, ...updates };
          if (updates.func || updates.column) {
            const funcPrefix = (updates.func || a.func).toLowerCase().replace(/\s+/g, '_');
            const colSuffix = (updates.column || a.column).replace(/\*/g, 'all');
            if (!updates.alias) {
              updated.alias = `${funcPrefix}_${colSuffix}`;
            }
          }
          return updated;
        }
        return a;
      })
    );
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const query = await DatabaseApiClient.generateAnalysis('generateAggregation', 
        table.schema,
        table.name,
        aggregations
      );
      onPreviewQuery(query);
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate aggregation SQL');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <Sigma className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>
          Calculate summary statistics across all table rows without grouping. Add measures to compute sums, averages, counts, or bounds.
        </span>
      </div>

      <div className="space-y-3">
        {aggregations.map((agg, idx) => (
          <div
            key={agg.id}
            className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
          >
            <span className="text-xs font-mono text-slate-500 w-5">#{idx + 1}</span>

            {/* Function selector */}
            <div className="w-40">
              <label className="text-[10px] text-slate-400 block mb-1">Function:</label>
              <select
                value={agg.func}
                onChange={e => updateAggregation(agg.id, { func: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="COUNT">COUNT</option>
                <option value="COUNT DISTINCT">COUNT DISTINCT</option>
                <option value="SUM">SUM</option>
                <option value="AVG">AVG (Average)</option>
                <option value="MIN">MIN (Minimum)</option>
                <option value="MAX">MAX (Maximum)</option>
              </select>
            </div>

            {/* Target Measure Column */}
            <div className="flex-1 min-w-[180px]">
              <label className="text-[10px] text-slate-400 block mb-1">Target Column:</label>
              <select
                value={agg.column}
                onChange={e => updateAggregation(agg.id, { column: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {agg.func === 'COUNT' && <option value="*">* (All Rows)</option>}
                {table.columns.map(col => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Output Alias */}
            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] text-slate-400 block mb-1">Output Alias (Label):</label>
              <input
                type="text"
                value={agg.alias}
                onChange={e => updateAggregation(agg.id, { alias: e.target.value })}
                placeholder="alias_name"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Remove button */}
            <div className="pt-4">
              <button
                onClick={() => removeAggregation(agg.id)}
                disabled={aggregations.length === 1}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded disabled:opacity-30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addAggregation}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-dashed border-emerald-500/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Another Metric</span>
        </button>
      </div>

      {/* Inline Error Message */}
      {generateError && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handlePreview}
          disabled={isGenerating || aggregations.length === 0}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-950/40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating SQL...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Aggregation SQL</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
