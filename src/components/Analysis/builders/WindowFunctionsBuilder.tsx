import React, { useState } from 'react';
import { Award, Layers, Play, Plus, Trash2, ArrowUpDown } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { WindowFunctionConfig, TopNPerGroupConfig, GeneratedAnalysisQuery } from '../../../types/analysis';
import { classifyColumns, SmartFieldMapper } from '../../../utils/analysisCompatibility';

interface WindowFunctionsBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const WindowFunctionsBuilder: React.FC<WindowFunctionsBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const [activeTab, setActiveTab] = useState<'window' | 'top_per_group'>('top_per_group');

  const { numericColumns, stringColumns } = classifyColumns(table.columns);
  const defaultGroup = SmartFieldMapper.suggestColumn(table.columns, 'dimension') || stringColumns[0]?.name || table.columns[0]?.name || '';
  const defaultNumeric = SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || table.columns[0]?.name || '';

  // Tab 1: Window Function Config
  const [winFunc, setWinFunc] = useState<WindowFunctionConfig['func']>('ROW_NUMBER');
  const [partitionCols, setPartitionCols] = useState<string[]>([defaultGroup]);
  const [orderCol, setOrderCol] = useState<string>(defaultNumeric);
  const [orderDirection, setOrderDirection] = useState<'DESC' | 'ASC'>('DESC');
  const [targetCol, setTargetCol] = useState<string>(defaultNumeric);
  const [ntileBuckets, setNtileBuckets] = useState<number>(4);
  const [alias, setAlias] = useState<string>('rank_value');

  // Tab 2: Top N Per Group Config
  const [groupCol, setGroupCol] = useState<string>(defaultGroup);
  const [rankingCol, setRankingCol] = useState<string>(defaultNumeric);
  const [topN, setTopN] = useState<number>(5);
  const [rankDirection, setRankDirection] = useState<'DESC' | 'ASC'>('DESC');
  const [rankMethod, setRankMethod] = useState<'ROW_NUMBER' | 'DENSE_RANK' | 'RANK'>('ROW_NUMBER');

  const addPartitionCol = () => {
    const unused = table.columns.find(c => !partitionCols.includes(c.name));
    if (unused) setPartitionCols(prev => [...prev, unused.name]);
  };

  const removePartitionCol = (colName: string) => {
    setPartitionCols(prev => prev.filter(c => c !== colName));
  };

  const handlePreviewWindow = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateWindowFunction', table.schema, table.name, {
      func: winFunc,
      partitionColumns: partitionCols,
      orderColumn: orderCol,
      orderDirection,
      targetColumn: targetCol,
      ntileBuckets,
      alias
    });
    onPreviewQuery(query);
  };

  const handlePreviewTopPerGroup = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateTopNPerGroup', table.schema, table.name, {
      groupColumn: groupCol,
      rankingColumn: rankingCol,
      n: topN,
      direction: rankDirection,
      rankingMethod: rankMethod
    });
    onPreviewQuery(query);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('top_per_group')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'top_per_group'
              ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Top N per Group Wizard</span>
        </button>

        <button
          onClick={() => setActiveTab('window')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'window'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Window Functions Builder</span>
        </button>
      </div>

      {activeTab === 'top_per_group' ? (
        <div className="space-y-5">
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Retrieve the top N records within each partition group (e.g. Top 3 highest orders per region, or Top 5 sales per rep) using CTE and window ranking.
            </span>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Group / Partition Column:
                </label>
                <select
                  value={groupCol}
                  onChange={e => setGroupCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none"
                >
                  {table.columns.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.dataType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Ranking Metric Column:
                </label>
                <select
                  value={rankingCol}
                  onChange={e => setRankingCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  {table.columns.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.dataType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Top N Items:
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={topN}
                  onChange={e => setTopN(Math.max(1, parseInt(e.target.value) || 5))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Direction:
                </label>
                <select
                  value={rankDirection}
                  onChange={e => setRankDirection(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  <option value="DESC">Highest First (DESC)</option>
                  <option value="ASC">Lowest First (ASC)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Ranking Method:
                </label>
                <select
                  value={rankMethod}
                  onChange={e => setRankMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  <option value="ROW_NUMBER">ROW_NUMBER (Exact Top N)</option>
                  <option value="DENSE_RANK">DENSE_RANK (Ties Keep Same)</option>
                  <option value="RANK">RANK (Ties Skip Ranks)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewTopPerGroup}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Top N per Group SQL</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <Layers className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>
              Build SQL window calculations (ROW_NUMBER, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, SUM OVER) with partition and order specifications.
            </span>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Window Function:
                </label>
                <select
                  value={winFunc}
                  onChange={e => setWinFunc(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-300 focus:outline-none"
                >
                  <option value="ROW_NUMBER">ROW_NUMBER()</option>
                  <option value="RANK">RANK()</option>
                  <option value="DENSE_RANK">DENSE_RANK()</option>
                  <option value="NTILE">NTILE(n)</option>
                  <option value="LAG">LAG(col, offset)</option>
                  <option value="LEAD">LEAD(col, offset)</option>
                  <option value="FIRST_VALUE">FIRST_VALUE(col)</option>
                  <option value="LAST_VALUE">LAST_VALUE(col)</option>
                  <option value="SUM OVER">SUM(col) OVER</option>
                  <option value="AVG OVER">AVG(col) OVER</option>
                  <option value="COUNT OVER">COUNT(*) OVER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Order By Column:
                </label>
                <select
                  value={orderCol}
                  onChange={e => setOrderCol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  {table.columns.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.dataType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Order Direction:
                </label>
                <select
                  value={orderDirection}
                  onChange={e => setOrderDirection(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  <option value="DESC">DESC</option>
                  <option value="ASC">ASC</option>
                </select>
              </div>
            </div>

            {/* Partition By */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  PARTITION BY (Optional Slice Dimensions):
                </label>
                <button
                  onClick={addPartitionCol}
                  className="text-xs text-indigo-400 hover:underline flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Partition Column</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {partitionCols.map((colName, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs"
                  >
                    <select
                      value={colName}
                      onChange={e => {
                        const val = e.target.value;
                        setPartitionCols(prev => prev.map((c, i) => (i === idx ? val : c)));
                      }}
                      className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none"
                    >
                      {table.columns.map(col => (
                        <option key={col.name} value={col.name} className="bg-slate-950">
                          {col.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removePartitionCol(colName)}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Result Column Alias:
              </label>
              <input
                type="text"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                placeholder="window_result"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewWindow}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Window Function SQL</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
