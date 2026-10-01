export interface DatabaseConnectionParams {
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  filePath?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface SavedDatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
  hasPassword?: boolean;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export interface SaveConnectionInput {
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
}

export interface UpdateSavedConnectionInput {
  name?: string;
  type?: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
}

export interface SanitizedConnectionInfo {
  id: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  isConnected: boolean;
  serverVersion?: string;
  connectedAt?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  databaseType: string;
  databaseName: string;
  serverVersion?: string;
  latencyMs: number;
  error?: string;
  errorCode?: string;
}

export interface DiscoveredTable {
  schema: string;
  name: string;
  type: string;
  approximateRowCount?: number;
}

export interface TableColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTarget?: {
    schema: string;
    table: string;
    column: string;
    constraintName?: string;
  };
}

export interface DatabaseRelationship {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
}

export interface TableDetailsResult {
  schema: string;
  name: string;
  type: string;
  columnCount: number;
  approximateRowCount?: number;
  columns: TableColumnInfo[];
  outgoingRelationships: DatabaseRelationship[];
  incomingRelationships: DatabaseRelationship[];
}

export interface QueryResultColumn {
  name: string;
  dataType: string;
}

/**
 * Phase 6: Shared Unified Result Model
 */
export interface QueryResult {
  query?: string;
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  status?: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  timestamp?: Date | string;
  isTruncated?: boolean;
  truncated?: boolean;
  totalAvailableRows?: number;
  sourceQueryId?: string;
}

export interface QueryExecutionResult extends QueryResult {
  query: string;
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  status: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  timestamp: Date;
  isTruncated?: boolean;
  totalAvailableRows?: number;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  status: 'success' | 'error' | 'cancelled';
  executionTimeMs: number;
  rowCount: number;
  errorMessage?: string;
}

// Phase 4: Schema-Aware AI Assistant Types
export interface AiSqlGenerationResult {
  understanding: string;
  sql: string;
  tablesUsed: string[];
  explanation: string;
  assumptions: string[];
  warnings: string[];
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
  validationPassed: boolean;
}

export interface AiExplainSqlResult {
  simpleExplanation: string;
  technicalExplanation: string;
  tablesUsed: string[];
  joins: string[];
  filters: string[];
  aggregations: string[];
  sortingAndGrouping: string[];
}

export interface AiExplainResultsResult {
  summary: string;
  keyInsights: string[];
  dataTrends: string[];
  rowCount: number;
}

export interface AiFixSqlResult {
  originalSql: string;
  errorMessage: string;
  suggestedSql: string;
  explanation: string;
  tablesUsed: string[];
  assumptions: string[];
  warnings: string[];
  validationPassed: boolean;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'text' | 'sql_generation' | 'clarification' | 'explanation' | 'error_fix' | 'result_explanation';
  sqlResult?: AiSqlGenerationResult;
  explainResult?: AiExplainSqlResult;
  fixResult?: AiFixSqlResult;
  resultExplanation?: AiExplainResultsResult;
}

export interface AiStatus {
  configured: boolean;
  model: string;
}


export interface SqlEditorTab {
  id: string;
  name: string;
  query: string;
  result: QueryExecutionResult | null;
  isRunning: boolean;
  savedQueryId?: string;
  isModified?: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SqlSnippet {
  id: string;
  name: string;
  description: string;
  sql: string;
  category: string;
  prefix?: string;
  isCustom: boolean;
  isFavorite: boolean;
  createdAt?: string;
  updatedAt?: string;
}
