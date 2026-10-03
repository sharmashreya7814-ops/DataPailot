import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Database, Filter, Search, Download, GitMerge, FileSpreadsheet, 
  AlertTriangle, Link, CheckCircle, Info, Key, Hash, X, RefreshCw, 
  Code2, Map, Layers, Check, Copy, ArrowRight, Eye, ShieldAlert
} from 'lucide-react';
import { DiscoveredTable, TableDetailsResult, DatabaseRelationship } from '../../types/database';
import { LineageGraph } from './LineageGraph';
import { exportLineageToExcel, exportLineageToJson, exportLineageToCsv } from './exportUtils';
import { findJoinPath, generateJoinSql } from './joinPathUtils';
import { detectOrphans } from './orphanDetector';

interface DataLineageWorkspaceProps {
  tables: DiscoveredTable[];
  relationships: DatabaseRelationship[];
  tableDetailsCache: Record<string, TableDetailsResult>;
  onSelectTable: (table: DiscoveredTable) => void;
  onLoadTableDetails: (schema: string, name: string) => Promise<void>;
}

export const DataLineageWorkspace: React.FC<DataLineageWorkspaceProps> = ({
  tables,
  relationships,
  tableDetailsCache,
  onSelectTable,
  onLoadTableDetails
}) => {
  const [activeTab, setActiveTab] = useState<'graph' | 'overview' | 'pathfinder' | 'orphans'>('graph');
  const [selectedNode, setSelectedNode] = useState<string | null>(null); // format: schema.name
  const [tableFilter, setTableFilter] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);
  
  // Path finder state
  const [pathFrom, setPathFrom] = useState<string>('');
  const [pathTo, setPathTo] = useState<string>('');

  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    switch (format) {
      case 'json':
        exportLineageToJson(tables, relationships, tableDetailsCache);
        break;
      case 'csv':
        exportLineageToCsv(tables, relationships);
        break;
      case 'excel':
        exportLineageToExcel(tables, relationships, tableDetailsCache);
        break;
    }
  };

  const orphans = useMemo(() => detectOrphans(tables, relationships), [tables, relationships]);

  const joinPath = useMemo(() => {
    if (!pathFrom || !pathTo || pathFrom === pathTo) return null;
    return findJoinPath(pathFrom, pathTo, tables, relationships);
  }, [pathFrom, pathTo, tables, relationships]);

  const filteredTables = useMemo(() => {
    if (!tableFilter.trim()) return tables;
    const q = tableFilter.toLowerCase();
    return tables.filter(t => t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q));
  }, [tables, tableFilter]);

  const handleCopyJoinSql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-300 select-none overflow-hidden">
      {/* LEFT SIDEBAR - Controls & Navigation */}
      <div className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center tracking-tight">
              <Map className="w-4 h-4 mr-2 text-cyan-400" />
              Data Lineage
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              {tables.length} Tables
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Schema dependencies, relationships, and join paths
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60">
          <button 
            onClick={() => setActiveTab('graph')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'graph' 
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Graph
          </button>
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview' 
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('pathfinder')}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pathfinder' 
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' 
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Join Path
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto datapilot-scrollbar">
          {/* TAB 1: GRAPH ACTIVE OVERVIEW */}
          {activeTab === 'graph' && (
            <div className="p-3.5 space-y-4">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Relationships</span>
                  <span className="text-base font-bold text-cyan-400 font-mono mt-0.5">{relationships.length}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Active FK links</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Orphan Tables</span>
                  <span className="text-base font-bold text-amber-400 font-mono mt-0.5">{orphans.disconnectedTables.length}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Standalone nodes</span>
                </div>
              </div>

              {/* Quick Search & Focus List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Table Focus
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{filteredTables.length}</span>
                </div>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={tableFilter}
                    onChange={e => setTableFilter(e.target.value)}
                    placeholder="Search table node..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-cyan-500 hover:border-slate-700 transition-colors font-mono"
                  />
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto datapilot-scrollbar pr-0.5">
                  {filteredTables.map(t => {
                    const nodeKey = `${t.schema}.${t.name}`;
                    const isSelected = selectedNode === nodeKey;
                    return (
                      <button
                        key={nodeKey}
                        onClick={() => setSelectedNode(nodeKey)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-semibold'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <Database className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-cyan-400' : 'text-indigo-400'}`} />
                          <span className="truncate font-mono text-xs">{t.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">
                          {t.approximateRowCount !== undefined ? `${t.approximateRowCount.toLocaleString()}r` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Helpful Hint */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 text-[11px] leading-relaxed flex items-start space-x-2">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>
                  Click any node on the graph or table in the focus list to inspect direct schema dependencies, columns, and relations.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Schema Catalog</h3>
                <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                  {tables.length} tables
                </span>
              </div>
              <div className="space-y-1.5">
                {tables.map(t => (
                  <button 
                    key={`${t.schema}.${t.name}`}
                    onClick={() => {
                      setSelectedNode(`${t.schema}.${t.name}`);
                      setActiveTab('graph');
                    }}
                    className="w-full text-left px-3 py-2 text-xs bg-slate-950/60 hover:bg-slate-800 rounded-lg border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors font-mono">
                        {t.name}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {t.approximateRowCount?.toLocaleString() || 0} rows
                      </span>
                    </div>
                    {t.schema && t.schema !== 'public' && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Schema: {t.schema}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: JOIN PATHFINDER */}
          {activeTab === 'pathfinder' && (
            <div className="p-3.5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center uppercase tracking-wider">
                  <GitMerge className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Join Path Finder
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Calculate shortest foreign key path between tables.</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">From Table</label>
                  <select 
                    value={pathFrom} 
                    onChange={e => setPathFrom(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-800 text-xs rounded-md p-2 text-slate-200 focus:outline-hidden focus:border-cyan-500 hover:border-slate-700 transition-colors cursor-pointer font-mono"
                  >
                    <option value="">— Select source table —</option>
                    {tables.map(t => (
                      <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                        {t.name} {t.schema !== 'public' ? `(${t.schema})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">To Table</label>
                  <select 
                    value={pathTo} 
                    onChange={e => setPathTo(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-800 text-xs rounded-md p-2 text-slate-200 focus:outline-hidden focus:border-cyan-500 hover:border-slate-700 transition-colors cursor-pointer font-mono"
                  >
                    <option value="">— Select target table —</option>
                    {tables.map(t => (
                      <option key={`${t.schema}.${t.name}`} value={`${t.schema}.${t.name}`}>
                        {t.name} {t.schema !== 'public' ? `(${t.schema})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {joinPath && joinPath.length > 0 ? (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-200">Join Sequence ({joinPath.length} step{joinPath.length > 1 ? 's' : ''})</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Valid Path
                    </span>
                  </div>
                  <div className="space-y-2">
                    {joinPath.map((step, idx) => (
                      <div key={idx} className="text-xs font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-300 space-y-1">
                        <div className="text-cyan-400 font-semibold flex items-center space-x-1">
                          <span>Step {idx + 1}:</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                        </div>
                        <div className="text-[11px] text-slate-300 pl-1">
                          <span className="text-indigo-300">{step.sourceTable}</span>.{step.sourceColumn}
                          <span className="text-slate-500 mx-1.5">=</span>
                          <span className="text-emerald-300">{step.targetTable}</span>.{step.targetColumn}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        const sql = generateJoinSql(pathFrom, pathTo, joinPath);
                        handleCopyJoinSql(sql);
                      }}
                      className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied JOIN SQL to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Copy Generated JOIN SQL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (pathFrom && pathTo && pathFrom !== pathTo) ? (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-300 flex items-start">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 text-rose-400 mt-0.5" />
                  <span>No foreign key relationship path found between these tables.</span>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 4: ORPHANS & ANOMALIES */}
          {activeTab === 'orphans' && (
            <div className="p-3.5 space-y-4">
              <h3 className="text-xs font-bold text-white flex items-center uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Schema Anomalies & Orphans
              </h3>
              
              <div className="space-y-3">
                {orphans.disconnectedTables.length > 0 && (
                  <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-amber-300">Disconnected Tables</div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {orphans.disconnectedTables.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">Tables with no foreign key references</div>
                    <div className="flex flex-wrap gap-1">
                      {orphans.disconnectedTables.map(t => (
                        <span key={t} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] font-mono text-slate-300">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {orphans.brokenRelationships.length > 0 && (
                  <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-rose-300">Broken Relationships</div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {orphans.brokenRelationships.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-400/80">Foreign keys pointing to missing tables/columns</div>
                    <ul className="space-y-1">
                      {orphans.brokenRelationships.map((br, i) => (
                        <li key={i} className="text-xs text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-900/40 font-mono">
                          {br}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {orphans.disconnectedTables.length === 0 && orphans.brokenRelationships.length === 0 && (
                  <div className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 p-3 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>All tables and relationships are fully connected without schema anomalies.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Export & Actions Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
          <button 
            onClick={() => setActiveTab('orphans')} 
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
              activeTab === 'orphans'
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-850 border-slate-800'
            }`}
          >
            <span className="flex items-center">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-400" /> 
              <span>Orphans / Issues</span>
            </span>
            <span className="bg-slate-800 px-1.5 py-0.2 rounded-full text-[10px] font-mono text-slate-300">
              {orphans.brokenRelationships.length}
            </span>
          </button>
          
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button 
              onClick={() => handleExport('json')} 
              className="flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              title="Export Lineage Schema as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button 
              onClick={() => handleExport('excel')} 
              className="flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/50 hover:bg-emerald-900/60 rounded-lg border border-emerald-800/50 transition-colors cursor-pointer"
              title="Export Lineage Schema as Multi-Sheet Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT MAIN - Graph & Details */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative bg-slate-950">
          <LineageGraph 
            tables={tables} 
            relationships={relationships} 
            selectedNode={selectedNode}
            onSelectNode={(nodeId) => {
              setSelectedNode(nodeId);
              if (nodeId) {
                const [s, n] = nodeId.split('.');
                if (!tableDetailsCache[nodeId]) {
                  onLoadTableDetails(s, n);
                }
              }
            }}
          />
        </div>

        {/* Bottom Details Panel (when a node is selected) */}
        {selectedNode && (
          <div className="h-64 border-t border-slate-800 bg-slate-900/95 flex flex-col shadow-2xl relative z-10 animate-in slide-in-from-bottom-3 backdrop-blur-xs select-text">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white font-mono">{selectedNode}</h3>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Inspected Node
                </span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)} 
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close Details Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex gap-6 datapilot-scrollbar">
              {/* Direct Dependencies */}
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Direct Dependencies (Outgoing)</h4>
                <div className="space-y-1.5">
                  {relationships.filter(r => `${r.sourceSchema}.${r.sourceTable}` === selectedNode).map(r => (
                    <div key={r.constraintName} className="text-xs bg-slate-950/80 border border-slate-800/80 p-2 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 truncate">
                        <Link className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        <span className="text-slate-300 font-mono">{r.sourceColumn}</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-emerald-300 font-mono font-medium">{r.targetTable}.{r.targetColumn}</span>
                      </div>
                    </div>
                  ))}
                  {relationships.filter(r => `${r.sourceSchema}.${r.sourceTable}` === selectedNode).length === 0 && (
                    <div className="text-xs text-slate-400 italic bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      No outgoing foreign keys.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Referenced By */}
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Referenced By (Incoming)</h4>
                <div className="space-y-1.5">
                  {relationships.filter(r => `${r.targetSchema}.${r.targetTable}` === selectedNode).map(r => (
                    <div key={r.constraintName} className="text-xs bg-slate-950/80 border border-slate-800/80 p-2 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 truncate">
                        <Link className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <span className="text-indigo-300 font-mono font-medium">{r.sourceSchema}.{r.sourceTable}</span>
                        <span className="text-slate-600">via</span>
                        <span className="text-slate-300 font-mono">{r.sourceColumn}</span>
                      </div>
                    </div>
                  ))}
                  {relationships.filter(r => `${r.targetSchema}.${r.targetTable}` === selectedNode).length === 0 && (
                    <div className="text-xs text-slate-400 italic bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      No incoming references.
                    </div>
                  )}
                </div>
              </div>

              {/* Columns */}
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Columns</h4>
                {tableDetailsCache[selectedNode] ? (
                  <div className="space-y-1 max-h-44 overflow-y-auto datapilot-scrollbar pr-1">
                    {tableDetailsCache[selectedNode].columns.map(c => (
                      <div key={c.name} className="text-xs flex items-center justify-between p-1.5 bg-slate-950/60 border border-slate-800/60 rounded">
                        <div className="flex items-center space-x-1.5 truncate">
                          {c.isPrimaryKey ? (
                            <Key className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          ) : (
                            <Hash className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          )}
                          <span className={`font-mono truncate ${c.isPrimaryKey ? 'text-amber-200 font-semibold' : 'text-slate-300'}`}>
                            {c.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 ml-2">{c.dataType}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 flex items-center space-x-1.5 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                    <span>Loading column metadata...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
