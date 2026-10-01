import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Router, Request, Response } from 'express';
import { ConnectionManager } from '../database/ConnectionManager';
import { UnifiedDataLayer } from '../import/UnifiedDataLayer';
import { getSessionId } from './connectionRoutes';
import { getSessionDatasetStoreKey } from '../utils/workspaceHelper';
import { ApiValidation } from '../utils/apiValidation';
import { ApiResponse } from '../utils/apiResponse';
import { Logger } from '../utils/logger';
import { AuditLogger } from '../utils/auditLogger';

export const schemaRoutes = Router();
const connectionManager = ConnectionManager.getInstance();
const unifiedDataLayer = UnifiedDataLayer.getInstance();

/**
 * GET /api/database/tables
 * Discovers all tables from the connected database schema and imported datasets
 */
schemaRoutes.get('/tables', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const storeKey = getSessionDatasetStoreKey(req, res);
    const adapter = connectionManager.getAdapter(sessionId);
    const importedTables = unifiedDataLayer.listDiscoveredTables(storeKey);

    if (!adapter || !adapter.isConnected()) {
      res.json({
        success: true,
        tables: importedTables,
        count: importedTables.length
      });
      return;
    }

    const schemaParam = req.query.schema as string | undefined;
    if (schemaParam) {
      const schemaVal = ApiValidation.validateIdentifier(schemaParam, 'Schema');
      if (!schemaVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_SCHEMA_IDENTIFIER', schemaVal.error || 'Invalid schema identifier.');
        return;
      }
    }

    const tables = await adapter.getTables(schemaParam);
    const allTables = [...tables, ...importedTables];

    res.json({
      success: true,
      tables: allTables,
      count: allTables.length
    });
  } catch (err: any) {
    Logger.error('Failed to discover tables', err);
    ApiResponse.error(res, 500, 'TABLE_DISCOVERY_FAILED', err.message || 'Failed to discover tables from database');
  }
});

/**
 * GET /api/database/tables/:schema/:table
 * Retrieves detailed column definitions, PKs, FKs, and row count for a table
 */
schemaRoutes.get('/tables/:schema/:table', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const storeKey = getSessionDatasetStoreKey(req, res);
    const adapter = connectionManager.getAdapter(sessionId);
    const { schema, table } = req.params;

    // Check if it's an imported dataset
    if (schema === 'imported' || !adapter || !adapter.isConnected()) {
      const importedDetails = unifiedDataLayer.getTableDetails(storeKey, table);
      if (importedDetails) {
        res.json({
          success: true,
          table: importedDetails
        });
        return;
      }
    }

    if (!adapter || !adapter.isConnected()) {
      ApiResponse.error(res, 400, 'NOT_CONNECTED', 'No database connected. Please connect a database first.');
      return;
    }

    const schemaVal = ApiValidation.validateIdentifier(schema, 'Schema');
    if (!schemaVal.isValid) {
      ApiResponse.error(res, 400, 'INVALID_IDENTIFIER', schemaVal.error || 'Invalid schema name.');
      return;
    }

    const tableVal = ApiValidation.validateIdentifier(table, 'Table');
    if (!tableVal.isValid) {
      ApiResponse.error(res, 400, 'INVALID_IDENTIFIER', tableVal.error || 'Invalid table name.');
      return;
    }

    const details = await adapter.getTableDetails(schemaVal.cleanName!, tableVal.cleanName!);
    res.json({
      success: true,
      table: details
    });
  } catch (err: any) {
    Logger.error('Failed to inspect table schema', err);
    ApiResponse.error(res, 500, 'SCHEMA_INSPECTION_FAILED', err.message || 'Failed to inspect table schema');
  }
});

/**
 * POST /api/database/refresh
 * Introspects and returns fresh tables and confirmed foreign-key relationships
 */
schemaRoutes.post('/refresh', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const sessionId = getSessionId(req, res);

  try {
    const adapter = connectionManager.getAdapter(sessionId);

    if (!adapter || !adapter.isConnected()) {
      ApiResponse.error(res, 400, 'NOT_CONNECTED', 'No database connected. Please connect a database first.');
      return;
    }

    const schemaParam = req.body?.schema as string | undefined;
    if (schemaParam) {
      const schemaVal = ApiValidation.validateIdentifier(schemaParam, 'Schema');
      if (!schemaVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_SCHEMA_IDENTIFIER', schemaVal.error || 'Invalid schema name.');
        return;
      }
    }

    const [tables, relationships] = await Promise.all([
      adapter.getTables(schemaParam),
      adapter.getRelationships(schemaParam)
    ]);

    const durationMs = Date.now() - startTime;

    AuditLogger.record({
      type: 'SCHEMA_REFRESHED',
      sessionId,
      status: 'success',
      durationMs,
      details: {
        tableCount: tables.length,
        relationshipCount: relationships.length
      }
    });

    Logger.info('Schema refreshed', {
      sessionId,
      tableCount: tables.length,
      relationshipCount: relationships.length,
      durationMs
    });

    res.json({
      success: true,
      tables,
      relationships,
      tableCount: tables.length,
      relationshipCount: relationships.length,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    Logger.error('Failed to refresh schema', err, { sessionId });
    ApiResponse.error(res, 500, 'SCHEMA_REFRESH_FAILED', err.message || 'Failed to refresh schema');
  }
});

/**
 * GET /api/database/relationships
 * Discovers foreign-key relationships across tables
 */
schemaRoutes.get('/relationships', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionId(req, res);
    const adapter = connectionManager.getAdapter(sessionId);

    if (!adapter || !adapter.isConnected()) {
      res.json({
        success: true,
        relationships: [],
        count: 0
      });
      return;
    }

    const schemaParam = req.query.schema as string | undefined;
    if (schemaParam) {
      const schemaVal = ApiValidation.validateIdentifier(schemaParam, 'Schema');
      if (!schemaVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_SCHEMA_IDENTIFIER', schemaVal.error || 'Invalid schema name.');
        return;
      }
    }

    const relationships = await adapter.getRelationships(schemaParam);

    res.json({
      success: true,
      relationships,
      count: relationships.length
    });
  } catch (err: any) {
    Logger.error('Failed to discover relationships', err);
    ApiResponse.error(res, 500, 'RELATIONSHIP_DISCOVERY_FAILED', err.message || 'Failed to discover relationships');
  }
});

