import { DatabaseSync } from 'node:sqlite';
import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAnalysisStatisticalSummaryNumericTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  // SQLite dialect as used in queryRoutes.ts for imported datasets
  const sqliteDialect = {
    quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
    formatLimit: (sql: string, limit: number) => `${sql}\nLIMIT ${limit}`,
    formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`,
    formatDate: (date: Date) => `'${date.toISOString()}'`,
    formatExplain: (sql: string) => `EXPLAIN QUERY PLAN ${sql}`,
    qualifyTable: (_schema: string | undefined, table: string) => `"${table.replace(/"/g, '""')}"`,
    dialectType: 'sqlite' as const
  };

  const sqliteGenerator = new AnalysisSqlGenerator(sqliteDialect);

  // Setup SQLite test database
  const db = new DatabaseSync(':memory:');
  db.exec(`
    -- Test Dataset: datapilot_analytics_test_dataset with integer (order_id) and decimal (net_sales)
    CREATE TABLE datapilot_analytics_test_dataset (
      order_id INT,
      order_date TEXT,
      city TEXT,
      category TEXT,
      product TEXT,
      quantity INT,
      unit_price REAL,
      net_sales REAL
    );

    INSERT INTO datapilot_analytics_test_dataset VALUES
      (1, '2026-01-10', 'Surat', 'Tech', 'Mouse', 5, 20.0, 100.0),
      (2, '2026-01-12', 'Surat', 'Tech', 'Keyboard', 3, 50.0, 150.0),
      (3, '2026-01-15', 'Surat', 'Office', 'Chair', 2, 200.0, 400.0),
      (4, '2026-01-18', 'Surat', 'Office', 'Desk', 1, 600.0, 600.0),
      (5, '2026-01-20', 'Surat', 'Tech', 'Monitor', 4, 300.0, 1200.0),
      (6, '2026-01-22', 'Surat', 'Tech', 'Laptop', 1, 1500.0, 1500.0),
      (7, '2026-01-25', 'Surat', 'Office', 'Lamp', 2, 25.0, 50.0);

    -- Edge case table 1: With NULL values
    CREATE TABLE dataset_with_nulls (
      id INT,
      score REAL
    );
    INSERT INTO dataset_with_nulls VALUES
      (1, 10.0),
      (2, NULL),
      (3, 20.0),
      (4, NULL),
      (5, 30.0);

    -- Edge case table 2: Single-row / single-value
    CREATE TABLE dataset_single (
      id INT,
      val REAL
    );
    INSERT INTO dataset_single VALUES (1, 42.5);

    -- Edge case table 3: Empty dataset (0 rows)
    CREATE TABLE dataset_empty (
      id INT,
      val REAL
    );

    -- Edge case table 4: All NULL values
    CREATE TABLE dataset_all_nulls (
      id INT,
      val REAL
    );
    INSERT INTO dataset_all_nulls VALUES (1, NULL), (2, NULL), (3, NULL);

    -- Edge case table 5: Identical values (zero variance)
    CREATE TABLE dataset_identical (
      id INT,
      val REAL
    );
    INSERT INTO dataset_identical VALUES (1, 100.0), (2, 100.0), (3, 100.0), (4, 100.0);
  `);

  // ========================================================
  // 1. IMPORTED DATASET STATISTICAL SUMMARY (USER REPORTED FLOW: order_id)
  // ========================================================
  const orderIdQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'datapilot_analytics_test_dataset',
    'order_id'
  );

  record(
    '1. Imported dataset Statistical Summary generates SQLite-compatible CTE',
    orderIdQuery.sql.startsWith('WITH stats AS (')
  );

  record(
    '2. Does NOT send unsupported STDDEV() to SQLite',
    !orderIdQuery.sql.includes('STDDEV(')
  );

  record(
    '3. Does NOT send unsupported VARIANCE() to SQLite',
    !orderIdQuery.sql.includes('VARIANCE(')
  );

  record(
    '4. Quoting for imported dataset does NOT include imported. prefix',
    orderIdQuery.sql.includes('FROM "datapilot_analytics_test_dataset"') &&
    !orderIdQuery.sql.includes('"imported".')
  );

  let orderIdRows: any[] = [];
  let orderIdError: string | undefined;
  try {
    orderIdRows = db.prepare(orderIdQuery.sql).all() as any[];
  } catch (err: any) {
    orderIdError = err.message;
  }

  record(
    '5. Statistical Summary query on integer order_id executes cleanly in SQLite (no such function: STDDEV is resolved)',
    orderIdError === undefined && orderIdRows.length === 1,
    orderIdError
  );

  const orderIdResult = orderIdRows[0] || {};
  const expectedCols = ['count_valid', 'average', 'std_deviation', 'variance', 'minimum', 'maximum'];

  record(
    '6. Preserves all 6 required output columns in exact order',
    JSON.stringify(Object.keys(orderIdResult)) === JSON.stringify(expectedCols)
  );

  // For order_id values: [1, 2, 3, 4, 5, 6, 7]
  // count = 7
  // avg = 4.0
  // variance (sample) = 4.6667
  // std_dev (sample) = sqrt(4.6667) = 2.1602
  // min = 1
  // max = 7
  record(
    '7. order_id count_valid equals 7',
    orderIdResult.count_valid === 7
  );

  record(
    '8. order_id average equals 4.0',
    orderIdResult.average === 4.0
  );

  record(
    '9. order_id std_deviation equals 2.1602',
    orderIdResult.std_deviation === 2.1602
  );

  record(
    '10. order_id variance equals 4.6667',
    orderIdResult.variance === 4.6667
  );

  record(
    '11. order_id minimum equals 1 and maximum equals 7',
    orderIdResult.minimum === 1 && orderIdResult.maximum === 7
  );

  // ========================================================
  // 2. DECIMAL NUMERIC COLUMN (net_sales)
  // ========================================================
  const netSalesQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'datapilot_analytics_test_dataset',
    'net_sales'
  );

  const netSalesRows = db.prepare(netSalesQuery.sql).all() as any[];
  const netSalesResult = netSalesRows[0] || {};

  // net_sales values: [100.0, 150.0, 400.0, 600.0, 1200.0, 1500.0, 50.0]
  // count = 7
  // sum = 4000.0
  // avg = 571.4286
  // min = 50.0
  // max = 1500.0
  // sum_sq = 100^2 + 150^2 + 400^2 + 600^2 + 1200^2 + 1500^2 + 50^2 = 10000+22500+160000+360000+1440000+2250000+2500 = 4245000
  // sample var = (4245000 - 4000^2 / 7) / 6 = (4245000 - 2285714.2857) / 6 = 1959285.7143 / 6 = 326547.6190
  // sample std = sqrt(326547.6190) = 571.4435
  record(
    '12. Decimal net_sales executes cleanly with accurate metrics',
    netSalesResult.count_valid === 7 &&
    netSalesResult.average === 571.4286 &&
    netSalesResult.std_deviation === 571.4435 &&
    netSalesResult.variance === 326547.619 &&
    netSalesResult.minimum === 50.0 &&
    netSalesResult.maximum === 1500.0
  );

  // ========================================================
  // 3. NULL HANDLING
  // ========================================================
  const nullsQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'dataset_with_nulls',
    'score'
  );
  const nullsRows = db.prepare(nullsQuery.sql).all() as any[];
  const nullsResult = nullsRows[0] || {};

  // dataset_with_nulls has 5 rows: [10.0, NULL, 20.0, NULL, 30.0]
  // count_valid = 3 (ignores NULLs)
  // avg = 20.0
  // min = 10.0, max = 30.0
  // sample var = ((10-20)^2 + (20-20)^2 + (30-20)^2) / 2 = (100 + 0 + 100) / 2 = 100.0
  // sample std = 10.0
  record(
    '13. NULL values are ignored in count_valid, avg, std_deviation, variance, min, max',
    nullsResult.count_valid === 3 &&
    nullsResult.average === 20.0 &&
    nullsResult.std_deviation === 10.0 &&
    nullsResult.variance === 100.0 &&
    nullsResult.minimum === 10.0 &&
    nullsResult.maximum === 30.0
  );

  // ========================================================
  // 4. SINGLE-ROW / SINGLE-VALUE DATASET (EDGE CASE)
  // ========================================================
  const singleQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'dataset_single',
    'val'
  );
  const singleRows = db.prepare(singleQuery.sql).all() as any[];
  const singleResult = singleRows[0] || {};

  record(
    '14. Single-value dataset safely returns count=1, avg=42.5, std_dev=0, var=0, min=42.5, max=42.5 without division-by-zero error',
    singleResult.count_valid === 1 &&
    singleResult.average === 42.5 &&
    singleResult.std_deviation === 0.0 &&
    singleResult.variance === 0.0 &&
    singleResult.minimum === 42.5 &&
    singleResult.maximum === 42.5
  );

  // ========================================================
  // 5. EMPTY / ALL-NULL DATASET (EDGE CASES)
  // ========================================================
  const emptyQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'dataset_empty',
    'val'
  );
  const emptyRows = db.prepare(emptyQuery.sql).all() as any[];
  const emptyResult = emptyRows[0] || {};

  record(
    '15. Empty dataset safely yields count=0 and NULL for all statistics',
    emptyResult.count_valid === 0 &&
    emptyResult.average === null &&
    emptyResult.std_deviation === null &&
    emptyResult.variance === null &&
    emptyResult.minimum === null &&
    emptyResult.maximum === null
  );

  const allNullsQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'dataset_all_nulls',
    'val'
  );
  const allNullsRows = db.prepare(allNullsQuery.sql).all() as any[];
  const allNullsResult = allNullsRows[0] || {};

  record(
    '16. All-NULL dataset safely yields count=0 and NULL for all statistics',
    allNullsResult.count_valid === 0 &&
    allNullsResult.average === null &&
    allNullsResult.std_deviation === null &&
    allNullsResult.variance === null &&
    allNullsResult.minimum === null &&
    allNullsResult.maximum === null
  );

  // ========================================================
  // 6. IDENTICAL VALUES (ZERO SPREAD)
  // ========================================================
  const identicalQuery = sqliteGenerator.generateNumericSummary(
    'imported',
    'dataset_identical',
    'val'
  );
  const identicalRows = db.prepare(identicalQuery.sql).all() as any[];
  const identicalResult = identicalRows[0] || {};

  record(
    '17. Identical values [100, 100, 100, 100] yield count=4, avg=100.0, std_dev=0.0, var=0.0',
    identicalResult.count_valid === 4 &&
    identicalResult.average === 100.0 &&
    identicalResult.std_deviation === 0.0 &&
    identicalResult.variance === 0.0 &&
    identicalResult.minimum === 100.0 &&
    identicalResult.maximum === 100.0
  );

  // ========================================================
  // 7. PLACEHOLDER VALIDATION & METADATA
  // ========================================================
  record(
    '18. Generated SQLite Statistical Summary has NO unresolved template placeholders',
    !orderIdQuery.sql.includes('undefined') &&
    !orderIdQuery.sql.includes('NaN') &&
    !orderIdQuery.sql.includes('[object Object]')
  );

  record(
    '19. Query metadata tablesUsed contains clean table display name',
    orderIdQuery.tablesUsed.length === 1 && orderIdQuery.tablesUsed[0] === 'datapilot_analytics_test_dataset'
  );

  record(
    '20. Query metadata columnsUsed tracks selected column',
    orderIdQuery.columnsUsed.includes('order_id')
  );

  // ========================================================
  // 8. OTHER DATABASE DIALECTS REMAIN UNCHANGED
  // ========================================================
  // PostgreSQL
  const pgAdapter = new PostgreSQLAdapter({ type: 'postgresql', host: 'localhost', database: 'analytics_db', username: 'postgres' });
  const pgGen = new AnalysisSqlGenerator(pgAdapter.getDialect());
  const pgQuery = pgGen.generateNumericSummary('analytics_practice', 'orders', 'order_id');

  record(
    '21. PostgreSQL dialect continues to use STDDEV("order_id") and VARIANCE("order_id")',
    pgQuery.sql.includes('STDDEV("order_id")') &&
    pgQuery.sql.includes('VARIANCE("order_id")') &&
    pgQuery.sql.includes('FROM "analytics_practice"."orders"')
  );

  // MySQL
  const mysqlAdapter = new MySQLAdapter({ type: 'mysql', host: 'localhost', database: 'analytics_db', username: 'root' });
  const mysqlGen = new AnalysisSqlGenerator(mysqlAdapter.getDialect());
  const mysqlQuery = mysqlGen.generateNumericSummary('sales', 'orders', 'revenue');

  record(
    '22. MySQL dialect uses STDDEV_SAMP(`revenue`) and backticks',
    mysqlQuery.sql.includes('STDDEV_SAMP(`revenue`)') &&
    mysqlQuery.sql.includes('VAR_SAMP(`revenue`)') &&
    mysqlQuery.sql.includes('FROM `sales`.`orders`')
  );

  // SQL Server
  const mssqlAdapter = new SQLServerAdapter({ type: 'sqlserver', host: 'localhost', database: 'sales_db', username: 'sa' });
  const mssqlGen = new AnalysisSqlGenerator(mssqlAdapter.getDialect());
  const mssqlQuery = mssqlGen.generateNumericSummary('sales', 'orders', 'amount');

  record(
    '23. SQL Server dialect uses STDEV([amount]) and square brackets',
    mssqlQuery.sql.includes('STDEV([amount])') &&
    mssqlQuery.sql.includes('VAR([amount])') &&
    mssqlQuery.sql.includes('FROM [sales].[orders]')
  );

  // Oracle
  const oracleAdapter = new OracleAdapter({ type: 'oracle', host: 'localhost', database: 'XE', username: 'HR' });
  const oracleGen = new AnalysisSqlGenerator(oracleAdapter.getDialect());
  const oracleQuery = oracleGen.generateNumericSummary('HR', 'EMPLOYEES', 'SALARY');

  record(
    '24. Oracle dialect uses STDDEV("SALARY") and VARIANCE("SALARY")',
    oracleQuery.sql.includes('STDDEV("SALARY")') &&
    oracleQuery.sql.includes('VARIANCE("SALARY")') &&
    oracleQuery.sql.includes('FROM "HR"."EMPLOYEES"')
  );

  return results;
}
