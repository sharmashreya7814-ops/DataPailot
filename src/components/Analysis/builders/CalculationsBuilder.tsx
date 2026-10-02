import React, { useState } from 'react';
import { Plus, Trash2, Calculator, Split, Play, ShieldAlert } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { CaseRule, GeneratedAnalysisQuery } from '../../../types/analysis';
import { classifyColumns, SmartFieldMapper } from '../../../utils/analysisCompatibility';

interface CalculationsBuilderProps {
  table: TableDetailsResult;
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const CalculationsBuilder: React.FC<CalculationsBuilderProps> = ({
  table,
  onPreviewQuery
}) => {
  const [activeTab, setActiveTab] = useState<'case' | 'math'>('case');

  const { numericColumns } = classifyColumns(table.columns);
  const defaultCol = table.columns[0]?.name || '';
  const defaultNum1 = SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || defaultCol;
  const defaultNum2 = SmartFieldMapper.suggestColumn(table.columns, 'quantity') || numericColumns[1]?.name || numericColumns[0]?.name || defaultCol;

  // 1. CASE Builder State
  const [caseTargetCol, setCaseTargetCol] = useState<string>(defaultNum1);
  const [caseRules, setCaseRules] = useState<CaseRule[]>([
    {
      id: 'rule-1',
      column: defaultNum1,
      operator: '>=',
      value: '100000',
      resultLabel: 'High'
    },
    {
      id: 'rule-2',
      column: defaultNum1,
      operator: '>=',
      value: '50000',
      resultLabel: 'Medium'
    }
  ]);
  const [fallbackLabel, setFallbackLabel] = useState<string>('Low');
  const [caseAlias, setCaseAlias] = useState<string>('sales_tier');

  // 2. Calculated Column State
  const [mathCol1, setMathCol1] = useState<string>(defaultNum1);
  const [mathOperator, setMathOperator] = useState<'+' | '-' | '*' | '/'>('*');
  const [mathCol2, setMathCol2] = useState<string>(defaultNum2);
  const [mathAlias, setMathAlias] = useState<string>('computed_metric');

  const addCaseRule = () => {
    setCaseRules(prev => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        column: caseTargetCol,
        operator: '>=',
        value: '10000',
        resultLabel: 'Tier'
      }
    ]);
  };

  const updateCaseRule = (id: string, updates: Partial<CaseRule>) => {
    setCaseRules(prev => prev.map(r => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeCaseRule = (id: string) => {
    setCaseRules(prev => prev.filter(r => r.id !== id));
  };

  const handlePreviewCase = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateCaseCategory', table.schema, table.name, {
      column: caseTargetCol,
      rules: caseRules,
      fallbackLabel,
      alias: caseAlias
    });
    onPreviewQuery(query);
  };

  const handlePreviewMath = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateCalculatedColumn', table.schema, table.name, {
      col1: mathCol1,
      operator: mathOperator,
      col2: mathCol2,
      alias: mathAlias
    });
    onPreviewQuery(query);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('case')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'case'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          <span>Conditional Categorization (CASE / WHEN)</span>
        </button>

        <button
          onClick={() => setActiveTab('math')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'math'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Calculated Columns (Math Expressions)</span>
        </button>
      </div>

      {activeTab === 'case' ? (
        <div className="space-y-5">
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <Split className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>
              Create categorical segmentation buckets (e.g. High / Medium / Low) using verified columns and SQL CASE statements.
            </span>
          </div>

          {/* Target column & alias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Column to Segment:
              </label>
              <select
                value={caseTargetCol}
                onChange={e => {
                  setCaseTargetCol(e.target.value);
                  setCaseRules(prev => prev.map(r => ({ ...r, column: e.target.value })));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
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
                Output Column Alias:
              </label>
              <input
                type="text"
                value={caseAlias}
                onChange={e => setCaseAlias(e.target.value)}
                placeholder="sales_tier"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 block">
              Tier Conditions (Evaluated sequentially in WHEN clauses):
            </label>

            {caseRules.map((rule, idx) => (
              <div
                key={rule.id}
                className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3"
              >
                <span className="text-xs font-mono text-indigo-400 font-bold">WHEN</span>

                <span className="text-xs font-mono text-slate-300">{caseTargetCol}</span>

                <select
                  value={rule.operator}
                  onChange={e => updateCaseRule(rule.id, { operator: e.target.value as '>=' | '>' | '<=' | '<' | '=' | '!=' | 'LIKE' })}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none"
                >
                  <option value=">=">&gt;=</option>
                  <option value=">">&gt;</option>
                  <option value="<=">&lt;=</option>
                  <option value="<">&lt;</option>
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value="LIKE">LIKE</option>
                </select>

                <input
                  type="text"
                  value={rule.value}
                  onChange={e => updateCaseRule(rule.id, { value: e.target.value })}
                  placeholder="Threshold value"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none w-36"
                />

                <span className="text-xs font-mono text-indigo-400 font-bold">THEN</span>

                <input
                  type="text"
                  value={rule.resultLabel}
                  onChange={e => updateCaseRule(rule.id, { resultLabel: e.target.value })}
                  placeholder="Label (e.g. High)"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-300 font-semibold focus:outline-none flex-1 min-w-[120px]"
                />

                {caseRules.length > 1 && (
                  <button
                    onClick={() => removeCaseRule(rule.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addCaseRule}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30 border border-dashed border-indigo-500/40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another WHEN Tier</span>
            </button>

            {/* Fallback Else */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3">
              <span className="text-xs font-mono text-indigo-400 font-bold">ELSE</span>
              <input
                type="text"
                value={fallbackLabel}
                onChange={e => setFallbackLabel(e.target.value)}
                placeholder="Fallback label (e.g. Low, Other)"
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none w-64"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewCase}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview CASE Category SQL</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <Calculator className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>
              Safely compute values between verified numeric columns (e.g. quantity * price, revenue - cost). Division by zero is automatically guarded with PostgreSQL NULLIF().
            </span>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Column 1:</label>
                <select
                  value={mathCol1}
                  onChange={e => setMathCol1(e.target.value)}
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
                <label className="text-xs font-medium text-slate-300 block mb-1">Operator:</label>
                <select
                  value={mathOperator}
                  onChange={e => setMathOperator(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-cyan-400 focus:outline-none"
                >
                  <option value="*">* (Multiply: e.g. qty * price)</option>
                  <option value="-">- (Subtract: e.g. revenue - cost)</option>
                  <option value="+">+ (Add: e.g. price + tax)</option>
                  <option value="/">/ (Divide: e.g. revenue / quantity)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Column 2:</label>
                <select
                  value={mathCol2}
                  onChange={e => setMathCol2(e.target.value)}
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
                <label className="text-xs font-medium text-slate-300 block mb-1">Output Alias:</label>
                <input
                  type="text"
                  value={mathAlias}
                  onChange={e => setMathAlias(e.target.value)}
                  placeholder="e.g. gross_profit"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handlePreviewMath}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-950/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Calculated Column SQL</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
