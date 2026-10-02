import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  Link2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Columns,
  Play,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  TableDetailsResult,
  DiscoveredTable,
  DatabaseRelationship,
  TableColumnInfo
} from '../../../types/database';
import { MultiTableJoinConfig, GeneratedAnalysisQuery } from '../../../types/analysis';
import { DatabaseApiClient } from '../../../services/databaseApi';

interface JoinBuilderProps {
  table: TableDetailsResult;
  allTables: DiscoveredTable[];
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const JoinBuilder: React.FC<JoinBuilderProps> = ({
  table,
  allTables,
  onPreviewQuery
}) => {
  // Join target table selection
  const otherTables = allTables.filter(t => !(t.schema === table.schema && t.name === table.name));
  const [selectedJoinTableKey, setSelectedJoinTableKey] = useState<string>(
    otherTables[0] ? `${otherTables[0].schema}.${otherTables[0].name}` : ''
  );

  const [joinTableDetails, setJoinTableDetails] = useState<TableDetailsResult | null>(null);
  const [isLoadingJoinTable, setIsLoadingJoinTable] = useState(false);

  // All relationships discovered
  const [allRelationships, setAllRelationships] = useState<DatabaseRelationship[]>([]);

  // Join configuration
  const [joinType, setJoinType] = useState<'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN' | 'FULL JOIN'>('INNER JOIN');
  const [baseColumn, setBaseColumn] = useState<string>(table.columns[0]?.name || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [joinColumn, setJoinColumn] = useState<string>('');
  const [allowManualCondition, setAllowManualCondition] = useState(false);

  // Multi-table selected columns
  const [selectedColumns, setSelectedColumns] = useState<{
    tableKey: 'base' | 'join';
    tableName: string;
    column: string;
    alias?: string;
  }[]>([]);

  // Load global database relationships once
  useEffect(() => {
    DatabaseApiClient.getRelationships()
      .then(rels => setAllRelationships(rels))
      .catch(() => {});
  }, []);

  // When join target table changes, fetch its columns
  useEffect(() => {
    if (!selectedJoinTableKey) return;
    const [targetSchema, targetName] = selectedJoinTableKey.split('.');
    if (!targetSchema || !targetName) return;

    setIsLoadingJoinTable(true);
    DatabaseApiClient.getTableDetails(targetSchema, targetName)
      .then(details => {
        setJoinTableDetails(details);
        setJoinColumn(details.columns[0]?.name || '');

        // Auto-select 2 columns from each table for clean default projection
        setSelectedColumns([
          ...table.columns.slice(0, 2).map(c => ({
            tableKey: 'base' as const,
            tableName: table.name,
            column: c.name
          })),
          ...details.columns.slice(0, 2).map(c => ({
            tableKey: 'join' as const,
            tableName: details.name,
            column: c.name
          }))
        ]);
      })
      .catch(err => {
        console.error('Failed to load join table details:', err);
      })
      .finally(() => {
        setIsLoadingJoinTable(false);
      });
  }, [selectedJoinTableKey, table.name]);

  // Find confirmed relationship between base and join table
  const confirmedRel = allRelationships.find(r => {
    if (!joinTableDetails) return false;
    const matchForward =
      r.sourceSchema === table.schema &&
      r.sourceTable === table.name &&
      r.targetSchema === joinTableDetails.schema &&
      r.targetTable === joinTableDetails.name;

    const matchReverse =
      r.sourceSchema === joinTableDetails.schema &&
      r.sourceTable === joinTableDetails.name &&
      r.targetSchema === table.schema &&
      r.targetTable === table.name;

    return matchForward || matchReverse;
  });

  // When confirmed relationship is discovered, auto-populate base and join columns!
  useEffect(() => {
    if (confirmedRel && joinTableDetails) {
      if (confirmedRel.sourceSchema === table.schema && confirmedRel.sourceTable === table.name) {
        setBaseColumn(confirmedRel.sourceColumn);
        setJoinColumn(confirmedRel.targetColumn);
      } else {
        setBaseColumn(confirmedRel.targetColumn);
        setJoinColumn(confirmedRel.sourceColumn);
      }
    }
  }, [confirmedRel, joinTableDetails, table.schema, table.name]);

  const toggleColumnSelection = (tableKey: 'base' | 'join', tableName: string, colName: string) => {
    const exists = selectedColumns.some(c => c.tableKey === tableKey && c.column === colName);
    if (exists) {
      setSelectedColumns(prev => prev.filter(c => !(c.tableKey === tableKey && c.column === colName)));
    } else {
      setSelectedColumns(prev => [...prev, { tableKey, tableName, column: colName }]);
    }
  };

  const handlePreview = async () => {
    if (!joinTableDetails) return;

    setIsGenerating(true);
    setGenerateError(null);
    try {
      const isConfirmed = Boolean(confirmedRel);
      const config: MultiTableJoinConfig = {
        baseTable: { schema: table.schema, name: table.name },
        joinTable: { schema: joinTableDetails.schema, name: joinTableDetails.name },
        joinType,
        baseColumn,
        joinColumn,
        isConfirmedRelationship: isConfirmed,
        confirmedConstraintName: confirmedRel?.constraintName,
        isManualOverride: !isConfirmed && allowManualCondition,
        selectedColumns
      };

      const query = await DatabaseApiClient.generateAnalysis('generateJoin', config);
      onPreviewQuery(query);
    } catch (err: any) {
      setGenerateError(err?.message || 'Failed to generate join SQL');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <GitMerge className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          Combine datasets using verified foreign key relationships. Ambiguous column names are automatically prefixed with table aliases.
        </span>
      </div>

      {/* 1. Base and Join Table Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Base Table (Primary):
          </label>
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 font-semibold flex items-center justify-between">
            <span>{table.schema}.{table.name}</span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
              Alias: t1
            </span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Join Table:
          </label>
          <select
            value={selectedJoinTableKey}
            onChange={e => setSelectedJoinTableKey(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-500"
          >
            {otherTables.map(t => (
              <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                {t.schema}.{t.name} ({t.approximateRowCount !== undefined ? `${t.approximateRowCount} rows` : 'table'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Confirmed Relationship Status Banner */}
      <div className="p-4 rounded-xl border transition-all">
        {confirmedRel ? (
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-lg space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Confirmed Foreign-Key Relationship Discovered</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-mono text-slate-200 bg-slate-950/70 p-2.5 rounded border border-emerald-900/40">
              <span className="text-emerald-300 font-bold">{table.name}.{baseColumn}</span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span className="text-cyan-300 font-bold">{joinTableDetails?.name}.{joinColumn}</span>
              <span className="text-[10px] text-slate-400 ml-auto font-sans">
                Constraint: {confirmedRel.constraintName}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-amber-950/20 border border-amber-500/30 p-3.5 rounded-lg space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>No confirmed foreign key relationship found between these tables</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              We did not find a schema-enforced foreign key constraint between <span className="font-mono text-slate-200">{table.name}</span> and <span className="font-mono text-slate-200">{joinTableDetails?.name || 'join table'}</span>. Inferring joins from column names alone can cause unexpected Cartesian products.
            </p>

            <label className="flex items-center space-x-2 pt-1 text-xs text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={allowManualCondition}
                onChange={e => setAllowManualCondition(e.target.checked)}
                className="rounded border-amber-600 bg-slate-950 text-amber-500 focus:ring-0"
              />
              <span>I understand the risk — Allow custom join condition</span>
            </label>
          </div>
        )}
      </div>

      {/* 3. Join Type & Join Condition */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Join Type:</label>
            <select
              value={joinType}
              onChange={e => setJoinType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-300 focus:outline-none"
            >
              <option value="INNER JOIN">INNER JOIN (Matching only)</option>
              <option value="LEFT JOIN">LEFT JOIN (All Base rows)</option>
              <option value="RIGHT JOIN">RIGHT JOIN (All Join rows)</option>
              <option value="FULL JOIN">FULL JOIN (Complete union)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Base Column ({table.name}):
            </label>
            <select
              value={baseColumn}
              onChange={e => setBaseColumn(e.target.value)}
              disabled={!confirmedRel && !allowManualCondition}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none disabled:opacity-40"
            >
              {table.columns.map(col => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.dataType})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center pt-5">
            <span className="text-xs font-bold text-slate-400 font-mono">=</span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Join Column ({joinTableDetails?.name || 'join table'}):
            </label>
            <select
              value={joinColumn}
              onChange={e => setJoinColumn(e.target.value)}
              disabled={(!confirmedRel && !allowManualCondition) || !joinTableDetails}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none disabled:opacity-40"
            >
              {joinTableDetails?.columns.map(col => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.dataType})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Multi-Table Column Selector */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Columns className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold text-slate-300">
              Select Output Columns from Both Tables ({selectedColumns.length} selected):
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base table column list */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center justify-between">
              <span>{table.name} (t1)</span>
              <span className="text-[10px] text-slate-500">{table.columns.length} columns</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {table.columns.map(c => {
                const isSelected = selectedColumns.some(sc => sc.tableKey === 'base' && sc.column === c.name);
                return (
                  <label
                    key={c.name}
                    className={`flex items-center space-x-2 p-1 rounded text-xs cursor-pointer font-mono ${
                      isSelected ? 'bg-emerald-950/40 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleColumnSelection('base', table.name, c.name)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-0"
                    />
                    <span>{c.name}</span>
                    <span className="text-[10px] text-slate-500 font-sans">({c.dataType})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Join table column list */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-xs font-semibold text-cyan-400 mb-2 flex items-center justify-between">
              <span>{joinTableDetails?.name || 'Join Table'} (t2)</span>
              <span className="text-[10px] text-slate-500">
                {joinTableDetails?.columns.length || 0} columns
              </span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {joinTableDetails?.columns.map(c => {
                const isSelected = selectedColumns.some(sc => sc.tableKey === 'join' && sc.column === c.name);
                return (
                  <label
                    key={c.name}
                    className={`flex items-center space-x-2 p-1 rounded text-xs cursor-pointer font-mono ${
                      isSelected ? 'bg-cyan-950/40 text-cyan-200' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleColumnSelection('join', joinTableDetails.name, c.name)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-0"
                    />
                    <span>{c.name}</span>
                    <span className="text-[10px] text-slate-500 font-sans">({c.dataType})</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Inline Error Message */}
      {generateError && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{generateError}</span>
        </div>
      )}

      {/* Generate preview button */}
      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handlePreview}
          disabled={isGenerating || (!confirmedRel && !allowManualCondition) || !joinTableDetails || !baseColumn || !joinColumn}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-950/40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating SQL...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Preview Join SQL</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
