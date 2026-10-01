import React, { useState } from 'react';
import { Database, ShieldCheck, Check, X, Bookmark, Loader2 } from 'lucide-react';
import { DatabaseApiClient } from '../../services/databaseApi';
import { SanitizedConnectionInfo, SavedDatabaseConnection } from '../../types/database';

interface SaveConnectionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionInfo: SanitizedConnectionInfo | null;
  lastConnectedParams?: {
    type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    defaultSchema?: string;
    ssl?: boolean;
    filePath?: string;
  } | null;
  onSaved?: (saved: SavedDatabaseConnection) => void;
}

export const SaveConnectionPromptModal: React.FC<SaveConnectionPromptModalProps> = ({
  isOpen,
  onClose,
  connectionInfo,
  lastConnectedParams,
  onSaved
}) => {
  const defaultName = connectionInfo
    ? `${connectionInfo.database || 'Database'} (${connectionInfo.type || 'SQL'})`
    : 'My Database';

  const [connectionName, setConnectionName] = useState(defaultName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !connectionInfo) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionName.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const saved = await DatabaseApiClient.saveConnection({
        name: connectionName.trim(),
        type: (connectionInfo.type as any) || lastConnectedParams?.type || 'postgresql',
        host: connectionInfo.host || lastConnectedParams?.host,
        port: connectionInfo.port || lastConnectedParams?.port,
        database: connectionInfo.database || lastConnectedParams?.database,
        username: connectionInfo.username || lastConnectedParams?.username,
        password: lastConnectedParams?.password || '',
        defaultSchema: lastConnectedParams?.defaultSchema || 'public',
        ssl: connectionInfo.ssl ?? lastConnectedParams?.ssl ?? false,
        filePath: lastConnectedParams?.filePath
      });

      onSaved?.(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save connection profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl text-slate-200 overflow-hidden space-y-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Save Database Connection</h3>
              <p className="text-xs text-slate-400">Save this connection profile for fast one-click access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 space-y-2">
          <div className="text-xs text-slate-300">
            Database connected successfully. Would you like to save this connection for future use?
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between">
            <div className="truncate">
              <span className="font-semibold text-emerald-300">{connectionInfo.database}</span>
              <span className="text-slate-500 ml-1.5 font-sans">({connectionInfo.type})</span>
            </div>
            <span className="text-[11px] text-slate-500">{connectionInfo.username}@{connectionInfo.host}</span>
          </div>
        </div>

        {/* Save Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Connection Name
            </label>
            <input
              type="text"
              required
              value={connectionName}
              onChange={e => setConnectionName(e.target.value)}
              placeholder="e.g. Local PostgreSQL or Analytics DB"
              autoFocus
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>Credentials are securely encrypted on the server with AES-256-GCM.</span>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Not Now
            </button>
            <button
              type="submit"
              disabled={isSaving || !connectionName.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Connection'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