/**
 * GET /api/database/filter-values
 * Retrieves distinct, non-null values for a target database column across connected adapter or imported datasets.
 * Respects SQL dialect identifier quoting and read-only protections.
 */
schemaRoutes.get('/filter-values', async (req: Request, res: Response) => {
  const sessionId = getSessionId(req, res);
  const storeKey = getSessionDatasetStoreKey(req, res);
  let parsedColumn = (typeof req.query.column === 'string' ? req.query.column : '').trim();
  let parsedTable = (typeof req.query.table === 'string' ? req.query.table : '').trim();
  let parsedSchema = (typeof req.query.schema === 'string' ? req.query.schema : '').trim();

  if (!parsedColumn) {
    ApiResponse.error(res, 400, 'MISSING_COLUMN', 'Target database column is required.');
    return;
  }

  // Support qualified identifiers like "customers.gender" or "public.customers.gender"
  if (parsedColumn.includes('.')) {
    const parts = parsedColumn.split('.');
    if (parts.length === 2) {
      if (!parsedTable) parsedTable = parts[0];
      parsedColumn = parts[1];
    } else if (parts.length === 3) {
      if (!parsedSchema) parsedSchema = parts[0];
      if (!parsedTable) parsedTable = parts[1];
      parsedColumn = parts[2];
    }
  }

  const colVal = ApiValidation.validateIdentifier(parsedColumn, 'Column');
  if (!colVal.isValid) {
    ApiResponse.error(res, 400, 'INVALID_IDENTIFIER', colVal.error || 'Invalid column name.');
    return;
  }

  const adapter = connectionManager.getAdapter(sessionId);
  const importedDatasets = unifiedDataLayer.getDatasets(storeKey);

  const queryImported = async (tableName: string, colName: string): Promise<string[] | null> => {
    const ds = unifiedDataLayer.findDataset(storeKey, tableName);
    if (!ds) return null;
    const colExists = ds.columns.some(c => c.name.toLowerCase() === colName.toLowerCase());
    if (!colExists) return null;
    const cleanSql = `SELECT DISTINCT "${colName.replace(/"/g, '""')}" AS "val" FROM "${ds.tableName.replace(/"/g, '""')}" WHERE "${colName.replace(/"/g, '""')}" IS NOT NULL ORDER BY "val" LIMIT 1000`;
    const qRes = await unifiedDataLayer.executeQuery(storeKey, cleanSql, { maxRows: 1000 });
    return qRes.rows
      .map(r => r['val'])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      .map(v => String(v));
  };

  const queryDemoDb = (tableName: string | undefined, colName: string): { values: string[]; table: string } | null => {
    try {
      const demoPath = path.join(process.cwd(), 'data', 'datapilot_demo.sqlite');
      if (!fs.existsSync(demoPath)) return null;
      const db = new DatabaseSync(demoPath);
      try {
        let matchedTable = tableName;
        if (!matchedTable) {
          const userTables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
          for (const tbl of userTables) {
            const cols = db.prepare(`PRAGMA table_info("${tbl.name.replace(/"/g, '""')}")`).all() as any[];
            if (cols.some((c: any) => c.name.toLowerCase() === colName.toLowerCase())) {
              matchedTable = tbl.name;
              break;
            }
          }
        } else {
          const cols = db.prepare(`PRAGMA table_info("${matchedTable.replace(/"/g, '""')}")`).all() as any[];
          const hasCol = cols.some((c: any) => c.name.toLowerCase() === colName.toLowerCase());
          if (!hasCol) return null;
        }

        if (!matchedTable) return null;

        const safeTable = matchedTable.replace(/"/g, '""');
        const safeCol = colName.replace(/"/g, '""');
        const stmt = db.prepare(`SELECT DISTINCT "${safeCol}" AS val FROM "${safeTable}" WHERE "${safeCol}" IS NOT NULL ORDER BY val LIMIT 1000`);
        const rows = stmt.all() as any[];
        const values = Array.from(new Set(
          rows
            .map((r: any) => r.val)
            .filter((v: any) => v !== null && v !== undefined && String(v).trim() !== '')
            .map((v: any) => String(v))
        ));
        return { values, table: matchedTable };
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  };

  try {
    if (parsedTable) {
      const tblVal = ApiValidation.validateIdentifier(parsedTable, 'Table');
      if (!tblVal.isValid) {
        ApiResponse.error(res, 400, 'INVALID_IDENTIFIER', tblVal.error || 'Invalid table name.');
        return;
      }

      if (parsedSchema === 'imported') {
        const importedVals = await queryImported(tblVal.cleanName!, colVal.cleanName!);
        if (importedVals !== null) {
          const uniqueVals = Array.from(new Set(importedVals));
          res.json({ success: true, values: uniqueVals, column: colVal.cleanName, table: tblVal.cleanName });
          return;
        }
      }

      if (adapter && adapter.isConnected()) {
        try {
          const targetSchema = parsedSchema || (adapter.getDatabaseType() === 'PostgreSQL' ? 'public' : 'main');
          const details = await adapter.getTableDetails(targetSchema, tblVal.cleanName!);
          const matchedCol = details.columns.find(c => c.name.toLowerCase() === colVal.cleanName!.toLowerCase());
          if (matchedCol) {
            const dialect = adapter.getDialect();
            const quotedCol = dialect.quoteIdentifier(matchedCol.name);
            const qualifiedTable = dialect.qualifyTable(details.schema, details.name);
            const distinctSql = `SELECT DISTINCT ${quotedCol} AS "val" FROM ${qualifiedTable} WHERE ${quotedCol} IS NOT NULL ORDER BY "val" LIMIT 1000;`;

            const qRes = await adapter.executeReadOnlyQuery(distinctSql, { maxRows: 1000 });
            const values = Array.from(new Set(
              qRes.rows
                .map(r => r['val'])
                .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
                .map(v => String(v))
            ));

            res.json({ success: true, values, column: matchedCol.name, table: details.name });
            return;
          }
        } catch {
          // Continue to imported datasets / demo database if not found in adapter
        }
      }

      const importedVals = await queryImported(tblVal.cleanName!, colVal.cleanName!);
      if (importedVals !== null) {
        const uniqueVals = Array.from(new Set(importedVals));
        res.json({ success: true, values: uniqueVals, column: colVal.cleanName, table: tblVal.cleanName });
        return;
      }

      const demoResult = queryDemoDb(tblVal.cleanName!, colVal.cleanName!);
      if (demoResult !== null) {
        res.json({ success: true, values: demoResult.values, column: colVal.cleanName, table: demoResult.table });
        return;
      }

      ApiResponse.error(res, 404, 'COLUMN_NOT_FOUND', `Column "${colVal.cleanName}" not found in table "${tblVal.cleanName}".`);
      return;
    }

    if (adapter && adapter.isConnected()) {
      const tables = await adapter.getTables(parsedSchema || undefined);
      for (const t of tables) {
        try {
          const details = await adapter.getTableDetails(t.schema, t.name);
          const matchedCol = details.columns.find(c => c.name.toLowerCase() === colVal.cleanName!.toLowerCase());
          if (matchedCol) {
            const dialect = adapter.getDialect();
            const quotedCol = dialect.quoteIdentifier(matchedCol.name);
            const qualifiedTable = dialect.qualifyTable(t.schema, t.name);
            const distinctSql = `SELECT DISTINCT ${quotedCol} AS "val" FROM ${qualifiedTable} WHERE ${quotedCol} IS NOT NULL ORDER BY "val" LIMIT 1000;`;
            const qRes = await adapter.executeReadOnlyQuery(distinctSql, { maxRows: 1000 });
            const values = Array.from(new Set(
              qRes.rows
                .map(r => r['val'])
                .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
                .map(v => String(v))
            ));
            res.json({ success: true, values, column: matchedCol.name, table: t.name });
            return;
          }
        } catch {
          continue;
        }
      }
    }

    for (const ds of importedDatasets) {
      const importedVals = await queryImported(ds.tableName, colVal.cleanName!);
      if (importedVals !== null && importedVals.length > 0) {
        const uniqueVals = Array.from(new Set(importedVals));
        res.json({ success: true, values: uniqueVals, column: colVal.cleanName, table: ds.tableName });
        return;
      }
    }

    const demoAny = queryDemoDb(undefined, colVal.cleanName!);
    if (demoAny !== null) {
      res.json({ success: true, values: demoAny.values, column: colVal.cleanName, table: demoAny.table });
      return;
    }

    res.json({ success: true, values: [], column: colVal.cleanName, table: null });
  } catch (err: any) {
    Logger.error('Failed to retrieve distinct filter values', err, { sessionId, column: parsedColumn });
    ApiResponse.error(res, 500, 'FILTER_VALUES_FAILED', err.message || 'Failed to retrieve filter values');
  }
});
