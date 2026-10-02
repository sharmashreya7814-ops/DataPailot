import { AbstractDatabaseAdapter } from './AbstractDatabaseAdapter';
import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';
import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, ConnectionTestResult, DiscoveredTable, TableDetailsResult, QueryResultData, QueryExecutionOptions, DatabaseRelationship, TableColumnInfo, DatabaseConnectionParams } from './DatabaseAdapter';
import { QuerySafetyValidator } from './QuerySafetyValidator';
import mysql, { Connection, Pool } from 'mysql2/promise';

export class MySQLAdapter extends AbstractDatabaseAdapter {
  private pool: Pool | null = null;
  

  constructor(config: DatabaseConnectionParams) {
    super(config);
    this.config = config;
    if (!config.host || !config.database || !config.username) {
      throw new Error('MySQL connection requires host, database, and username');
    }
  }

  private getMySqlConfig() {
    return {
      host: this.config.host,
      port: this.config.port ? parseInt(this.config.port.toString(), 10) : 3306,
      user: this.config.username,
      password: this.config.password || '',
      database: this.config.database,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
      multipleStatements: false, // Ensure multi-statements are disabled for security
      dateStrings: true // Return dates as strings to avoid timezone shift
    };
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const conn = await mysql.createConnection(this.getMySqlConfig());
      
      const [rows] = await conn.query('SELECT VERSION() as version');
      const version = Array.isArray(rows) && rows.length > 0 ? (rows as any)[0].version : 'unknown';
      
      await conn.end();

      return {
        success: true,
        databaseType: 'MySQL',
        databaseName: this.config.database!,
        serverVersion: version,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        databaseType: 'MySQL',
        databaseName: this.config.database!,
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
    
    this.pool = mysql.createPool(this.getMySqlConfig());
    
    // Test the pool
    const conn = await this.pool.getConnection();
    conn.release();
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (e) {}
      this.pool = null;
    }
  }

  public isConnected(): boolean {
    return this.pool !== null;
  }
  
  public getDatabaseType(): string { 
    return 'MySQL'; 
  }
  
  public getCapabilities(): DatabaseCapabilities {
    return {
      transactions: true,
      explain: true,
      cancelQuery: false, // Not easily supported without connection tracking
      schemas: true,      // MySQL uses databases as schemas
      foreignKeys: true,
      indexes: true,
      windowFunctions: true, // MySQL >= 8.0
      dateFunctions: true,
      jsonFunctions: true,   // MySQL >= 5.7
      returning: false,      // MySQL doesn't natively support RETURNING clause for all DML
      limitSyntax: 'LIMIT'
    };
  }
  
