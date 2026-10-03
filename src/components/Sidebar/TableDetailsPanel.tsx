import React from 'react';
import {
  Table as TableIcon,
  Key,
  Link2,
  X,
  Layers,
  ArrowRight,
  Hash,
  Copy,
  Plus
} from 'lucide-react';
import { TableDetailsResult } from '../../types/database';

interface TableDetailsPanelProps {
  tableDetails: TableDetailsResult | null;
  isLoading: boolean;
  onClose: () => void;
  onInsertColumnToQuery: (columnIdentifier: string) => void;
  onSelectReferencedTable?: (schema: string, tableName: string) => void;
}

export const TableDetailsPanel: React.FC<TableDetailsPanelProps> = ({
  tableDetails,
  isLoading,
  onClose,
  onInsertColumnToQuery,
  onSelectReferencedTable
}) => {
  if (!tableDetails && !isLoading) return null;

  return (
    <div
      id="table-details-panel"
      className="border-t border-slate-800 bg-slate-950/95 flex flex-col text-slate-200 select-none max-h-72 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center space-x-2 truncate">
          <TableIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <div className="truncate">
            <span className="text-xs font-semibold text-white truncate">
              {tableDetails?.name || 'Loading table details...'}
            </span>
            {tableDetails && (
              <span className="ml-1.5 text-[10px] text-slate-400 font-mono">
                ({tableDetails.schema})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {tableDetails && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {tableDetails.type}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Close details"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 flex flex-col items-center justify-center text-slate-400 text-xs">
          <div className="w-5 h-5 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin mb-2" />
          <span>Introspecting table schema...</span>
        </div>
      ) : tableDetails ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Metadata chips */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              <Hash className="w-3 h-3 text-slate-500" />
              <span>{tableDetails.columnCount} columns</span>
            </span>
            {tableDetails.approximateRowCount !== undefined && (
              <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                <span>~{tableDetails.approximateRowCount.toLocaleString()} rows</span>
              </span>
            )}
          </div>

          {/* Columns List */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
              <span>Columns (click to insert into query)</span>
            </div>
            <div className="space-y-1">
              {tableDetails.columns.map(col => {
                const quotedIdentifier = `"${col.name}"`;
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => onInsertColumnToQuery(quotedIdentifier)}
                    className="w-full text-left flex items-center justify-between p-1.5 rounded hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-colors group"
                    title={`Click to insert "${col.name}" into SQL editor`}
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      {col.isPrimaryKey ? (
                        <span title="Primary Key" className="flex items-center"><Key className="w-3 h-3 text-amber-400 flex-shrink-0" /></span>
                      ) : col.isForeignKey ? (
                        <span title="Foreign Key" className="flex items-center"><Link2 className="w-3 h-3 text-sky-400 flex-shrink-0" /></span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                      )}
                      <span className="text-xs text-slate-200 font-mono truncate group-hover:text-emerald-300" title={col.name}>
                        {col.name}
                      </span>
                      {col.isPrimaryKey && (
                        <span className="text-[9px] px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-mono">
                          PK
                        </span>
                      )}
                      {col.isForeignKey && (
                        <span className="text-[9px] px-1 py-0.2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded font-mono">
                          FK
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500">
                      <span className="text-slate-400">{col.dataType}</span>
                      <span>{col.isNullable ? 'NULL' : 'NOT NULL'}</span>
                      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400 ml-1 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirmed Database Relationships */}
          {tableDetails.outgoingRelationships.length > 0 && (
            <div className="border-t border-slate-800/80 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Link2 className="w-3 h-3 text-sky-400" />
                <span>Confirmed Foreign Key Relationships</span>
              </div>
              <div className="space-y-1">
                {tableDetails.outgoingRelationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-1 truncate">
                      <span className="text-sky-300 truncate">{rel.sourceColumn}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      <button
                        type="button"
                        onClick={() => onSelectReferencedTable?.(rel.targetSchema, rel.targetTable)}
                        className="text-emerald-400 hover:underline truncate"
                      >
                        {rel.targetTable}.{rel.targetColumn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incoming relationships (references from other tables) */}
          {tableDetails.incomingRelationships.length > 0 && (
            <div className="border-t border-slate-800/80 pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-400" />
                <span>Referenced by Tables</span>
              </div>
              <div className="space-y-1">
                {tableDetails.incomingRelationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center space-x-1"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectReferencedTable?.(rel.sourceSchema, rel.sourceTable)}
                      className="text-emerald-400 hover:underline truncate"
                    >
                      {rel.sourceTable}.{rel.sourceColumn}
                    </button>
                    <ArrowRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-400">{rel.targetColumn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
