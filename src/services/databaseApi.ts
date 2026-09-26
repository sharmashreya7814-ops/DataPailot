import {
  DatabaseConnectionParams,
  ConnectionTestResult,
  SanitizedConnectionInfo,
  DiscoveredTable,
  TableDetailsResult,
  DatabaseRelationship,
  QueryExecutionResult,
  AiSqlGenerationResult,
  AiExplainSqlResult,
  AiExplainResultsResult,
  AiFixSqlResult,
  AiStatus
} from '../types/database';

export class DatabaseApiClient {
  private static workspaceId: string = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_workspace_id')) || 'ws_primary';
  private static projectId: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_project_id')) || null;

  public static setWorkspaceId(id: string) {
    this.workspaceId = id;
  }

  public static getWorkspaceId(): string {
    return this.workspaceId;
  }

  public static setProjectId(id: string | null) {
    this.projectId = id && id.trim() && id !== 'null' && id !== 'undefined' ? id.trim() : null;
  }

  public static getProjectId(): string | null {
    return this.projectId;
  }

  private static getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'x-workspace-id': this.workspaceId,
      ...extraHeaders
    };
    if (this.projectId) {
      headers['x-project-id'] = this.projectId;
    }
    return headers;
  }

  private static async handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  }

  public static async testConnection(params: DatabaseConnectionParams): Promise<ConnectionTestResult> {
    const res = await fetch('/api/database/test', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    return this.handleResponse<ConnectionTestResult>(res);
  }

  public static async connect(params: DatabaseConnectionParams): Promise<SanitizedConnectionInfo> {
    const res = await fetch('/api/database/connect', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params)
    });
    const data = await this.handleResponse<{ success: boolean; connection: SanitizedConnectionInfo }>(res);
    return data.connection;
  }

  public static async disconnect(): Promise<void> {
    const res = await fetch('/api/database/disconnect', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' })
    });
    await this.handleResponse(res);
  }

  public static async getStatus(): Promise<{ isConnected: boolean; connection: SanitizedConnectionInfo | null }> {
    const res = await fetch('/api/database/status', {
      headers: this.getHeaders()
    });
    return this.handleResponse(res);
  }

  public static async getTables(schema?: string): Promise<DiscoveredTable[]> {
    const url = schema ? `/api/database/tables?schema=${encodeURIComponent(schema)}` : '/api/database/tables';
    const res = await fetch(url, {
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<{ success: boolean; tables: DiscoveredTable[]; count: number }>(res);
    return data.tables;
  }

  public static async getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult> {
    const res = await fetch(`/api/database/tables/${encodeURIComponent(schema)}/${encodeURIComponent(tableName)}`, {
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<{ success: boolean; table: TableDetailsResult }>(res);
    return data.table;
  }

  public static async getDataQualityProfile(schema: string, tableName: string): Promise<any> {
    const res = await fetch(`/api/quality/profile/${encodeURIComponent(schema)}/${encodeURIComponent(tableName)}`, {
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<{ success: boolean; profile: any }>(res);
    return data.profile;
  }

  public static async refreshSchema(schema?: string): Promise<{
    tables: DiscoveredTable[];
    relationships: DatabaseRelationship[];
    tableCount: number;
    relationshipCount: number;
  }> {
    const res = await fetch('/api/database/refresh', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ schema })
    });
    return this.handleResponse(res);
  }

  public static async getRelationships(schema?: string): Promise<DatabaseRelationship[]> {
    const url = schema ? `/api/database/relationships?schema=${encodeURIComponent(schema)}` : '/api/database/relationships';
    const res = await fetch(url, {
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<{ success: boolean; relationships: DatabaseRelationship[] }>(res);
    return data.relationships;
  }

  public static async executeQuery(
    sql: string,
    maxRows = 1000,
    signal?: AbortSignal
  ): Promise<QueryExecutionResult> {
    const startTime = Date.now();
    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: this.getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sql, maxRows }),
        signal
      });
      const data = await this.handleResponse<{
        success: boolean;
        result: {
          query: string;
          columns: { name: string; dataType: string }[];
          rows: Record<string, unknown>[];
          rowCount: number;
          executionTimeMs: number;
          isTruncated?: boolean;
          totalAvailableRows?: number;
          status: 'success';
        };
      }>(res);

      return {
        query: sql,
        columns: data.result.columns,
        rows: data.result.rows,
        rowCount: data.result.rowCount,
        executionTimeMs: data.result.executionTimeMs,
        isTruncated: data.result.isTruncated,
        totalAvailableRows: data.result.totalAvailableRows,
        status: 'success',
        timestamp: new Date()
      };
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return {
          query: sql,
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          status: 'cancelled',
          errorMessage: 'Query execution was cancelled by user.',
          timestamp: new Date()
        };
      }

      return {
        query: sql,
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
        status: 'error',
        errorMessage: err.message || 'Failed to execute query',
        timestamp: new Date()
      };
    }
  }

  // AI Assistant Services
  public static async getAiStatus(): Promise<AiStatus> {
    const res = await fetch('/api/database/ai/status', {
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<{ success: boolean; configured: boolean; model: string }>(res);
    return {
      configured: Boolean(data.configured),
      model: data.model || 'gemini-2.5-flash'
    };
  }

  public static async generateSqlWithAi(
    question: string,
    selectedTable?: { schema: string; name: string },
    conversationHistory?: { role: 'user' | 'assistant'; content: string; sql?: string }[]
  ): Promise<AiSqlGenerationResult> {
    const res = await fetch('/api/database/ai/generate-sql', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ question, selectedTable, conversationHistory })
    });
    const data = await this.handleResponse<{ success: boolean; data: AiSqlGenerationResult }>(res);
    return data.data;
  }

  public static async explainSqlWithAi(sql: string): Promise<AiExplainSqlResult> {
    const res = await fetch('/api/database/ai/explain-sql', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sql })
    });
    const data = await this.handleResponse<{ success: boolean; data: AiExplainSqlResult }>(res);
    return data.data;
  }

  public static async explainResultsWithAi(
    query: string,
    columns: { name: string; type?: string }[],
    rows: Record<string, unknown>[],
    rowCount: number,
    executionTimeMs: number
  ): Promise<AiExplainResultsResult> {
    const res = await fetch('/api/database/ai/explain-results', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query, columns, rows, rowCount, executionTimeMs })
    });
    const data = await this.handleResponse<{ success: boolean; data: AiExplainResultsResult }>(res);
    return data.data;
  }

  public static async fixSqlWithAi(failedSql: string, errorMessage: string): Promise<AiFixSqlResult> {
    const res = await fetch('/api/database/ai/fix-error', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ failedSql, errorMessage })
    });
    const data = await this.handleResponse<{ success: boolean; data: AiFixSqlResult }>(res);
    return data.data;
  }

  public static async generateDashboardWithAi(prompt: string): Promise<{
    dashboardTitle: string;
    dashboardDescription: string;
    widgets: {
      title: string;
      description: string;
      chartType: any;
      colSpan: 3 | 4 | 6 | 8 | 12;
      height: number;
      sql: string;
      sourceTable?: string;
      explanation: string;
    }[];
    warnings: string[];
  }> {
    const res = await fetch('/api/database/ai/generate-dashboard', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt })
    });
    const data = await this.handleResponse<{ success: boolean; data: any }>(res);
    return data.data;
  }

  public static async generateDashboardInsightsWithAi(
    dashboardName: string,
    widgetSummaries: any[]
  ): Promise<{
    insights: {
      id: string;
      title: string;
      text: string;
      type: 'trend' | 'outlier' | 'benchmark' | 'metric';
      widgetSourceTitle?: string;
      evidence?: string;
    }[];
  }> {
    const res = await fetch('/api/database/ai/dashboard-insights', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ dashboardName, widgetSummaries })
    });
    const data = await this.handleResponse<{ success: boolean; data: any }>(res);
    return data.data;
  }


  public static async generateAnalysis(method: string, ...args: any[]): Promise<any> {
    const res = await fetch('/api/database/analysis/generate', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ method, args })
    });
    const data = await this.handleResponse<{ result: any }>(res);
    return data.result;
  }

  public static async getFilterValues(
    column: string,
    table?: string,
    schema?: string
  ): Promise<{ values: string[]; column: string; table: string | null }> {
    const params = new URLSearchParams({ column });
    if (table) params.append('table', table);
    if (schema) params.append('schema', schema);
    const res = await fetch(`/api/database/filter-values?${params.toString()}`, {
      headers: this.getHeaders()
    });
    const data = await this.handleResponse<{
      success: boolean;
      values: string[];
      column: string;
      table: string | null;
    }>(res);
    return {
      values: data.values || [],
      column: data.column,
      table: data.table
    };
  }
}
