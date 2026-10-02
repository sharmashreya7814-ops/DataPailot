import { AbstractDatabaseAdapter } from './AbstractDatabaseAdapter';
import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';
import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, ConnectionTestResult, DiscoveredTable, TableDetailsResult, QueryResultData, QueryExecutionOptions, DatabaseRelationship, TableColumnInfo, DatabaseConnectionParams, QueryResultColumn } from './DatabaseAdapter';
import { QuerySafetyValidator } from './QuerySafetyValidator';
import mssql, { ConnectionPool } from 'mssql';

export class SQLServerAdapter extends AbstractDatabaseAdapter {
  private pool: ConnectionPool | null = null;
  private readonly configParams: DatabaseConnectionParams;

  constructor(config: DatabaseConnectionParams) {
    super(config);
    this.configParams = config;
    if (!config.host || !config.database || !config.username) {
      throw new Error('SQL Server connection requires host, database, and username');
    }
  }

  private getSqlServerConfig() {
    return {
      user: this.configParams.username,
      password: this.configParams.password || '',
      server: this.configParams.host!,
      database: this.configParams.database!,
      port: this.configParams.port ? parseInt(this.configParams.port.toString(), 10) : 1433,
      options: {
        encrypt: this.configParams.ssl !== false, // Encrypt by default for Azure
        trustServerCertificate: true, // Often needed for local/self-signed
        enableArithAbort: true,
        readOnlyIntent: true // Important for safety if AG supports it
      }
    };
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const pool = new mssql.ConnectionPool(this.getSqlServerConfig());
      await pool.connect();
      
      const result = await pool.request().query('SELECT @@VERSION as version');
      const version = result.recordset[0].version;
      
      await pool.close();

      return {
        success: true,
        databaseType: 'SQL Server',
        databaseName: this.configParams.database!,
        serverVersion: version,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        databaseType: 'SQL Server',
        databaseName: this.configParams.database!,
        latencyMs: Date.now() - startTime,
        error: err.message,
        errorCode: err.code || 'UNKNOWN'
      };
    }
  }

  public async connect(): Promise<void> {
    if (this.pool) {
      await this.disconnect();
    }
    
    this.pool = new mssql.ConnectionPool(this.getSqlServerConfig());
    await this.pool.connect();
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
      } catch (e) {}
      this.pool = null;
    }
  }

  public isConnected(): boolean {
    return this.pool !== null && this.pool.connected;
  }
  
  public getDatabaseType(): string { 
    return 'SQL Server'; 
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
      jsonFunctions: true, // Supported in modern SQL Server
      returning: true, // Via OUTPUT clause
      limitSyntax: 'FETCH'
    };
  }
  
  public getDialect(): SqlDialect {
    return {
      quoteIdentifier: (identifier: string) => `[${identifier.replace(/\]/g, ']]')}]`,
      requiresOrderByForLimit: true,
      formatLimit: (sql: string, limit: number) => {
        if (sql.match(/ORDER\s+BY/i)) {
          return `${sql}\nOFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`;
        }
        return sql.replace(/^SELECT\s+(DISTINCT\s+)?/i, `SELECT $1TOP ${limit} `);
      },
      formatPagination: (sql: string, limit: number, offset: number) => {
        if (!sql.match(/ORDER\s+BY/i)) {
          sql = `${sql}\nORDER BY 1`;
        }
        return `${sql}\nOFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      },
      formatDate: (date: Date) => `'${date.toISOString()}'`,
      formatExplain: (sql: string) => `SET SHOWPLAN_ALL ON; ${sql}; SET SHOWPLAN_ALL OFF;`,
      qualifyTable: (schema: string | undefined, table: string) => {
        const t = `[${table.replace(/\]/g, ']]')}]`;
        if (schema) {
          return `[${schema.replace(/\]/g, ']]')}].${t}`;
        }
        return t;
      },
      dialectType: 'sqlserver'
    };
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    if (!this.pool) throw new Error('Database not connected');
    const result = await this.pool.request().query('SELECT @@VERSION as version, DB_NAME() as dbname');
    
    return {
      version: result.recordset[0].version,
      database: result.recordset[0].dbname,
      system: 'SQL Server'
    };
  }

  public async listSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error('Database not connected');
    const result = await this.pool.request().query('SELECT schema_name FROM information_schema.schemata');
    return result.recordset.map(r => r.schema_name);
  }

  public async listTables(schema?: string): Promise<DiscoveredTable[]> {
    return this.getTables(schema);
  }

  public async getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || 'dbo';
    const query = `
      SELECT 
        COLUMN_NAME as name, 
        DATA_TYPE as dataType, 
        IS_NULLABLE as isNullable, 
        COLUMN_DEFAULT as defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION
    `;
    const request = this.pool.request();
    request.input('schema', mssql.NVarChar, targetSchema);
    request.input('table', mssql.NVarChar, table);
    const result = await request.query(query);
    
    return result.recordset.map(r => ({
      name: r.name,
      dataType: r.dataType,
      isNullable: r.isNullable === 'YES',
      defaultValue: r.defaultValue
    }));
  }

  public async getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || 'dbo';
    const query = `
      SELECT 
        kcu.COLUMN_NAME as columnName, 
        tc.CONSTRAINT_NAME as constraintName
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
        AND tc.TABLE_SCHEMA = @schema 
        AND tc.TABLE_NAME = @table
    `;
    const request = this.pool.request();
    request.input('schema', mssql.NVarChar, targetSchema);
    request.input('table', mssql.NVarChar, table);
    const result = await request.query(query);
    
    return result.recordset.map(r => ({
      columnName: r.columnName,
      constraintName: r.constraintName
    }));
  }

  public async getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || 'dbo';
    const query = `
      SELECT 
        fk.name AS constraintName,
        tp.name AS sourceTable,
        cp.name AS sourceColumn,
        tr.name AS targetTable,
        cr.name AS targetColumn,
        SCHEMA_NAME(tr.schema_id) AS targetSchema
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
      INNER JOIN sys.columns cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
      WHERE tp.name = @table AND SCHEMA_NAME(tp.schema_id) = @schema
    `;
    const request = this.pool.request();
    request.input('schema', mssql.NVarChar, targetSchema);
    request.input('table', mssql.NVarChar, table);
    const result = await request.query(query);
    
    return result.recordset.map(r => ({
      constraintName: r.constraintName,
      sourceColumn: r.sourceColumn,
      targetSchema: r.targetSchema,
      targetTable: r.targetTable,
      targetColumn: r.targetColumn
    }));
  }

  public async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || 'dbo';
    const query = `
      SELECT 
        i.name AS indexName,
        i.is_unique AS isUnique,
        i.is_primary_key AS isPrimary,
        c.name AS columnName
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = @table AND SCHEMA_NAME(t.schema_id) = @schema
      ORDER BY i.name, ic.key_ordinal
    `;
    const request = this.pool.request();
    request.input('schema', mssql.NVarChar, targetSchema);
    request.input('table', mssql.NVarChar, table);
    const result = await request.query(query);
    
    const indexMap = new Map<string, IndexInfo>();
    
    for (const r of result.recordset) {
      if (!r.indexName) continue; // Heap (no index) usually has NULL name or index_id = 0
      if (!indexMap.has(r.indexName)) {
        indexMap.set(r.indexName, {
          indexName: r.indexName,
          isUnique: !!r.isUnique,
          isPrimary: !!r.isPrimary,
          columnNames: []
        });
      }
      indexMap.get(r.indexName)!.columnNames.push(r.columnName);
    }
    
    return Array.from(indexMap.values());
  }

  public async getRelationships(schema?: string): Promise<DatabaseRelationship[]> {
    if (!this.pool) throw new Error('Database not connected');
    // Using a broader query that gets all FKs
    const query = `
      SELECT 
        fk.name AS constraintName,
        SCHEMA_NAME(tp.schema_id) AS sourceSchema,
        tp.name AS sourceTable,
        cp.name AS sourceColumn,
        SCHEMA_NAME(tr.schema_id) AS targetSchema,
        tr.name AS targetTable,
        cr.name AS targetColumn
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
      INNER JOIN sys.columns cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
    `;
    const result = await this.pool.request().query(query);
    
    return result.recordset as DatabaseRelationship[];
  }

  public async getTables(schema?: string): Promise<DiscoveredTable[]> {
    if (!this.pool) throw new Error('Database not connected');
    let query = `
      SELECT 
        t.TABLE_SCHEMA as 'schema',
        t.TABLE_NAME as name,
        t.TABLE_TYPE as type,
        p.rows as approximateRowCount
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
      LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0,1)
    `;
    
    const request = this.pool.request();
    if (schema) {
      query += ` WHERE t.TABLE_SCHEMA = @schema`;
      request.input('schema', mssql.NVarChar, schema);
    }
    query += ` ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME`;
    
    const result = await request.query(query);
    
    return result.recordset.map(r => ({
      schema: r.schema,
      name: r.name,
      type: r.type,
      approximateRowCount: r.approximateRowCount ? parseInt(r.approximateRowCount, 10) : 0
    }));
  }

  public async getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || 'dbo';
    
    const tblQuery = `
      SELECT 
        t.TABLE_TYPE as type, 
        p.rows as approximateRowCount
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
      LEFT JOIN sys.partitions p ON st.object_id = p.object_id AND p.index_id IN (0,1)
      WHERE t.TABLE_SCHEMA = @schema AND t.TABLE_NAME = @table
    `;
    const request = this.pool.request();
    request.input('schema', mssql.NVarChar, targetSchema);
    request.input('table', mssql.NVarChar, tableName);
    const tblResult = await request.query(tblQuery);
    
    if (tblResult.recordset.length === 0) {
      throw new Error(`Table not found: ${targetSchema}.${tableName}`);
    }
    const tblInfo = tblResult.recordset[0];

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
    const outgoingRelationships = relationships.filter(r => r.sourceTable === tableName && r.sourceSchema === targetSchema);
    const incomingRelationships = relationships.filter(r => r.targetTable === tableName && r.targetSchema === targetSchema);

    return {
      schema: targetSchema,
      name: tableName,
      type: tblInfo.type,
      columnCount: columns.length,
      approximateRowCount: tblInfo.approximateRowCount ? parseInt(tblInfo.approximateRowCount, 10) : 0,
      columns,
      outgoingRelationships,
      incomingRelationships
    };
  }

  public async executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const validation = QuerySafetyValidator.validate(sql);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Query validation failed');
    }

    // SQL Server does not have a simple global read-only flag that applies per query in the standard way,
    // (though ApplicationIntent=ReadOnly works for AGs). 
    // The Validator should handle the core AST/Regex checks for EXEC/INSERT/etc.

    const MAX_ALLOWED_ROWS = 10000;
    const requestedMax = options?.maxRows ? Math.min(Math.max(1, options.maxRows), MAX_ALLOWED_ROWS) : 1000;
    
    // We cannot reliably append TOP or OFFSET without fully parsing SQL Server query syntax.
    // We will execute and slice the result set in memory for safety, though a real proxy would limit the stream.
    
    const startTime = Date.now();
    try {
      const request = this.pool.request();
      (request as any).arrayRowMode = true;
      
      const result = await request.query(sql);
      const executionTimeMs = Date.now() - startTime;
      
      const rawRows = result.recordset || [];
      const columnsMeta = (rawRows as any).columns || [];
      
      const mappedColumnsMeta = columnsMeta.map((col: any) => ({
        name: col.name,
        dataType: (col.type && col.type.name) ? col.type.name : 'unknown'
      }));
      
      const totalAvailableRows = rawRows.length;
      let finalRows = rawRows as any[][];
      const isTruncated = rawRows.length > requestedMax;
      
      if (isTruncated) {
        finalRows = rawRows.slice(0, requestedMax);
      }
      
      const normalized = this.normalizeArrayRowResults(mappedColumnsMeta, finalRows);
      
      return {
        columns: normalized.columns as any[],
        rows: normalized.rows,
        rowCount: normalized.rows.length,
        executionTimeMs,
        isTruncated,
        totalAvailableRows
      };
      
    } catch (err: any) {
      throw new Error(err.message || 'Database query error');
    }
  }

  public async cancelQuery(queryId?: string): Promise<boolean> {
    // Note: To properly cancel, we'd need to store the `request` object and call `request.cancel()`.
    // For now, return false.
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
    
    const startTime = Date.now();
    try {
      const request = this.pool.request();
      
      // SQL Server specific EXPLAIN
      await request.query('SET SHOWPLAN_ALL ON');
      const result = await request.query(sql);
      await request.query('SET SHOWPLAN_ALL OFF');
      
      const executionTimeMs = Date.now() - startTime;
      const rawRows = result.recordset || [];
      const columnsMeta = (rawRows as any).columns;
      
      let columns: QueryResultColumn[] = [];
      if (columnsMeta) {
        columns = Object.keys(columnsMeta).map(colName => ({
          name: colName,
          dataType: (columnsMeta[colName].type && columnsMeta[colName].type.name) ? columnsMeta[colName].type.name : 'unknown'
        }));
      } else if (rawRows.length > 0) {
        columns = Object.keys(rawRows[0]).map(k => ({ name: k, dataType: 'unknown' }));
      }
      
      return {
        columns,
        rows: rawRows,
        rowCount: rawRows.length,
        executionTimeMs
      };
      
    } catch (err: any) {
      throw new Error(err.message || 'Database explain error');
    }
  }
}
