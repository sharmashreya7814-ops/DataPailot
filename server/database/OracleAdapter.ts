import { AbstractDatabaseAdapter } from './AbstractDatabaseAdapter';
import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';
import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, ConnectionTestResult, DiscoveredTable, TableDetailsResult, QueryResultData, QueryExecutionOptions, DatabaseRelationship, TableColumnInfo, DatabaseConnectionParams, QueryResultColumn } from './DatabaseAdapter';
import { QuerySafetyValidator } from './QuerySafetyValidator';
import oracledb from 'oracledb';

export class OracleAdapter extends AbstractDatabaseAdapter {
  private pool: oracledb.Pool | null = null;
  private readonly configParams: DatabaseConnectionParams;

  constructor(config: DatabaseConnectionParams) {
    super(config);
    this.configParams = config;
    if (!config.host || !config.database || !config.username) {
      throw new Error('Oracle connection requires host, database (service name), and username');
    }
    // Setup for modern node-oracledb Thin mode
    oracledb.fetchAsString = [oracledb.CLOB];
  }

  private getOracleConfig(): oracledb.PoolAttributes {
    const protocol = this.configParams.ssl ? 'tcps' : 'tcp';
    const port = this.configParams.port || 1521;
    const connectString = `${this.configParams.host}:${port}/${this.configParams.database}`;
    
    // According to oracledb docs for easy connect, it's host:port/service_name
    // If ssl is requested we append ?ssl_server_cert_dn=... or similar if needed, 
    // but tcps://host:port/service_name is also valid in newer versions.
    // Let's use the standard Easy Connect string and set options if needed.
    const finalConnectString = this.configParams.ssl 
      ? `tcps://${this.configParams.host}:${port}/${this.configParams.database}` 
      : `${this.configParams.host}:${port}/${this.configParams.database}`;

    return {
      user: this.configParams.username,
      password: this.configParams.password || '',
      connectString: finalConnectString,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1
    };
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    let conn: oracledb.Connection | null = null;
    try {
      conn = await oracledb.getConnection({
        user: this.configParams.username,
        password: this.configParams.password || '',
        connectString: this.getOracleConfig().connectString
      });
      
      const result = await conn.execute(`SELECT * FROM v$version WHERE rownum = 1`);
      let version = 'Oracle Database';
      if (result.rows && result.rows.length > 0) {
        version = String((result.rows[0] as any)[0] || version);
      }
      
      return {
        success: true,
        databaseType: 'Oracle',
        databaseName: this.configParams.database!,
        serverVersion: version,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        databaseType: 'Oracle',
        databaseName: this.configParams.database!,
        latencyMs: Date.now() - startTime,
        error: err.message,
        errorCode: err.code || 'UNKNOWN'
      };
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async connect(): Promise<void> {
    if (this.pool) {
      await this.disconnect();
    }
    
    this.pool = await oracledb.createPool(this.getOracleConfig());
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close(0);
      } catch (e) {}
      this.pool = null;
    }
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }
  
  public getDatabaseType(): string { 
    return 'Oracle'; 
  }
  
  public getCapabilities(): DatabaseCapabilities {
    return {
      transactions: true,
      explain: true,
      cancelQuery: false, // node-oracledb supports break(), but we'd need to track connections
      schemas: true,
      foreignKeys: true,
      indexes: true,
      windowFunctions: true,
      dateFunctions: true,
      jsonFunctions: true,
      returning: true,
      limitSyntax: 'FETCH'
    };
  }
  
