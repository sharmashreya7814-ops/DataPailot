import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLiteAdapter } from '../server/database/SQLiteAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';
import { SavedConnectionStore } from '../server/database/SavedConnectionStore';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runSchemaSyncAndSavedConnectionsTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  // ==========================================
  // 1. ANALYSIS SQL GENERATOR - MULTI-SCHEMA QUALIFICATION
  // ==========================================
  const pgAdapter = new PostgreSQLAdapter({ type: 'postgresql', host: 'localhost', database: 'datapilot_demo', username: 'postgres' });
  const pgDialect = pgAdapter.getDialect();
  const generator = new AnalysisSqlGenerator(pgDialect);

  // 1A. Basic Operations with different schemas
  const previewAnalytics = generator.generateBasic('analytics_practice', 'orders', 'preview', { limit: 25 });
  record(
    '1. Basic preview preserves analytics_practice schema in FROM clause',
    previewAnalytics.sql.includes('FROM "analytics_practice"."orders"')
  );
  record(
    '2. Basic preview tablesUsed is schema-qualified',
    previewAnalytics.tablesUsed[0] === 'analytics_practice.orders'
  );

  const previewPublic = generator.generateBasic('public', 'orders', 'preview', { limit: 25 });
  record(
    '3. Basic preview for public schema generates "public"."orders"',
    previewPublic.sql.includes('FROM "public"."orders"')
  );
  record(
    '4. analytics_practice.orders and public.orders generate distinct queries',
    previewAnalytics.sql !== previewPublic.sql
  );

  // 1B. Count Rows & Count Distinct
  const countRows = generator.generateBasic('analytics_practice', 'customers', 'count_rows');
  record(
    '5. Count rows preserves analytics_practice schema',
    countRows.sql.includes('FROM "analytics_practice"."customers"')
  );

  const countDistinct = generator.generateBasic('analytics_practice', 'payments', 'count_distinct', { column: 'payment_method' });
  record(
    '6. Count distinct qualifies both column and schema-table',
    countDistinct.sql.includes('COUNT(DISTINCT "payment_method")') && countDistinct.sql.includes('"analytics_practice"."payments"')
  );

  // 1C. Filter Query
  const filterQuery = generator.generateFilterQuery(
    'analytics_practice',
    'orders',
    [{ id: '1', column: 'total_amount', operator: '>=', value: '500', logic: 'AND' }],
    ['order_id', 'customer_id', 'total_amount'],
    50
  );
  record(
    '7. Filter query preserves selected schema',
    filterQuery.sql.includes('FROM "analytics_practice"."orders"')
  );

  // 1D. Aggregation Query
  const aggQuery = generator.generateAggregation('analytics_practice', 'order_items', [
    { id: '1', func: 'SUM', column: 'subtotal', alias: 'total_revenue' },
    { id: '2', func: 'AVG', column: 'unit_price', alias: 'avg_price' }
  ]);
  record(
    '8. Aggregation query preserves selected schema',
    aggQuery.sql.includes('FROM "analytics_practice"."order_items"')
  );

  // 1E. Group By Query
  const groupQuery = generator.generateGroupBy(
    'analytics_practice',
    'products',
    ['category_id'],
    [{ id: '1', func: 'COUNT', column: '*', alias: 'product_count' }]
  );
  record(
    '9. Group By query preserves selected schema',
    groupQuery.sql.includes('FROM "analytics_practice"."products"')
  );

  // 1F. Multi-Table Join Query
  const joinQuery = generator.generateJoin({
    baseTable: { schema: 'analytics_practice', name: 'orders' },
    joinTable: { schema: 'analytics_practice', name: 'customers' },
    joinType: 'INNER JOIN',
    baseColumn: 'customer_id',
    joinColumn: 'id',
    isConfirmedRelationship: true,
    confirmedConstraintName: 'fk_orders_customer',
    selectedColumns: [
      { tableKey: 'base', tableName: 'orders', column: 'order_id' },
      { tableKey: 'join', tableName: 'customers', column: 'name' }
    ]
  });
  record(
    '10. Multi-table join preserves schema on both base and join tables',
    joinQuery.sql.includes('"analytics_practice"."orders"') && joinQuery.sql.includes('"analytics_practice"."customers"')
  );

  // 1G. Calculations & CASE
  const caseQuery = generator.generateCaseCategory('analytics_practice', 'orders', {
    column: 'total_amount',
    rules: [
      { id: '1', column: 'total_amount', operator: '>=', value: '1000', resultLabel: 'VIP' },
      { id: '2', column: 'total_amount', operator: '>=', value: '500', resultLabel: 'Standard' }
    ],
    fallbackLabel: 'Basic',
    alias: 'tier'
  });
  record(
    '11. CASE calculation preserves selected schema',
    caseQuery.sql.includes('FROM "analytics_practice"."orders"')
  );

  // 1H. Date Analysis Query
  const dateQuery = generator.generateDateAnalysis('analytics_practice', 'orders', {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: 'total_amount',
    measureFunction: 'SUM',
    mode: 'trend'
  });
  record(
    '12. Date analysis query preserves selected schema',
    dateQuery.sql.includes('"analytics_practice"."orders"')
  );

  // 1I. Window Functions / Top N Per Group
  const topNQuery = generator.generateTopNPerGroup('analytics_practice', 'products', {
    groupColumn: 'category_id',
    rankingColumn: 'price',
    n: 3,
    direction: 'DESC',
    rankingMethod: 'DENSE_RANK'
  });
  record(
    '13. Top N per group preserves selected schema',
    topNQuery.sql.includes('FROM "analytics_practice"."products"')
  );

  // 1J. Customer / Sales / Product Templates
  const custQuery = generator.generateCustomerTemplate('analytics_practice', 'orders', 'rfm', {
    customerId: 'customer_id',
    amountColumn: 'total_amount',
    dateColumn: 'order_date'
  });
  record(
    '14. Customer analysis RFM template preserves selected schema',
    custQuery.sql.includes('"analytics_practice"."orders"')
  );

  // ==========================================
  // 2. DIALECT ADAPTER AWARENESS
  // ==========================================
  // SQL Server
  const sqlServerAdapter = new SQLServerAdapter({ type: 'sqlserver', host: 'localhost', database: 'master', username: 'sa' });
  const sqlServerDialect = sqlServerAdapter.getDialect();
  record(
    '15. SQL Server dialect qualifies table as [sales].[orders]',
    sqlServerDialect.qualifyTable('sales', 'orders') === '[sales].[orders]'
  );

  // MySQL
  const mySqlAdapter = new MySQLAdapter({ type: 'mysql', host: 'localhost', database: 'testdb', username: 'root' });
  const mySqlDialect = mySqlAdapter.getDialect();
  record(
    '16. MySQL dialect qualifies table as `analytics`.`orders`',
    mySqlDialect.qualifyTable('analytics', 'orders') === '`analytics`.`orders`'
  );

  // SQLite
  const sqliteAdapter = new SQLiteAdapter({ type: 'sqlite', filePath: ':memory:' });
  const sqliteDialect = sqliteAdapter.getDialect();
  record(
    '17. SQLite dialect properly handles standard table name without invalid schema prefix',
    sqliteDialect.qualifyTable('imported', 'sales') === '"sales"' || sqliteDialect.qualifyTable('main', 'sales') === '"sales"'
  );

  // Oracle
  const oracleAdapter = new OracleAdapter({ type: 'oracle', host: 'localhost', database: 'XE', username: 'SYSTEM' });
  const oracleDialect = oracleAdapter.getDialect();
  record(
    '18. Oracle dialect qualifies table as "HR"."EMPLOYEES"',
    oracleDialect.qualifyTable('HR', 'EMPLOYEES') === '"HR"."EMPLOYEES"'
  );

  // ==========================================
  // 3. SAVED DATABASE CONNECTIONS & SECURITY
  // ==========================================
  const store = SavedConnectionStore.getInstance();

  // 3A. Save connection with secret password
  const saved = store.save({
    name: 'Production Analytics PG',
    type: 'postgresql',
    host: 'pg-prod.internal.net',
    port: 5432,
    database: 'datapilot_analytics',
    username: 'analyst_super',
    password: 'super_secret_pg_password_#9876!',
    defaultSchema: 'analytics_practice',
    ssl: true
  });

  record('19. Saved connection returns a valid UUID', Boolean(saved.id));
  record('20. Saved connection retains name', saved.name === 'Production Analytics PG');
  record('21. Saved connection retains database', saved.database === 'datapilot_analytics');
  record('22. Saved connection retains default schema', saved.defaultSchema === 'analytics_practice');
  record('23. Saved connection profile OMITS plaintext password in public interface', (saved as any).password === undefined);

  // 3B. Verify file storage has NO plaintext password
  const dataFile = path.join(process.cwd(), 'data', 'saved_connections.json');
  if (fs.existsSync(dataFile)) {
    const rawData = fs.readFileSync(dataFile, 'utf8');
    record(
      '24. Password is NEVER stored in plaintext in the JSON store on disk',
      !rawData.includes('super_secret_pg_password_#9876!')
    );
    record(
      '25. Password is encrypted with AES-256-GCM cipher payload',
      rawData.includes('ciphertext') && rawData.includes('authTag') && rawData.includes('iv')
    );
  }

  // 3C. Decrypted retrieval for connection manager
  const decryptedParams = store.getDecryptedConnectionParams(saved.id);
  record(
    '26. Decrypted connection params accurately restore original password server-side only',
    decryptedParams !== null && decryptedParams.password === 'super_secret_pg_password_#9876!'
  );
  record(
    '27. Decrypted connection params restore host and port',
    decryptedParams?.host === 'pg-prod.internal.net' && decryptedParams?.port === 5432
  );

  // 3D. Update saved connection
  const updated = store.update(saved.id, {
    name: 'Production Analytics Replica',
    defaultSchema: 'public'
  });
  record(
    '28. Saved connection profile can be updated and renamed',
    updated !== null && updated.name === 'Production Analytics Replica' && updated.defaultSchema === 'public'
  );

  // 3E. Delete saved connection
  const deleted = store.delete(saved.id);
  record('29. Saved connection profile can be safely deleted', deleted === true);
  record('30. Deleted profile no longer exists in store', store.getById(saved.id) === null);

  // ==========================================
  // 4. CONNECTION LOADING UX & ZERO-WHITE-FLASH
  // ==========================================
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  record(
    '31. index.html body has dark background class (bg-slate-950) to prevent white flash',
    indexHtml.includes('bg-slate-950')
  );

  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src', 'index.css'), 'utf8');
  record(
    '32. index.css defines base dark background (#020617) for html, body, and root',
    indexCss.includes('#020617') && indexCss.includes('html, body, #root')
  );

  const loadingComponentFile = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'common', 'DatabaseConnectionLoading.tsx'),
    'utf8'
  );
  record(
    '33. DatabaseConnectionLoading defines required status progression steps',
    loadingComponentFile.includes('Establishing secure connection') &&
    loadingComponentFile.includes('Authenticating credentials') &&
    loadingComponentFile.includes('Discovering database schema') &&
    loadingComponentFile.includes('Loading tables and metadata')
  );
  record(
    '34. DatabaseConnectionLoading includes accessibility aria-busy and aria-live status',
    loadingComponentFile.includes('aria-busy="true"') &&
    loadingComponentFile.includes('aria-live="polite"') &&
    loadingComponentFile.includes('role="status"')
  );
  record(
    '35. DatabaseConnectionLoading has animated progress indicator and dark enterprise styling',
    loadingComponentFile.includes('bg-gradient-to-r') &&
    loadingComponentFile.includes('Connecting to database...') &&
    loadingComponentFile.includes('This may take a few seconds')
  );

  return results;
}
