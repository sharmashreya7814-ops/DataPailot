import React, { useState } from 'react';
import {
  ShieldAlert,
  Copy,
  Hash,
  Search,
  CheckCircle2,
  Percent,
  Play,
  BarChart,
  Table as TableIcon
} from 'lucide-react';
import { TableDetailsResult } from '../../../types/database';
import { GeneratedAnalysisQuery } from '../../../types/analysis';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { classifyColumns, SmartFieldMapper } from '../../../utils/analysisCompatibility';

interface DataQualityBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const DataQualityBuilder: React.FC<DataQualityBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const { numericColumns } = classifyColumns(table.columns);

  const [activeTool, setActiveTool] = useState<
    'row_count' | 'null_analysis' | 'duplicates' | 'column_profile' | 'numeric_summary'
  >('null_analysis');

  // Parameters
  const [targetColumn, setTargetColumn] = useState<string>(table.columns[0]?.name || '');
  const [duplicateCols, setDuplicateCols] = useState<string[]>([table.columns[0]?.name || '']);
  const [numericCol, setNumericCol] = useState<string>(
    SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || table.columns[0]?.name || ''
  );

  const toggleDuplicateCol = (colName: string) => {
    setDuplicateCols(prev =>
      prev.includes(colName)
        ? prev.length > 1
          ? prev.filter(c => c !== colName)
          : prev
        : [...prev, colName]
    );
  };

  const handlePreview = async () => {
    let query: GeneratedAnalysisQuery;

    switch (activeTool) {
      case 'row_count':
        query = await DatabaseApiClient.generateAnalysis('generateRowCount', table.schema, table.name);
        break;
      case 'null_analysis':
        query = await DatabaseApiClient.generateAnalysis('generateNullAnalysis', table.schema, table.name, targetColumn);
        break;
      case 'duplicates':
        query = await DatabaseApiClient.generateAnalysis('generateDuplicateDetection', table.schema, table.name, duplicateCols);
        break;
      case 'column_profile':
        query = await DatabaseApiClient.generateAnalysis('generateColumnProfile', table.schema, table.name, targetColumn);
        break;
      case 'numeric_summary':
        query = await DatabaseApiClient.generateAnalysis('generateNumericSummary', table.schema, table.name, numericCol);
        break;
    }

    onPreviewQuery(query);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
        <span>
          Audit table hygiene: discover NULL density, detect duplicate composite keys, calculate column health profiles, and compute statistical spreads.
        </span>
      </div>

      {/* Tool Selector Grid */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Select Data Quality Operation:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              id: 'null_analysis',
              title: 'NULL Analysis',
              desc: 'Count NULL occurrences and calculate % missingness in column',
              icon: Percent
            },
            {
              id: 'duplicates',
              title: 'Duplicate Record Detection',
              desc: 'Locate duplicate entries on single or composite keys',
              icon: Copy
            },
            {
              id: 'column_profile',
              title: 'Column Health Profile',
              desc: 'Row count, distinct count, null count, min, and max in 1 query',
              icon: Search
            },
            {
              id: 'numeric_summary',
              title: 'Statistical Summary (Numeric)',
              desc: 'Average, standard deviation, variance, and bounds',
              icon: BarChart
            },
            {
              id: 'row_count',
              title: 'Exact Table Row Count',
              desc: 'Compute real-time exact row count without sampling',
              icon: Hash
            }
          ].map(tool => {
            const Icon = tool.icon;
            const isSelected = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-rose-600/15 border-rose-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-semibold">{tool.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{tool.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameters Panel */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        {['null_analysis', 'column_profile'].includes(activeTool) && (
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Select Column to Inspect:
            </label>
            <select
              value={targetColumn}
              onChange={e => setTargetColumn(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-rose-300 focus:outline-none"
            >
              {table.columns.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.dataType}) {c.isNullable ? '— Nullable' : '— Not Null'}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTool === 'duplicates' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 block">
              Select Column(s) that should be unique (Composite Key):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800 analysis-scroll-dark">
              {table.columns.map(col => {
                const isChecked = duplicateCols.includes(col.name);
                return (
                  <label
                    key={col.name}
                    className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${
                      isChecked ? 'bg-rose-950/40 text-rose-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDuplicateCol(col.name)}
                      className="rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-0"
                    />
                    <span className="truncate font-mono">{col.name}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              Queries will aggregate rows with <code className="text-rose-300 font-mono">COUNT(*) &gt; 1</code> to identify non-unique occurrences.
            </p>
          </div>
        )}

        {activeTool === 'numeric_summary' && (
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Select Numeric Column:
            </label>
            {numericColumns.length > 0 ? (
              <select
                value={numericCol}
                onChange={e => setNumericCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
              >
                {numericColumns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-amber-400">
                No numeric columns detected in {table.name}.
              </p>
            )}
          </div>
        )}

        {activeTool === 'row_count' && (
          <div className="text-xs text-slate-400">
            Will execute <code className="text-emerald-300 font-mono">SELECT COUNT(*) AS total_rows FROM {table.name};</code>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handlePreview}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950/40"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Preview Quality Check SQL</span>
        </button>
      </div>
    </div>
  );
};