  public getDialect(): SqlDialect {
    return {
      quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
      formatLimit: (sql: string, limit: number) => {
        // Oracle 12c+ supports FETCH FIRST n ROWS ONLY
        return `SELECT * FROM (\n${sql}\n) FETCH FIRST ${limit} ROWS ONLY`;
      },
      formatPagination: (sql: string, limit: number, offset: number) => {
        return `SELECT * FROM (\n${sql}\n) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      },
      formatDate: (date: Date) => `TIMESTAMP '${date.toISOString().replace('T', ' ').replace('Z', '')}'`,
      formatExplain: (sql: string) => `EXPLAIN PLAN FOR ${sql}`,
      qualifyTable: (schema: string | undefined, table: string) => {
        const t = `"${table.replace(/"/g, '""')}"`;
        if (schema) {
          return `"${schema.replace(/"/g, '""')}".${t}`;
        }
        return t;
      },
      dialectType: 'oracle'
    };
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const result = await conn.execute(`SELECT banner FROM v$version WHERE rownum = 1`);
      
      let version = 'Oracle Database';
      if (result.rows && result.rows.length > 0) {
        version = String((result.rows[0] as any)[0]);
      }
      return {
        version,
        database: this.configParams.database!,
        system: 'Oracle'
      };
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async listSchemas(): Promise<string[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const result = await conn.execute(`SELECT username FROM all_users ORDER BY username`);
      const schemas: string[] = [];
      if (result.rows) {
        for (const row of result.rows) {
          schemas.push(String((row as any)[0]));
        }
      }
      return schemas;
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async getTables(schema?: string): Promise<DiscoveredTable[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      
      let query = `
        SELECT owner, table_name, num_rows
        FROM all_tables
      `;
      let binds: any = {};
      
      if (schema) {
        query += ` WHERE owner = :schema`;
        binds.schema = schema.toUpperCase();
      } else {
        query += ` WHERE owner = (SELECT user FROM dual)`;
      }
      
      query += ` ORDER BY owner, table_name`;
      
      const result = await conn.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      return (result.rows || []).map((r: any) => ({
        schema: r.OWNER,
        name: r.TABLE_NAME,
        type: 'BASE TABLE',
        approximateRowCount: r.NUM_ROWS ? parseInt(r.NUM_ROWS, 10) : 0
      }));
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async listTables(schema?: string): Promise<DiscoveredTable[]> {
    return this.getTables(schema);
  }

  public async getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const query = `
        SELECT column_name, data_type, nullable, data_default
        FROM all_tab_cols
        WHERE owner = :schema AND table_name = :table
        ORDER BY column_id
      `;
      
      const result = await conn.execute(query, {
        schema: schema.toUpperCase(),
        table: table.toUpperCase()
      }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      return (result.rows || []).map((r: any) => ({
        name: r.COLUMN_NAME,
        dataType: r.DATA_TYPE,
        isNullable: r.NULLABLE === 'Y',
        defaultValue: r.DATA_DEFAULT ? String(r.DATA_DEFAULT).trim() : null
      }));
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const query = `
        SELECT cols.column_name, cons.constraint_name
        FROM all_constraints cons
        JOIN all_cons_columns cols ON cons.constraint_name = cols.constraint_name AND cons.owner = cols.owner
        WHERE cons.constraint_type = 'P' 
          AND cons.owner = :schema 
          AND cons.table_name = :table
      `;
      
      const result = await conn.execute(query, {
        schema: schema.toUpperCase(),
        table: table.toUpperCase()
      }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      return (result.rows || []).map((r: any) => ({
        columnName: r.COLUMN_NAME,
        constraintName: r.CONSTRAINT_NAME
      }));
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const query = `
        SELECT 
          a.constraint_name as constraint_name,
          a.column_name as source_column,
          c_pk.owner as target_schema,
          c_pk.table_name as target_table,
          b.column_name as target_column
        FROM all_cons_columns a
        JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name
        JOIN all_constraints c_pk ON c.r_owner = c_pk.owner AND c.r_constraint_name = c_pk.constraint_name
        JOIN all_cons_columns b ON c_pk.owner = b.owner AND c_pk.constraint_name = b.constraint_name AND a.position = b.position
        WHERE c.constraint_type = 'R'
          AND a.owner = :schema
          AND a.table_name = :table
      `;
      
      const result = await conn.execute(query, {
        schema: schema.toUpperCase(),
        table: table.toUpperCase()
      }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      return (result.rows || []).map((r: any) => ({
        constraintName: r.CONSTRAINT_NAME,
        sourceColumn: r.SOURCE_COLUMN,
        targetSchema: r.TARGET_SCHEMA,
        targetTable: r.TARGET_TABLE,
        targetColumn: r.TARGET_COLUMN
      }));
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const query = `
        SELECT 
          i.index_name, 
          i.uniqueness,
          ic.column_name
        FROM all_indexes i
        JOIN all_ind_columns ic ON i.index_name = ic.index_name AND i.owner = ic.index_owner
        WHERE i.table_owner = :schema AND i.table_name = :table
        ORDER BY i.index_name, ic.column_position
      `;
      
      const result = await conn.execute(query, {
        schema: schema.toUpperCase(),
        table: table.toUpperCase()
      }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      const indexMap = new Map<string, IndexInfo>();
      
      for (const r of (result.rows as any[] || [])) {
        if (!r.INDEX_NAME) continue;
        if (!indexMap.has(r.INDEX_NAME)) {
          indexMap.set(r.INDEX_NAME, {
            indexName: r.INDEX_NAME,
            isUnique: r.UNIQUENESS === 'UNIQUE',
            isPrimary: false, // We'd need to cross-check constraints for accuracy
            columnNames: []
          });
        }
        indexMap.get(r.INDEX_NAME)!.columnNames.push(r.COLUMN_NAME);
      }
      
      return Array.from(indexMap.values());
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async getRelationships(schema?: string): Promise<DatabaseRelationship[]> {
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      let query = `
        SELECT 
          a.constraint_name as constraint_name,
          a.owner as source_schema,
          a.table_name as source_table,
          a.column_name as source_column,
          c_pk.owner as target_schema,
          c_pk.table_name as target_table,
          b.column_name as target_column
        FROM all_cons_columns a
        JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name
        JOIN all_constraints c_pk ON c.r_owner = c_pk.owner AND c.r_constraint_name = c_pk.constraint_name
        JOIN all_cons_columns b ON c_pk.owner = b.owner AND c_pk.constraint_name = b.constraint_name AND a.position = b.position
        WHERE c.constraint_type = 'R'
      `;
      let binds: any = {};
      
      if (schema) {
        query += ` AND a.owner = :schema`;
        binds.schema = schema.toUpperCase();
      }
      
      const result = await conn.execute(query, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      return (result.rows || []).map((r: any) => ({
        constraintName: r.CONSTRAINT_NAME,
        sourceSchema: r.SOURCE_SCHEMA,
        sourceTable: r.SOURCE_TABLE,
        sourceColumn: r.SOURCE_COLUMN,
        targetSchema: r.TARGET_SCHEMA,
        targetTable: r.TARGET_TABLE,
        targetColumn: r.TARGET_COLUMN
      }));
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult> {
    const targetSchema = schema || this.configParams.username!;
    
    let conn: oracledb.Connection | null = null;
    try {
      conn = await this.pool!.getConnection();
      const tblQuery = `
        SELECT num_rows
        FROM all_tables
        WHERE owner = :schema AND table_name = :table
      `;
      const tblResult = await conn.execute(tblQuery, {
        schema: targetSchema.toUpperCase(),
        table: tableName.toUpperCase()
      }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      if (!tblResult.rows || tblResult.rows.length === 0) {
        throw new Error(`Table not found: ${targetSchema}.${tableName}`);
      }
      
      const r = tblResult.rows[0] as any;
      const approximateRowCount = r.NUM_ROWS ? parseInt(r.NUM_ROWS, 10) : 0;

      const columnsMeta = await this.getTableColumns(targetSchema, tableName);
      const pks = await this.getPrimaryKeys(targetSchema, tableName);
      const fks = await this.getForeignKeys(targetSchema, tableName);
      
      const columns: TableColumnInfo[] = columnsMeta.map(col => {
        const isPk = pks.some(pk => pk.columnName === col.name);
        const matchingFk = fks.find(fk => fk.sourceColumn === col.name);
        
        return {
          name: col.name,
          dataType: col.dataType,
          isNullable: col.isNullable,
          defaultValue: col.defaultValue,
          isPrimaryKey: isPk,
          isForeignKey: !!matchingFk,
          foreignKeyTarget: matchingFk ? {
            schema: matchingFk.targetSchema,
            table: matchingFk.targetTable,
            column: matchingFk.targetColumn,
            constraintName: matchingFk.constraintName
          } : undefined
        };
      });

      const relationships = await this.getRelationships(targetSchema);
      const outgoingRelationships = relationships.filter(r => r.sourceTable.toUpperCase() === tableName.toUpperCase());
      const incomingRelationships = relationships.filter(r => r.targetTable.toUpperCase() === tableName.toUpperCase());

      return {
        schema: targetSchema,
        name: tableName,
        type: 'BASE TABLE',
        columnCount: columns.length,
        approximateRowCount,
        columns,
        outgoingRelationships,
        incomingRelationships
      };
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const validation = QuerySafetyValidator.validate(sql);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Query validation failed');
    }

    const MAX_ALLOWED_ROWS = 10000;
    const requestedMax = options?.maxRows ? Math.min(Math.max(1, options.maxRows), MAX_ALLOWED_ROWS) : 1000;
    
    let conn: oracledb.Connection | null = null;
    const startTime = Date.now();
    try {
      conn = await this.pool.getConnection();
      
      // we need to slice result because oracle returns maxRows + 1 if there's more? No, maxRows limits fetch.
      // to know if truncated, we fetch requestedMax + 1
      const result = await conn.execute(sql, [], { 
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        maxRows: requestedMax + 1,
        fetchInfo: {
          // You can specify type mapping here if needed
        }
      });
      
      const executionTimeMs = Date.now() - startTime;
      
      let columns: QueryResultColumn[] = [];
      if (result.metaData) {
        columns = result.metaData.map(col => ({
          name: col.name,
          dataType: col.dbTypeName || 'unknown'
        }));
      }
      
      const rawRows = result.rows as any[] || [];
      const totalFetched = rawRows.length;
      let isTruncated = false;
      let finalRows = rawRows;
      
      if (totalFetched > requestedMax) {
        isTruncated = true;
        finalRows = rawRows.slice(0, requestedMax);
      }
      
      return {
        columns,
        rows: finalRows,
        rowCount: finalRows.length,
        executionTimeMs,
        isTruncated,
        totalAvailableRows: isTruncated ? requestedMax + 1 : totalFetched
      };
      
    } catch (err: any) {
      throw new Error(err.message || 'Database query error');
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }

  public async cancelQuery(queryId?: string): Promise<boolean> {
    return false;
  }

  public async explainQuery(sql: string): Promise<QueryResultData> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    
    const validation = QuerySafetyValidator.validate(sql);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Query validation failed');
    }
    
    let conn: oracledb.Connection | null = null;
    const startTime = Date.now();
    try {
      conn = await this.pool.getConnection();
      
      await conn.execute(`EXPLAIN PLAN FOR ${sql}`);
      const result = await conn.execute(`SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY())`, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });
      
      const executionTimeMs = Date.now() - startTime;
      
      let columns: QueryResultColumn[] = [];
      if (result.metaData) {
        columns = result.metaData.map(col => ({
          name: col.name,
          dataType: col.dbTypeName || 'unknown'
        }));
      }
      
      return {
        columns,
        rows: result.rows as any[] || [],
        rowCount: (result.rows || []).length,
        executionTimeMs
      };
      
    } catch (err: any) {
      throw new Error(err.message || 'Database explain error');
    } finally {
      if (conn) {
        try { await conn.close(); } catch (e) {}
      }
    }
  }
}
