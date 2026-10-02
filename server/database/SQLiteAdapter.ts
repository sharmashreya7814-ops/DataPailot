import { AbstractDatabaseAdapter } from './AbstractDatabaseAdapter';
import { DatabaseCapabilities } from './DatabaseCapabilities';
import { SqlDialect } from './SqlDialect';
import { DatabaseMetadata, ColumnMetadata, PrimaryKeyInfo, ForeignKeyInfo, IndexInfo, ConnectionTestResult, DiscoveredTable, TableDetailsResult, QueryResultData, QueryExecutionOptions, DatabaseRelationship, TableColumnInfo, DatabaseConnectionParams } from './DatabaseAdapter';
import { QuerySafetyValidator } from './QuerySafetyValidator';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export class SQLiteAdapter extends AbstractDatabaseAdapter {
  private db: DatabaseSync | null = null;
  private readonly resolvedPath: string;

  constructor(config: DatabaseConnectionParams) {
    super(config);
    if (!config.filePath) {
      throw new Error('SQLite connection requires a filePath');
    }
    
    const rawPath = config.filePath;
    
    if (path.isAbsolute(rawPath)) {
      this.resolvedPath = path.normalize(rawPath);
    } else {
      this.resolvedPath = path.resolve(process.cwd(), rawPath);
    }
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      if (!fs.existsSync(this.resolvedPath)) {
        return {
          success: false,
          databaseType: 'SQLite',
          databaseName: path.basename(this.resolvedPath),
          latencyMs: Date.now() - startTime,
          error: `Database file not found: ${this.resolvedPath}`,
          errorCode: 'ENOENT'
        };
      }

      const tempDb = new DatabaseSync(this.resolvedPath, { open: true });
      const stmt = tempDb.prepare('SELECT sqlite_version() as version;');
      const res = stmt.get() as any;
      tempDb.close();

      return {
        success: true,
        databaseType: 'SQLite',
        databaseName: path.basename(this.resolvedPath),
        serverVersion: res.version,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        databaseType: 'SQLite',
        databaseName: path.basename(this.resolvedPath),
        latencyMs: Date.now() - startTime,
        error: err.message,
        errorCode: err.code || 'UNKNOWN'
      };
    }
  }

  public async connect(): Promise<void> {
    if (this.db) {
      await this.disconnect();
    }
    
    if (!fs.existsSync(this.resolvedPath)) {
      throw new Error(`Database file not found: ${this.resolvedPath}`);
    }

    this.db = new DatabaseSync(this.resolvedPath, { open: true });
    
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  public async disconnect(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {}
      this.db = null;
    }
  }

  public isConnected(): boolean {
    return this.db !== null;
  }
  
  public getDatabaseType(): string { 
    return 'SQLite'; 
  }
  
  public getCapabilities(): DatabaseCapabilities {
    return {
      transactions: true,
      explain: true,
      cancelQuery: false,
      schemas: false,
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
      formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`,
      formatDate: (date: Date) => `'${date.toISOString()}'`,
      formatExplain: (sql: string) => `EXPLAIN QUERY PLAN ${sql}`,
      qualifyTable: (schema: string | undefined, table: string) => `"${table.replace(/"/g, '""')}"`,
      dialectType: 'sqlite'
    };
  }

  public async getDatabaseMetadata(): Promise<DatabaseMetadata> {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare('SELECT sqlite_version() as version;');
    const res = stmt.get() as any;
    return {
      version: res.version,
      database: path.basename(this.resolvedPath),
      system: 'SQLite'
    };
  }

  public async listSchemas(): Promise<string[]> {
    return ['main'];
  }

  public async listTables(schema?: string): Promise<DiscoveredTable[]> {
    return this.getTables(schema);
  }

  public async getTableColumns(schema: string, table: string): Promise<ColumnMetadata[]> {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`);
    const pragma = stmt.all() as any[];
    return pragma.map(col => ({
      name: col.name,
      dataType: col.type || 'TEXT',
      isNullable: col.notnull === 0,
      defaultValue: col.dflt_value
    }));
  }

  public async getPrimaryKeys(schema: string, table: string): Promise<PrimaryKeyInfo[]> {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`);
    const pragma = stmt.all() as any[];
    return pragma
      .filter(col => col.pk > 0)
      .map(col => ({
        columnName: col.name,
        constraintName: 'PK_' + table
      }));
  }

  public async getForeignKeys(schema: string, table: string): Promise<ForeignKeyInfo[]> {
    if (!this.db) throw new Error('Database not connected');
    const stmt = this.db.prepare(`PRAGMA foreign_key_list("${table.replace(/"/g, '""')}")`);
    const pragma = stmt.all() as any[];
    return pragma.map(fk => ({
      constraintName: `FK_${table}_${fk.id}`,
      sourceColumn: fk.from,
      targetSchema: 'main',
      targetTable: fk.table,
      targetColumn: fk.to
    }));
  }

  public async getIndexes(schema: string, table: string): Promise<IndexInfo[]> {
    if (!this.db) throw new Error('Database not connected');
    const safeTable = table.replace(/"/g, '""');
    const stmt = this.db.prepare(`PRAGMA index_list("${safeTable}")`);
    const indexes = stmt.all() as any[];
    const results: IndexInfo[] = [];
    
    for (const idx of indexes) {
      const idxStmt = this.db.prepare(`PRAGMA index_info("${idx.name.replace(/"/g, '""')}")`);
      const idxInfo = idxStmt.all() as any[];
      results.push({
        indexName: idx.name,
        isUnique: idx.unique === 1,
        isPrimary: idx.origin === 'pk',
        columnNames: idxInfo.map(i => i.name)
      });
    }
    
    return results;
  }

  public async getRelationships(schema?: string): Promise<DatabaseRelationship[]> {
    if (!this.db) throw new Error('Database not connected');
    const tables = await this.listTables();
    const relationships: DatabaseRelationship[] = [];
    
    for (const tbl of tables) {
      const fks = await this.getForeignKeys('', tbl.name);
      for (const fk of fks) {
        relationships.push({
          constraintName: fk.constraintName,
          sourceSchema: 'main',
          sourceTable: tbl.name,
          sourceColumn: fk.sourceColumn,
          targetSchema: 'main',
          targetTable: fk.targetTable,
          targetColumn: fk.targetColumn
        });
      }
    }
    
    return relationships;
  }

  public async getTables(schema?: string): Promise<DiscoveredTable[]> {
    if (!this.db) throw new Error('Database not connected');
    const query = `
      SELECT name, type 
      FROM sqlite_schema 
      WHERE type IN ('table','view') 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];
    
    const results: DiscoveredTable[] = [];
    for (const r of rows) {
      let count = 0;
      if (r.type === 'table') {
        try {
          const countStmt = this.db.prepare(`SELECT COUNT(*) as c FROM "${r.name.replace(/"/g, '""')}"`);
          const countRes = countStmt.get() as any;
          count = countRes ? countRes.c : 0;
        } catch(e) {}
      }
      results.push({
        schema: 'main',
        name: r.name,
        type: r.type === 'view' ? 'VIEW' : 'BASE TABLE',
        approximateRowCount: count
      });
    }
    return results;
  }

  public async getTableDetails(schema: string, tableName: string): Promise<TableDetailsResult> {
    if (!this.db) throw new Error('Database not connected');
    
    const infoStmt = this.db.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`);
    const pragma = infoStmt.all() as any[];
    
    if (pragma.length === 0) {
      throw new Error(`Table not found: ${tableName}`);
    }
    
    const fks = await this.getForeignKeys('', tableName);
    
    let count = 0;
    try {
      const countStmt = this.db.prepare(`SELECT COUNT(*) as c FROM "${tableName.replace(/"/g, '""')}"`);
      const countRes = countStmt.get() as any;
      count = countRes ? countRes.c : 0;
    } catch(e) {}

    const columns: TableColumnInfo[] = pragma.map(col => {
      const isPk = col.pk > 0;
      const matchingFk = fks.find(f => f.sourceColumn === col.name);
      
      return {
        name: col.name,
        dataType: col.type || 'TEXT',
        isNullable: col.notnull === 0,
        defaultValue: col.dflt_value,
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

    const relationships = await this.getRelationships();
    const outgoingRelationships = relationships.filter(r => r.sourceTable === tableName);
    const incomingRelationships = relationships.filter(r => r.targetTable === tableName);

    return {
      schema: 'main',
      name: tableName,
      type: 'BASE TABLE',
      columnCount: columns.length,
      approximateRowCount: count,
      columns,
      outgoingRelationships,
      incomingRelationships
    };
  }

  public async executeReadOnlyQuery(sql: string, options?: QueryExecutionOptions): Promise<QueryResultData> {
    if (!this.db) {
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
      const stmt = this.db.prepare(sql);
      const rows = stmt.all() as any[];
      const executionTimeMs = Date.now() - startTime;
      
      if (rows.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs,
          totalAvailableRows: 0
        };
      }
      
      const firstRow = rows[0];
      const columns = Object.keys(firstRow).map(key => ({
        name: key,
        dataType: typeof firstRow[key] === 'number' ? 'numeric' : 'text'
      }));
      
      const totalAvailableRows = rows.length;
      let finalRows = rows;
      const isTruncated = rows.length > requestedMax;
      if (isTruncated) {
        finalRows = rows.slice(0, requestedMax);
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
      const msg = err.message ? err.message.replace(/^SQLITE_ERROR:\s*/i, '') : 'Database query error';
      throw new Error(msg);
    }
  }

  public async cancelQuery(queryId?: string): Promise<boolean> {
    return false;
  }

  public async explainQuery(sql: string): Promise<QueryResultData> {
    return this.executeReadOnlyQuery(this.getDialect().formatExplain(sql));
  }
}
