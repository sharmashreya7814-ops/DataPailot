import React, { useState } from 'react';
import { Plus, Trash2, Filter, Play, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { FilterCondition, GeneratedAnalysisQuery } from '../../../types/analysis';

interface FilterBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({ table, onPreviewQuery }) => {
  const [filters, setFilters] = useState<FilterCondition[]>([
    {
      id: 'f-1',
      column: table.columns[0]?.name || '',
      operator: '=',
      value: '',
      logic: 'AND'
    }
  ]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Sync filter columns when table changes
  React.useEffect(() => {
    if (table && table.columns && table.columns.length > 0) {
      setFilters(prev => {
        const validColNames = new Set(table.columns.map(c => c.name));
        const firstCol = table.columns[0].name;
        return prev.map(f => ({
          ...f,
          column: validColNames.has(f.column) ? f.column : firstCol
        }));
      });
    }
  }, [table?.schema, table?.name]);

  const addFilter = () => {
    setFilters(prev => [
      ...prev,
      {
        id: `f-${Date.now()}`,
        column: table.columns[0]?.name || '',
        operator: '=',
        value: '',
        logic: 'AND'
      }
    ]);
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setGenerateError(null);
    setFilters(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handlePreview = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const activeFilters = filters.filter(
        f => f.column && (['IS NULL', 'IS NOT NULL'].includes(f.operator) || String(f.value ?? '').trim().length > 0)
      );
      const query = await DatabaseApiClient.generateAnalysis('generateFilterQuery', 
        table.schema,
        table.name,
        activeFilters,
        selectedColumns,
        limit
      );
      onPreviewQuery(query);
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate filter SQL');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Description */}
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <Filter className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          Construct multi-condition filters using verified columns. Input values are automatically sanitized and safely escaped for PostgreSQL.
        </span>
      </div>

      {/* Filter Conditions List */}
      <div className="space-y-3">
        {filters.map((filter, index) => (
          <div
            key={filter.id}
            className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
          >
            {/* Logic prefix (AND / OR) for filters after the first */}
            {index > 0 ? (
              <select
                value={filter.logic}
                onChange={e => updateFilter(filter.id, { logic: e.target.value as 'AND' | 'OR' })}
                className="bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded px-2.5 py-1.5 focus:outline-none"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            ) : (
              <span className="text-xs font-semibold text-slate-400 px-2.5 py-1.5">WHERE</span>
            )}

            {/* Column select */}
            <select
              value={filter.column}
              onChange={e => updateFilter(filter.id, { column: e.target.value })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 flex-1 min-w-[150px]"
            >
              {table.columns.map(col => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.dataType})
                </option>
              ))}
            </select>

            {/* Operator select */}
            <select
              value={filter.operator}
              onChange={e => updateFilter(filter.id, { operator: e.target.value as any })}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 min-w-[120px]"
            >
              <option value="=">=</option>
              <option value="!=">!= (not equal)</option>
              <option value=">">&gt; (greater than)</option>
              <option value=">=">&gt;= (greater than or equal)</option>
              <option value="<">&lt; (less than)</option>
              <option value="<=">&lt;= (less than or equal)</option>
              <option value="LIKE">LIKE / CONTAINS</option>
              <option value="IN">IN (comma-separated)</option>
              <option value="NOT IN">NOT IN</option>
              <option value="BETWEEN">BETWEEN</option>
              <option value="IS NULL">IS NULL</option>
              <option value="IS NOT NULL">IS NOT NULL</option>
            </select>

            {/* Value inputs (unless IS NULL / IS NOT NULL) */}
            {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
              <div className="flex items-center space-x-2 flex-1 min-w-[160px]">
                <input
                  type="text"
                  placeholder={filter.operator === 'IN' ? 'val1, val2, val3' : 'Enter value...'}
                  value={filter.value}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />

                {filter.operator === 'BETWEEN' && (
                  <>
                    <span className="text-xs text-slate-400">AND</span>
                    <input
                      type="text"
                      placeholder="Upper bound..."
                      value={filter.value2 || ''}
                      onChange={e => updateFilter(filter.id, { value2: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </>
                )}
              </div>
            )}

            {/* Delete button */}
            <button
              onClick={() => removeFilter(filter.id)}
              disabled={filters.length === 1}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded disabled:opacity-30 transition-colors"
              title="Remove condition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Add condition button */}
        <button
          onClick={addFilter}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 border border-dashed border-indigo-500/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Filter Condition</span>
        </button>
      </div>

      {/* Inline Error Message */}
      {generateError && (
        <div role="alert" className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      {/* Row limit control & Generate button */}
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
          id="btn-preview-filtered-sql"
          onClick={handlePreview}
          disabled={isGenerating}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-950/40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating SQL...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Filtered SQL</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
