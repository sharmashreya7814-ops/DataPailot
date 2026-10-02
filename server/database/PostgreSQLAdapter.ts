import pg from 'pg';
const { Pool } = pg;
import {
  DatabaseAdapter,
  DatabaseConnectionParams,
  ConnectionTestResult,
  DiscoveredTable,
  TableDetailsResult,
  DatabaseRelationship,
  QueryExecutionOptions,
  QueryResultData,
  QueryResultColumn
} from './DatabaseAdapter';
import { SchemaIntrospection } from './SchemaIntrospection';
import { AbstractDatabaseAdapter } from './AbstractDatabaseAdapter';
import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';
import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo } from './DatabaseAdapter';
import { RelationshipDiscovery } from './RelationshipDiscovery';
import { QuerySafetyValidator } from './QuerySafetyValidator';

const PG_TYPE_MAP: Record<number, string> = {
  16: 'boolean',
  17: 'bytea',
  18: 'char',
  19: 'name',
  20: 'bigint',
  21: 'smallint',
  23: 'integer',
  25: 'text',
  114: 'json',
  142: 'xml',
  600: 'point',
  700: 'real',
  701: 'double precision',
  790: 'money',
  829: 'macaddr',
  869: 'inet',
  650: 'cidr',
  1042: 'character',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1560: 'bit',
  1562: 'varbit',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb'
};

export class PostgreSQLAdapter extends AbstractDatabaseAdapter {
  private pool: pg.Pool | null = null;

