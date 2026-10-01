import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Check,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Lock,
  Bookmark,
  Plus,
  Trash2,
  Edit2,
  Server,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  DatabaseConnectionParams,
  ConnectionTestResult,
  SanitizedConnectionInfo,
  SavedDatabaseConnection
} from '../../types/database';
import { DatabaseApiClient } from '../../services/databaseApi';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (info: SanitizedConnectionInfo, rawParams?: DatabaseConnectionParams) => void;
  currentConnection: SanitizedConnectionInfo | null;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  currentConnection
}) => {
  // Modal view mode: 'saved' | 'new' | 'edit'
  const [activeTab, setActiveTab] = useState<'saved' | 'new' | 'edit'>('new');
  const [savedConnections, setSavedConnections] = useState<SavedDatabaseConnection[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  // Form states
  const [connectionName, setConnectionName] = useState('');
  const [dbType, setDbType] = useState<'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle'>(
    (currentConnection?.type as any) || 'postgresql'
  );
  const [host, setHost] = useState(currentConnection?.host || 'localhost');
  const [port, setPort] = useState(currentConnection?.port ? String(currentConnection.port) : '5432');
  const [database, setDatabase] = useState(currentConnection?.database || 'postgres');
  const [username, setUsername] = useState(currentConnection?.username || 'postgres');
  const [password, setPassword] = useState('');
  const [defaultSchema, setDefaultSchema] = useState('public');
  const [ssl, setSsl] = useState(currentConnection?.ssl ?? false);
  const [filePath, setFilePath] = useState('');
  const [saveOnConnect, setSaveOnConnect] = useState(false);

  // Testing & connecting state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingSavedId, setConnectingSavedId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadSavedConnections = async () => {
    setIsLoadingSaved(true);
    try {
      const list = await DatabaseApiClient.getSavedConnections();
      setSavedConnections(list || []);
      if (list && list.length > 0 && activeTab !== 'edit' && activeTab !== 'new') {
        setActiveTab('saved');
      }
    } catch {
      setSavedConnections([]);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedConnections();
      setConnectError(null);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setConnectError(null);

    const params: DatabaseConnectionParams = {
      type: dbType,
      host: host.trim(),
      port: Number(port) || (dbType === 'mysql' ? 3306 : dbType === 'sqlserver' ? 1433 : dbType === 'oracle' ? 1521 : 5432),
      database: database.trim(),
      username: username.trim(),
      filePath: filePath.trim(),
      password: password,
      ssl
    };

    try {
      const res = await DatabaseApiClient.testConnection(params);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        databaseType: dbType,
        databaseName: database,
        latencyMs: 0,
        error: err.message || 'Connection failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setConnectError(null);

    const params: DatabaseConnectionParams = {
      type: dbType,
      host: host.trim(),
      port: Number(port) || (dbType === 'mysql' ? 3306 : dbType === 'sqlserver' ? 1433 : dbType === 'oracle' ? 1521 : 5432),
      database: database.trim(),
      username: username.trim(),
      filePath: filePath.trim(),
      password: password,
      ssl
    };

    try {
      const connInfo = await DatabaseApiClient.connect(params);

      // If user checked "Save this connection", save it automatically
      if (saveOnConnect || activeTab === 'edit') {
        const finalName = connectionName.trim() || `${database.trim()} (${dbType})`;
        if (activeTab === 'edit' && editingConnectionId) {
          await DatabaseApiClient.updateSavedConnection(editingConnectionId, {
            name: finalName,
            type: dbType,
            host: host.trim(),
            port: Number(port) || undefined,
            database: database.trim(),
            username: username.trim(),
            password: password || undefined,
            defaultSchema: defaultSchema.trim() || undefined,
            ssl,
            filePath: filePath.trim() || undefined
          });
        } else {
          await DatabaseApiClient.saveConnection({
            name: finalName,
            type: dbType,
            host: host.trim(),
            port: Number(port) || undefined,
            database: database.trim(),
            username: username.trim(),
            password: password,
            defaultSchema: defaultSchema.trim() || undefined,
            ssl,
            filePath: filePath.trim() || undefined
          });
        }
      }

      // Clean up local password from memory
      setPassword('');
      onConnected(connInfo, params);
      onClose();
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect to database');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectSaved = async (saved: SavedDatabaseConnection) => {
    setConnectingSavedId(saved.id);
    setConnectError(null);
    try {
      const connInfo = await DatabaseApiClient.connectSavedConnection(saved.id);
      onConnected(connInfo, {
        type: saved.type,
        host: saved.host,
        port: saved.port,
        database: saved.database,
        username: saved.username,
        ssl: saved.ssl,
        filePath: saved.filePath
      });
      onClose();
    } catch (err: any) {
      setConnectError(`Failed to connect to ${saved.name}: ${err.message}`);
    } finally {
      setConnectingSavedId(null);
    }
  };

  const handleStartEdit = (saved: SavedDatabaseConnection) => {
    setEditingConnectionId(saved.id);
    setConnectionName(saved.name);
    setDbType(saved.type);
    setHost(saved.host || 'localhost');
    setPort(saved.port ? String(saved.port) : '5432');
    setDatabase(saved.database || 'postgres');
    setUsername(saved.username || 'postgres');
    setDefaultSchema(saved.defaultSchema || 'public');
    setSsl(saved.ssl ?? false);
    setFilePath(saved.filePath || '');
    setPassword('');
    setConnectError(null);
    setTestResult(null);
    setActiveTab('edit');
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await DatabaseApiClient.deleteSavedConnection(id);
      setDeleteConfirmId(null);
      await loadSavedConnections();
    } catch (err: any) {
      setConnectError(`Failed to delete saved connection: ${err.message}`);
    }
  };

  const handleNewConnectionTab = () => {
    setEditingConnectionId(null);
    setConnectionName('');
    setPassword('');
    setConnectError(null);
    setTestResult(null);
    setActiveTab('new');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Database Connection</h3>
              <p className="text-xs text-slate-400">Connect to SQL databases with real-time schema discovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-slate-800 bg-slate-900/50 flex items-center space-x-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'saved'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Connections ({savedConnections.length})</span>
          </button>

          <button
            type="button"
            onClick={handleNewConnectionTab}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'new'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Connection</span>
          </button>

          {activeTab === 'edit' && (
            <span className="pb-2.5 px-3 text-xs font-semibold border-b-2 border-amber-500 text-amber-300 flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Security Architecture Banner */}
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-400">Zero-Credential Exposure:</span> Credentials are submitted directly to the secure server-side connection pool. Passwords are never saved in browser storage or plaintext logs.
            </div>
          </div>

          {/* TAB 1: SAVED CONNECTIONS */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {isLoadingSaved ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  <span>Loading saved connection profiles...</span>
                </div>
              ) : savedConnections.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center space-y-3 bg-slate-950/30">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">No Saved Connections Yet</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Save database connections for fast one-click reconnection across sessions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleNewConnectionTab}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Connection</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedConnections.map(conn => {
                    const isConnectingThis = connectingSavedId === conn.id;
                    const isConfirmingDelete = deleteConfirmId === conn.id;

                    return (
                      <div
                        key={conn.id}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-bold text-white">{conn.name}</h4>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase font-mono font-bold">
                                {conn.type}
                              </span>
                              {conn.ssl && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono font-bold">
                                  SSL
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {conn.type === 'sqlite' ? (
                                <span>File: {conn.filePath}</span>
                              ) : (
                                <span>
                                  {conn.username}@{conn.host}:{conn.port}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Connect / Actions */}
                          <div className="flex items-center space-x-1.5">
                            {isConfirmingDelete ? (
                              <div className="flex items-center space-x-1 bg-rose-950/60 p-1 rounded border border-rose-800">
                                <span className="text-[10px] text-rose-300 px-1">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSaved(conn.id)}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(conn)}
                                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                  title="Edit connection profile"
                                  aria-label="Edit connection"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(conn.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40 transition-colors"
                                  title="Delete saved profile"
                                  aria-label="Delete connection"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleConnectSaved(conn)}
                              disabled={Boolean(connectingSavedId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              {isConnectingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5 fill-current" />
                              )}
                              <span>{isConnectingThis ? 'Connecting...' : 'Connect'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Metadata Details */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                          {conn.database && (
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              Database: <strong className="text-slate-300 font-normal">{conn.database}</strong>
                            </span>
                          )}
                          {conn.defaultSchema && (
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              Schema: <strong className="text-slate-300 font-normal">{conn.defaultSchema}</strong>
                            </span>
                          )}
                          {conn.lastConnectedAt && (
                            <span className="text-slate-500 font-sans ml-auto">
                              Last connected: {new Date(conn.lastConnectedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 & 3: NEW CONNECTION OR EDIT CONNECTION */}
          {(activeTab === 'new' || activeTab === 'edit') && (
            <form onSubmit={handleConnect} className="space-y-4">
              {/* Profile Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Connection Name (optional for quick connect)
                </label>
                <input
                  type="text"
                  value={connectionName}
                  onChange={e => setConnectionName(e.target.value)}
                  placeholder={
                    database ? `${database} (${dbType})` : 'e.g. Local PostgreSQL or Production Replica'
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-medium"
                />
              </div>

              {/* Database Type */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Database Type</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'postgresql', label: 'PostgreSQL', port: '5432' },
                    { id: 'mysql', label: 'MySQL', port: '3306' },
                    { id: 'sqlserver', label: 'SQL Server', port: '1433' },
                    { id: 'sqlite', label: 'SQLite', port: '' },
                    { id: 'oracle', label: 'Oracle', port: '1521' }
                  ].map(t => {
                    const isSelected = dbType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setDbType(t.id as any);
                          if (t.port) setPort(t.port);
                        }}
                        className={`px-2.5 py-2 text-xs rounded-lg font-medium border text-center transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {dbType === 'sqlite' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-300">SQLite File Path</label>
                    <button
                      type="button"
                      onClick={() => setFilePath('data/datapilot_demo.sqlite')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                    >
                      Use Built-in Demo DB
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={filePath}
                    onChange={e => setFilePath(e.target.value)}
                    placeholder="data/datapilot_demo.sqlite"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-400">
                    Enter relative path (e.g. <code className="text-slate-300">data/datapilot_demo.sqlite</code>) or absolute path.
                  </p>
                </div>
              ) : (
                <>
                  {/* Host & Port */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Host</label>
                      <input
                        type="text"
                        required
                        value={host}
                        onChange={e => setHost(e.target.value)}
                        placeholder="localhost or 127.0.0.1"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
                      <input
                        type="number"
                        required
                        value={port}
                        onChange={e => setPort(e.target.value)}
                        placeholder="5432"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Database Name & Username */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {dbType === 'oracle' ? 'Service Name / SID' : 'Database Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={database}
                        onChange={e => setDatabase(e.target.value)}
                        placeholder="postgres or my_db"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="postgres"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Password & Default Schema */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                        <span>Password</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Encrypted
                        </span>
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={activeTab === 'edit' ? '(Keep existing password)' : '••••••••••••'}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Default Schema (optional)
                      </label>
                      <input
                        type="text"
                        value={defaultSchema}
                        onChange={e => setDefaultSchema(e.target.value)}
                        placeholder="public"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* SSL Option & Save Profile Checkbox */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="ssl-checkbox"
                        checked={ssl}
                        onChange={e => setSsl(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                      />
                      <label htmlFor="ssl-checkbox" className="text-xs text-slate-300 cursor-pointer">
                        Enable SSL Connection (require TLS)
                      </label>
                    </div>

                    {activeTab === 'new' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="save-profile-checkbox"
                          checked={saveOnConnect}
                          onChange={e => setSaveOnConnect(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        />
                        <label htmlFor="save-profile-checkbox" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1.5">
                          <Bookmark className="w-3 h-3 text-emerald-400" />
                          <span>Save this connection for future use</span>
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Test Connection Output Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-medium mb-1">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{testResult.success ? 'Connection Test Succeeded' : 'Connection Test Failed'}</span>
                  </div>
                  {testResult.success ? (
                    <div className="text-[11px] text-emerald-300/90 space-y-0.5 font-mono">
                      <div>Database: {testResult.databaseName} ({testResult.databaseType})</div>
                      {testResult.serverVersion && <div>Version: {testResult.serverVersion}</div>}
                      <div>Latency: {testResult.latencyMs} ms</div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-rose-300/90 font-mono">
                      {testResult.error || 'Connection failed: verify host, port, database, and credentials.'}
                    </div>
                  )}
                </div>
              )}

              {/* Connect Error Output */}
              {connectError && (
                <div className="p-3 rounded-lg border border-rose-800 bg-rose-950/40 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-rose-300">Connection Failed</div>
                    <div className="text-[11px] font-mono mt-0.5">{connectError}</div>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  id="btn-test-connection"
                  onClick={handleTestConnection}
                  disabled={isTesting || isConnecting || (dbType === 'sqlite' ? !filePath : (!host || !database || !username))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'edit') {
                        setActiveTab('saved');
                      } else {
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="btn-connect-database"
                    disabled={isConnecting || (dbType === 'sqlite' ? !filePath : (!host || !database || !username))}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isConnecting
                        ? 'Connecting...'
                        : activeTab === 'edit'
                        ? 'Save & Connect'
                        : 'Connect Database'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