  public getDialect(): SqlDialect {
    return {
      quoteIdentifier: (identifier: string) => `\`${identifier.replace(/`/g, '``')}\``,
      formatLimit: (sql: string, limit: number) => `${sql}\nLIMIT ${limit}`,
      formatPagination: (sql: string, limit: number, offset: number) => `${sql}\nLIMIT ${offset}, ${limit}`,
      formatDate: (date: Date) => `'${date.toISOString().slice(0, 19).replace('T', ' ')}'`,
      formatExplain: (sql: string) => `EXPLAIN ${sql}`,
      qualifyTable: (schema: string | undefined, table: string) => {
        const t = `\`${table.replace(/`/g, '``')}\``;
        if (schema) {
          return `\`${schema.replace(/`/g, '``')}\`.${t}`;
        }
        return t;
      },
      dialectType: 'mysql'
    };
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    if (!this.pool) throw new Error('Database not connected');
    const [rows] = await this.pool.query('SELECT VERSION() as version');
    const version = Array.isArray(rows) && rows.length > 0 ? (rows as any)[0].version : 'unknown';
    
    return {
      version,
      database: this.config.database!,
      system: 'MySQL'
    };
  }

  public async listSchemas(): Promise<string[]> {
    if (!this.pool) throw new Error('Database not connected');
    const [rows] = await this.pool.query('SHOW DATABASES');
    return (rows as any[]).map(r => r.Database);
  }

  public async listTables(schema?: string): Promise<DiscoveredTable[]> {
    return this.getTables(schema);
  }

  public async getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    const query = `
      SELECT 
        COLUMN_NAME as name, 
        DATA_TYPE as dataType, 
        IS_NULLABLE as isNullable, 
        COLUMN_DEFAULT as defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;
    const [rows] = await this.pool.query(query, [targetSchema, table]);
    
    return (rows as any[]).map(r => ({
      name: r.name,
      dataType: r.dataType,
      isNullable: r.isNullable === 'YES',
      defaultValue: r.defaultValue
    }));
  }

  public async getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    const query = `
      SELECT COLUMN_NAME as columnName, CONSTRAINT_NAME as constraintName
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
    `;
    const [rows] = await this.pool.query(query, [targetSchema, table]);
    
    return (rows as any[]).map(r => ({
      columnName: r.columnName,
      constraintName: r.constraintName
    }));
  }

  public async getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    const query = `
      SELECT 
        CONSTRAINT_NAME as constraintName,
        COLUMN_NAME as sourceColumn,
        REFERENCED_TABLE_SCHEMA as targetSchema,
        REFERENCED_TABLE_NAME as targetTable,
        REFERENCED_COLUMN_NAME as targetColumn
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `;
    const [rows] = await this.pool.query(query, [targetSchema, table]);
    
    return (rows as any[]).map(r => ({
      constraintName: r.constraintName,
      sourceColumn: r.sourceColumn,
      targetSchema: r.targetSchema,
      targetTable: r.targetTable,
      targetColumn: r.targetColumn
    }));
  }

  public async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    const query = `
      SELECT 
        INDEX_NAME as indexName, 
        NON_UNIQUE as nonUnique, 
        COLUMN_NAME as columnName
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;
    const [rows] = await this.pool.query(query, [targetSchema, table]);
    
    const indexMap = new Map<string, IndexInfo>();
    
    for (const r of (rows as any[])) {
      if (!indexMap.has(r.indexName)) {
        indexMap.set(r.indexName, {
          indexName: r.indexName,
          isUnique: r.nonUnique === 0,
          isPrimary: r.indexName === 'PRIMARY',
          columnNames: []
        });
      }
      indexMap.get(r.indexName)!.columnNames.push(r.columnName);
    }
    
    return Array.from(indexMap.values());
  }

  public async getRelationships(schema?: string): Promise<DatabaseRelationship[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    
    const query = `
      SELECT 
        CONSTRAINT_NAME as constraintName,
        TABLE_SCHEMA as sourceSchema,
        TABLE_NAME as sourceTable,
        COLUMN_NAME as sourceColumn,
        REFERENCED_TABLE_SCHEMA as targetSchema,
        REFERENCED_TABLE_NAME as targetTable,
        REFERENCED_COLUMN_NAME as targetColumn
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `;
    const [rows] = await this.pool.query(query, [targetSchema]);
    
    return rows as DatabaseRelationship[];
  }

  public async getTables(schema?: string): Promise<DiscoveredTable[]> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    const query = `
      SELECT 
        TABLE_SCHEMA as 'schema',
        TABLE_NAME as name,
        TABLE_TYPE as type,
        TABLE_ROWS as approximateRowCount
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `;
    const [rows] = await this.pool.query(query, [targetSchema]);
    
    return (rows as any[]).map(r => ({
      schema: r.schema,
      name: r.name,
      type: r.type,
      approximateRowCount: r.approximateRowCount ? parseInt(r.approximateRowCount, 10) : 0
    }));
  }

  public async getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult> {
    if (!this.pool) throw new Error('Database not connected');
    const targetSchema = schema || this.config.database;
    
    // Get table metadata
    const tblQuery = `
      SELECT TABLE_TYPE as type, TABLE_ROWS as approximateRowCount
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `;
    const [tblRows] = await this.pool.query(tblQuery, [targetSchema, tableName]);
    if (!Array.isArray(tblRows) || tblRows.length === 0) {
      throw new Error(`Table not found: ${targetSchema}.${tableName}`);
    }
    const tblInfo = (tblRows as any[])[0];

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
    const outgoingRelationships = relationships.filter(r => r.sourceTable === tableName);
    const incomingRelationships = relationships.filter(r => r.targetTable === tableName);

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

    const MAX_ALLOWED_ROWS = 10000;
    const requestedMax = options?.maxRows ? Math.min(Math.max(1, options.maxRows), MAX_ALLOWED_ROWS) : 1000;
    
    const startTime = Date.now();
    try {
      const [rows, fields] = await this.pool.query(sql);
      const executionTimeMs = Date.now() - startTime;
      
      if (!Array.isArray(rows)) {
        // Query did not return rows (e.g. somehow bypassed but was OK)
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
          totalAvailableRows: 0
        };
      }
      
      if (rows.length === 0) {
        return {
          columns: fields ? fields.map(f => ({
            name: f.name,
            dataType: f.columnType ? f.columnType.toString() : 'unknown'
          })) : [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
          totalAvailableRows: 0
        };
      }
      
      // Determine columns based on fields
      const columns = fields ? fields.map(f => {
        let type = 'unknown';
        // Basic mapping of MySQL types to our simple types
        if ([1, 2, 3, 4, 5, 8, 9, 246].includes(f.columnType)) type = 'numeric'; // tinyint, smallint, int, float, double, etc
        else if ([10, 11, 12, 13, 14, 7].includes(f.columnType)) type = 'date'; // date, time, datetime, timestamp
        else type = 'text'; // varchar, text, etc
        
        return { name: f.name, dataType: type };
      }) : Object.keys((rows as any[])[0]).map(k => ({ name: k, dataType: 'unknown' }));
      
      const totalAvailableRows = rows.length;
      let finalRows = rows as any[];
      const isTruncated = rows.length > requestedMax;
      if (isTruncated) {
        finalRows = finalRows.slice(0, requestedMax);
      }
      
      return {
        columns,
        rows: finalRows,
        rowCount: finalRows.length,
        executionTimeMs,
        isTruncated,
        totalAvailableRows
      };
      
    } catch (err: any) {
      throw new Error(err.message || 'Database query error');
    }
  }

  public async cancelQuery(queryId?: string): Promise<boolean> {
    return false;
  }

  public async explainQuery(sql: string): Promise<QueryResultData> {
    // We add FORMAT=JSON if supported, but EXPLAIN is sufficient for generic handling
    return this.executeReadOnlyQuery(this.getDialect().formatExplain(sql));
  }
}