  constructor(config: DatabaseConnectionParams) {
    super(config);
    this.config = { ...config };
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const testPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      max: 1
    });

    try {
      const client = await testPool.connect();
      try {
        const versionRes = await client.query('SELECT version();');
        const latencyMs = Date.now() - startTime;
        const versionString = versionRes.rows[0]?.version || 'PostgreSQL';
        // Extract concise version like "PostgreSQL 15.2"
        const conciseVersion = versionString.split(' on ')[0] || versionString;

        return {
          success: true,
          databaseType: 'PostgreSQL',
          databaseName: this.config.database,
          serverVersion: conciseVersion,
          latencyMs
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const friendlyError = this.mapPgError(err);
      return {
        success: false,
        databaseType: 'PostgreSQL',
        databaseName: this.config.database,
        latencyMs,
        error: friendlyError,
        errorCode: err.code || err.errno
      };
    } finally {
      await testPool.end().catch(() => {});
    }
  }

  public async connect(): Promise<void> {
    if (this.pool) {
      await this.disconnect();
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      max: 5
    });

    // Guard against unhandled error events on idle pooled connections
    this.pool.on('error', (err) => {
      console.warn('PostgreSQL idle client pool notice (handled safely):', err?.message || err);
    });

    // Test a client connection to ensure credentials work
    const client = await this.pool.connect();
    client.release();
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      const p = this.pool;
      this.pool = null;
      await p.end().catch(() => {});
    }
  }

  
  public getDatabaseType(): string {
    return 'PostgreSQL';
  }

  public getCapabilities(): DatabaseCapabilities {
    return {
      transactions: true,
      explain: true,
      cancelQuery: true,
      schemas: true,
      foreignKeys: true,
      indexes: true,
      windowFunctions: true,
      dateFunctions: true,
      jsonFunctions: true,
      returning: true,
      limitSyntax: 'LIMIT'
    };
  }

  public getDialect(): SqlDialect {
    return {
      quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
      formatLimit: (sql: string, limit: number) => `${sql}\nLIMIT ${limit}`,
      formatPagination: (sql: string, limit: number, offset: number) => `${sql}\nLIMIT ${limit} OFFSET ${offset}`,
      formatDate: (date: Date) => `'${date.toISOString()}'::timestamp`,
      formatExplain: (sql: string) => `EXPLAIN ${sql}`,
      qualifyTable: (schema: string | undefined, table: string) => schema ? `"${schema}"."${table}"` : `"${table}"`,
      dialectType: 'postgresql'
    };
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query('SELECT version();');
      const ver = res.rows[0]?.version || 'PostgreSQL';
      return {
        version: ver,
        database: this.config.database || '',
        system: 'PostgreSQL'
      };
    } finally {
      client.release();
    }
  }

  public async listSchemas(): Promise<string[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
      `);
      return res.rows.map(r => r.schema_name);
    } finally {
      client.release();
    }
  }

  public async listTables(schema?: string): Promise<DiscoveredTable[]> {
    return this.getTables(schema);
  }

  public async getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]> {
    const details = await this.getTableDetails(schema, table);
    return details.columns.map(c => ({
      name: c.name,
      dataType: c.dataType,
      isNullable: c.isNullable,
      defaultValue: c.defaultValue
    }));
  }

  public async getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(`
        SELECT a.attname as column_name, c.conname as constraint_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_constraint c ON c.conrelid = i.indrelid AND c.contype = 'p'
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = $1 AND n.nspname = $2 AND i.indisprimary;
      `, [table, schema]);
      return res.rows.map(r => ({ columnName: r.column_name, constraintName: r.constraint_name }));
    } finally {
      client.release();
    }
  }

  public async getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(`
        SELECT
            tc.constraint_name,
            kcu.column_name AS source_column,
            ccu.table_schema AS target_schema,
            ccu.table_name AS target_table,
            ccu.column_name AS target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2;
      `, [schema, table]);
      return res.rows.map(r => ({
        constraintName: r.constraint_name,
        sourceColumn: r.source_column,
        targetSchema: r.target_schema,
        targetTable: r.target_table,
        targetColumn: r.target_column
      }));
    } finally {
      client.release();
    }
  }

  public async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    const client = await this.pool!.connect();
    try {
      const res = await client.query(`
        SELECT
          ix.relname as index_name,
          i.indisunique as is_unique,
          i.indisprimary as is_primary,
          ARRAY(
            SELECT pg_get_indexdef(i.indexrelid, k + 1, true)
            FROM generate_subscripts(i.indkey, 1) as k
            ORDER BY k
          ) as column_names
        FROM pg_class t
        JOIN pg_index i ON t.oid = i.indrelid
        JOIN pg_class ix ON ix.oid = i.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname = $1 AND n.nspname = $2;
      `, [table, schema]);
      return res.rows.map(r => ({
        indexName: r.index_name,
        isUnique: r.is_unique,
        isPrimary: r.is_primary,
        columnNames: r.column_names
      }));
    } finally {
      client.release();
    }
  }

  public async executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData> {
    return this.executeQuery(sql, options);
  }

  public async cancelQuery(queryId?: string): Promise<boolean> {
    if (!queryId) return false;
    const client = await this.pool!.connect();
    try {
      // Best effort cancel backend
      const res = await client.query('SELECT pg_cancel_backend($1::int)', [parseInt(queryId)]);
      return res.rows[0]?.pg_cancel_backend || false;
    } catch {
      return false;
    } finally {
      client.release();
    }
  }

  public async explainQuery(sql: string): Promise<QueryResultData> {
    return this.executeReadOnlyQuery(this.getDialect().formatExplain(sql));
  }

  public async getTables(schema?: string): Promise<DiscoveredTable[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    const client = await this.pool.connect();
    try {
      return await SchemaIntrospection.discoverTables(client, schema);
    } finally {
      client.release();
    }
  }

  public async getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    const client = await this.pool.connect();
    try {
      return await SchemaIntrospection.getTableDetails(client, schema, tableName);
    } finally {
      client.release();
    }
  }

  public async getRelationships(schema?: string): Promise<DatabaseRelationship[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    const client = await this.pool.connect();
    try {
      return await RelationshipDiscovery.discoverRelationships(client, schema);
    } finally {
      client.release();
    }
  }

  public async executeQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData> {
    if (!this.pool) {
      throw new Error('Database not connected. Please connect a database before running queries.');
    }

    // Server-side safety validation
    const validation = QuerySafetyValidator.validate(sql);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Query validation failed');
    }

    // Maximum result size protection (capped between 1 and 10,000 rows)
    const MAX_ALLOWED_ROWS = 10000;
    const requestedMax = options?.maxRows ? Math.min(Math.max(1, options.maxRows), MAX_ALLOWED_ROWS) : 1000;
    const timeoutMs = options?.timeoutMs ? Math.min(Math.max(1000, options.timeoutMs), 60000) : 15000;

    const client = await this.pool.connect();
    const startTime = Date.now();

    try {
      // Set query execution timeout on the dedicated session
      await client.query(`SET statement_timeout = ${timeoutMs};`);

      // Execute read-only query
      const res = await client.query({ text: sql, rowMode: 'array' });
      const executionTimeMs = Date.now() - startTime;

      // Extract columns with inferred or mapped data types
      const columnsMeta: QueryResultColumn[] = res.fields
        ? res.fields.map((f, i) => {
            const mappedType = PG_TYPE_MAP[f.dataTypeID];
            let fallbackType = 'text';
            if (res.rows.length > 0 && res.rows[0][i] !== undefined && res.rows[0][i] !== null) {
              const val = res.rows[0][i];
              fallbackType = typeof val;
            }
            return {
              name: f.name,
              dataType: mappedType || fallbackType
            };
          })
        : [];

      const totalAvailableRows = res.rowCount ?? res.rows?.length ?? 0;
      let rawRows = res.rows || [];
      const isTruncated = rawRows.length > requestedMax;

      if (isTruncated) {
        rawRows = rawRows.slice(0, requestedMax);
      }

      const normalized = this.normalizeArrayRowResults(columnsMeta, rawRows);

      return {
        columns: normalized.columns as QueryResultColumn[],
        rows: normalized.rows,
        rowCount: normalized.rows.length,
        executionTimeMs,
        isTruncated,
        totalAvailableRows
      };
    } catch (err: any) {
      throw new Error(this.mapPgError(err));
    } finally {
      // Reset statement timeout before releasing client back to pool
      await client.query('RESET statement_timeout;').catch(() => {});
      client.release();
    }
  }

  private mapPgError(err: any): string {
    if (!err) return 'Unknown database error occurred';

    // Server-side query timeout (code 57014 or statement_timeout message)
    if (
      err.code === '57014' ||
      err.message?.includes('statement timeout') ||
      err.message?.includes('canceling statement due to statement timeout')
    ) {
      return 'Query timed out. Try adding filters or limiting the result.';
    }

    // Syntax error in SQL query (code 42601)
    if (err.code === '42601') {
      const cleanMsg = err.message ? err.message.replace(/^ERROR:\s*/i, '') : 'Check query syntax';
      return `Syntax error in SQL query: ${cleanMsg}`;
    }

    // Undefined table / relation does not exist (code 42P01)
    if (err.code === '42P01') {
      const cleanMsg = err.message ? err.message.replace(/^ERROR:\s*/i, '') : 'Relation does not exist';
      return `Table not found: ${cleanMsg}`;
    }

    // Undefined column / column does not exist (code 42703)
    if (err.code === '42703') {
      const cleanMsg = err.message ? err.message.replace(/^ERROR:\s*/i, '') : 'Column does not exist';
      return `Column not found: ${cleanMsg}`;
    }

    // Password or authentication failure (code 28P01)
    if (err.code === '28P01' || err.message?.includes('password authentication failed')) {
      return 'Authentication failed: Invalid username or password';
    }

    // Database does not exist (code 3D000)
    if (err.code === '3D000' || (err.message?.includes('database') && err.message?.includes('does not exist'))) {
      return `Database not found: "${this.config.database}" does not exist on this server`;
    }

    // Host unreachable or connection refused
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return `Host unreachable: Unable to connect to ${this.config.host}:${this.config.port}. Ensure the database server is running.`;
    }

    // Host name not resolved
    if (err.code === 'ENOTFOUND') {
      return `Host not found: Could not resolve hostname "${this.config.host}"`;
    }

    // Connection timed out
    if (err.code === 'ETIMEDOUT' || err.message?.includes('connect ETIMEDOUT')) {
      return 'Connection timed out: The database server took too long to respond';
    }

    // SSL error
    if (err.message?.includes('SSL') || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return 'SSL connection failed: Could not establish secure SSL connection';
    }

    // Permission denied (code 42501)
    if (err.code === '42501') {
      return 'Permission denied: Current database user does not have sufficient privileges to access this object.';
    }

    // Connection terminated / lost
    if (err.code === '57P01' || err.message?.includes('Connection terminated') || err.message?.includes('connection closed')) {
      return 'Database connection lost. Please reconnect your database.';
    }

    // Default: Clean message without leaking internal secrets or stack traces
    const msg = err.message ? err.message.replace(/^ERROR:\s*/i, '') : 'Database query error';
    return msg;
  }
}
