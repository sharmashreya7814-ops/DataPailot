import { PoolClient } from 'pg';
import { DiscoveredTable, TableColumnInfo, TableDetailsResult } from './DatabaseAdapter';
import { RelationshipDiscovery } from './RelationshipDiscovery';

export class SchemaIntrospection {
  /**
   * Discovers all tables and views from PostgreSQL information_schema and system catalogs.
   */
  public static async discoverTables(
    client: PoolClient,
    schema?: string
  ): Promise<DiscoveredTable[]> {
    // Exclude system schemas like pg_catalog, information_schema, pg_toast
    const query = `
      SELECT
        t.table_schema AS schema,
        t.table_name AS name,
        t.table_type AS type,
        COALESCE(c.reltuples::bigint, 0) AS approximate_row_count
      FROM information_schema.tables t
      LEFT JOIN pg_namespace n ON n.nspname = t.table_schema
      LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = n.oid
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND ($1::text IS NULL OR t.table_schema = $1)
      ORDER BY t.table_schema = 'public' DESC, t.table_schema, t.table_name;
    `;

    const res = await client.query(query, [schema || null]);
    const discovered = res.rows.map(row => ({
      schema: row.schema,
      name: row.name,
      type: row.type,
      approximateRowCount: row.approximate_row_count >= 0 ? Number(row.approximate_row_count) : 0
    }));

    // If a table has 0 approximate rows (common before vacuum/analyze or in new test tables), attempt a quick COUNT query
    for (const t of discovered) {
      if (t.approximateRowCount === 0 && t.type === 'BASE TABLE') {
        try {
          const countRes = await client.query(`SELECT COUNT(*) AS c FROM "${t.schema.replace(/"/g, '""')}"."${t.name.replace(/"/g, '""')}"`);
          if (countRes.rows[0]?.c !== undefined) {
            t.approximateRowCount = Number(countRes.rows[0].c);
          }
        } catch {
          // Keep default 0 on error
        }
      }
    }

    return discovered;
  }

  /**
   * Introspects detailed column definitions, data types, primary keys, and foreign keys for a specific table.
   */
  public static async getTableDetails(
    client: PoolClient,
    schema: string,
    tableName: string
  ): Promise<TableDetailsResult> {
    // 1. Fetch column attributes
    const colQuery = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        udt_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    // 2. Fetch primary key columns
    const pkQuery = `
      SELECT
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2;
    `;

    // 3. Fetch foreign key references (outgoing relationships)
    const fkQuery = `
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
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2;
    `;

    // 4. Fetch incoming relationships (tables referencing this table)
    const incomingFkQuery = `
      SELECT
        tc.constraint_name,
        tc.table_schema AS source_schema,
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = $1
        AND ccu.table_name = $2;
    `;

    // 5. Fetch table row count and type
    const tableMetaQuery = `
      SELECT
        t.table_type,
        COALESCE(c.reltuples::bigint, 0) AS approximate_row_count
      FROM information_schema.tables t
      LEFT JOIN pg_namespace n ON n.nspname = t.table_schema
      LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = n.oid
      WHERE t.table_schema = $1 AND t.table_name = $2;
    `;

    const [colRes, pkRes, fkRes, incRes, metaRes] = await Promise.all([
      client.query(colQuery, [schema, tableName]),
      client.query(pkQuery, [schema, tableName]),
      client.query(fkQuery, [schema, tableName]),
      client.query(incomingFkQuery, [schema, tableName]),
      client.query(tableMetaQuery, [schema, tableName])
    ]);

    const primaryKeySet = new Set<string>(pkRes.rows.map(r => r.column_name));
    const foreignKeyMap = new Map<string, {
      schema: string;
      table: string;
      column: string;
      constraintName: string;
    }>();

    for (const row of fkRes.rows) {
      foreignKeyMap.set(row.source_column, {
        schema: row.target_schema,
        table: row.target_table,
        column: row.target_column,
        constraintName: row.constraint_name
      });
    }

    const columns: TableColumnInfo[] = colRes.rows.map(row => {
      const isPk = primaryKeySet.has(row.column_name);
      const fk = foreignKeyMap.get(row.column_name);

      return {
        name: row.column_name,
        dataType: row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type,
        isNullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        isPrimaryKey: isPk,
        isForeignKey: Boolean(fk),
        foreignKeyTarget: fk
      };
    });

    const outgoingRelationships = fkRes.rows.map(row => ({
      constraintName: row.constraint_name,
      sourceSchema: schema,
      sourceTable: tableName,
      sourceColumn: row.source_column,
      targetSchema: row.target_schema,
      targetTable: row.target_table,
      targetColumn: row.target_column
    }));

    const incomingRelationships = incRes.rows.map(row => ({
      constraintName: row.constraint_name,
      sourceSchema: row.source_schema,
      sourceTable: row.source_table,
      sourceColumn: row.source_column,
      targetSchema: schema,
      targetTable: tableName,
      targetColumn: row.target_column
    }));

    const tableType = metaRes.rows[0]?.table_type || 'BASE TABLE';
    let approxRows = metaRes.rows[0]?.approximate_row_count;
    let finalRowCount = approxRows !== undefined && approxRows >= 0 ? Number(approxRows) : 0;

    if (tableType === 'BASE TABLE' && (!approxRows || Number(approxRows) <= 0)) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) AS c FROM "${schema.replace(/"/g, '""')}"."${tableName.replace(/"/g, '""')}"`);
        if (countRes.rows[0]?.c !== undefined) {
          finalRowCount = Number(countRes.rows[0].c);
        }
      } catch {
        // ignore fallback
      }
    }

    return {
      schema,
      name: tableName,
      type: tableType,
      columnCount: columns.length,
      approximateRowCount: finalRowCount,
      columns,
      outgoingRelationships,
      incomingRelationships
    };
  }
}
