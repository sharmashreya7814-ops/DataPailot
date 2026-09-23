import React, { useState } from 'react';
import {
  X,
  Database,
  Check,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Lock
} from 'lucide-react';
import {
  DatabaseConnectionParams,
  ConnectionTestResult,
  SanitizedConnectionInfo
} from '../../types/database';
import { DatabaseApiClient } from '../../services/databaseApi';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (info: SanitizedConnectionInfo) => void;
  currentConnection: SanitizedConnectionInfo | null;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  currentConnection
}) => {
  const [dbType, setDbType] = useState<'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle'>(
    (currentConnection?.type as any) || 'postgresql'
  );
  const [host, setHost] = useState(currentConnection?.host || 'localhost');
  const [port, setPort] = useState(currentConnection?.port ? String(currentConnection.port) : '5432');
  const [database, setDatabase] = useState(currentConnection?.database || 'postgres');
  const [username, setUsername] = useState(currentConnection?.username || 'postgres');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(currentConnection?.ssl ?? false);
  const [filePath, setFilePath] = useState('');

  // Testing & connecting state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

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
      // Clean up local password from memory
      setPassword('');
      onConnected(connInfo);
      onClose();
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect to database');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl text-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Database Connection</h3>
              <p className="text-xs text-slate-400">Real SQL database connection and schema discovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security architecture banner */}
        <div className="mx-5 mt-4 p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-400">Zero-Credential Exposure:</span> Credentials are submitted directly to the secure server-side connection pool. Passwords are never saved in browser storage or logs.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="p-5 space-y-4">
          {/* Database Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Database Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDbType('postgresql');
                  setPort('5432');
                }}
                className={`px-3 py-2 text-xs rounded-lg font-medium border text-center transition-all flex items-center justify-center gap-1.5 ${
                  dbType === 'postgresql'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>PostgreSQL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDbType('mysql');
                  setPort('3306');
                }}
                className={`px-3 py-2 text-xs rounded-lg font-medium border text-center transition-all ${
                  dbType === 'mysql'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>MySQL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDbType('sqlserver');
                  setPort('1433');
                }}
                className={`px-3 py-2 text-xs rounded-lg font-medium border text-center transition-all ${
                  dbType === 'sqlserver'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>SQL Server</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDbType('oracle');
                  setPort('1521');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center justify-center gap-1.5 ${
                  dbType === 'oracle'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Oracle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDbType('sqlite');
                  setPort('');
                }}
                className={`px-3 py-2 text-xs rounded-lg font-medium border text-center transition-all opacity-80 ${
                  dbType === 'sqlite'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-800 text-slate-500 hover:text-slate-400'
                }`}
              >
                <span>SQLite (Adapter)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDbType('oracle');
                  setPort('1521');
                }}
                className={`px-3 py-2 text-xs rounded-lg font-medium border text-center transition-all opacity-80 ${
                  dbType === 'oracle'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800/60 border-slate-800 text-slate-500 hover:text-slate-400'
                }`}
              >
                <span>Oracle (Adapter)</span>
              </button>
            </div>
          </div>

          {dbType === 'sqlite' ? (
          <div className="col-span-3 space-y-2">
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
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-400">
              Enter relative path (e.g. <code className="text-slate-300">data/datapilot_demo.sqlite</code>) or absolute path to an SQLite database file.
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
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
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
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Database Name & Username */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{dbType === 'oracle' ? 'Service Name / SID' : 'Database Name'}</label>
              <input
                type="text"
                required
                value={database}
                onChange={e => setDatabase(e.target.value)}
                placeholder="postgres or my_db"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
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
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
              <span>Password</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Never stored in browser
              </span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:outline-hidden focus:border-emerald-500 font-mono"
            />
          </div>

          {/* SSL Option */}
          <div className="flex items-center space-x-2 pt-1">
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
                <span>
                  {testResult.success ? 'Connection Test Succeeded' : 'Connection Test Failed'}
                </span>
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
                onClick={onClose}
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
                <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
