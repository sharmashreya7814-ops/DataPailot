import { DatabaseSync } from 'node:sqlite';
import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';
import { DateAnalysisConfig } from '../src/types/analysis';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAnalysisDateAnalysisDialectsTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  // SQLite dialect as used for imported datasets in queryRoutes.ts
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

  // Setup in-memory SQLite test fixture for datapilot_analytics_test_dataset
  const db = new DatabaseSync(':memory:');
  db.exec(`
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
      (1, '2026-01-10', 'Surat', 'Tech', 'Mouse', 5, 20.0, 1000.0),
      (2, '2026-01-25', 'Mumbai', 'Tech', 'Keyboard', 2, 100.0, 1500.0),
      (3, '2026-02-12', 'Surat', 'Office', 'Chair', 1, 200.0, 3000.0),
      (4, '2026-03-05', 'Ahmedabad', 'Tech', 'Monitor', 3, 300.0, 4500.0),
      (5, '2026-04-18', 'Surat', 'Office', 'Desk', 1, 400.0, 4000.0),
      (6, '2026-05-22', 'Mumbai', 'Tech', 'Laptop', 1, 1200.0, 6000.0),
      (7, '2026-06-15', 'Surat', 'Office', 'Lamp', 4, 25.0, 7500.0);
  `);

  // ========================================================
  // 1. IMPORTED DATASET + MONTH EXTRACTION
  // ========================================================
  const monthExtractionConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: 'net_sales',
    measureFunction: 'SUM',
    mode: 'trend'
  };

  const monthTrendQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    monthExtractionConfig,
    100
  );

  record(
    '1. Imported dataset month extraction uses SQLite strftime(\'%Y-%m\', "order_date")',
    monthTrendQuery.sql.includes('strftime(\'%Y-%m\', "order_date")')
  );

  record(
    '2. Imported dataset month extraction does NOT use PostgreSQL DATE_TRUNC',
    !monthTrendQuery.sql.includes('DATE_TRUNC')
  );

  const monthRows = db.prepare(monthTrendQuery.sql).all() as any[];
  const monthPeriods = monthRows.map(r => r.period);

  record(
    '3. Month extraction produces valid YYYY-MM period values (2026-01, 2026-02, ...)',
    monthPeriods.includes('2026-01') &&
    monthPeriods.includes('2026-02') &&
    monthPeriods.includes('2026-03') &&
    monthPeriods.includes('2026-04') &&
    monthPeriods.includes('2026-05') &&
    monthPeriods.includes('2026-06')
  );

  // ========================================================
  // 2. IMPORTED DATASET + YEAR EXTRACTION
  // ========================================================
  const yearExtractionConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'year',
    measureColumn: 'net_sales',
    measureFunction: 'SUM',
    mode: 'trend'
  };

  const yearTrendQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    yearExtractionConfig,
    100
  );

  record(
    '4. Imported dataset year extraction uses SQLite strftime(\'%Y\', "order_date")',
    yearTrendQuery.sql.includes('strftime(\'%Y\', "order_date")')
  );

  const yearRows = db.prepare(yearTrendQuery.sql).all() as any[];
  record(
    '5. Year extraction produces valid YYYY period value (2026)',
    yearRows.length === 1 && yearRows[0].period === '2026'
  );

  // ========================================================
  // 3. IMPORTED DATASET + MONTHLY AGGREGATION
  // ========================================================
  record(
    '6. Monthly aggregation groups by strftime(\'%Y-%m\', "order_date") rather than raw position GROUP BY 1',
    monthTrendQuery.sql.includes('GROUP BY strftime(\'%Y-%m\', "order_date")')
  );

  record(
    '7. Month 2026-01 aggregates both orders (1000 + 1500 = 2500)',
    monthRows.find(r => r.period === '2026-01')?.total_metric === 2500
  );

  // ========================================================
  // 4. IMPORTED DATASET + MONTH-OVER-MONTH GROWTH
  // ========================================================
  const momConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: 'net_sales',
    measureFunction: 'SUM',
    mode: 'mom'
  };

  const momQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    momConfig,
    100
  );

  record(
    '8. MoM query on imported dataset uses strftime in CTE',
    momQuery.sql.includes('strftime(\'%Y-%m\', "order_date") AS period') &&
    momQuery.sql.includes('GROUP BY strftime(\'%Y-%m\', "order_date")')
  );

  record(
    '9. MoM query on imported dataset contains NO DATE_TRUNC',
    !momQuery.sql.includes('DATE_TRUNC')
  );

  // Execute MoM query against SQLite
  const momRows = db.prepare(momQuery.sql).all() as any[];

  record(
    '10. MoM query executes cleanly in SQLite without error',
    momRows.length === 6
  );

  record(
    '11. MoM growth for 2026-02 is correct ((3000 - 2500) / 2500 * 100 = 20%)',
    momRows[1].period === '2026-02' &&
    momRows[1].current_value === 3000 &&
    momRows[1].previous_month_value === 2500 &&
    momRows[1].growth_percent === 20
  );

  record(
    '12. MoM growth for 2026-03 is correct ((4500 - 3000) / 3000 * 100 = 50%)',
    momRows[2].period === '2026-03' &&
    momRows[2].current_value === 4500 &&
    momRows[2].previous_month_value === 3000 &&
    momRows[2].growth_percent === 50
  );

  // ========================================================
  // 5. CORRECT SELECTED MEASURE SUBSTITUTION (BUG 2)
  // ========================================================
  record(
    '13. MoM query substitutes actual measure SUM("net_sales") instead of literal measureExpr',
    momQuery.sql.includes('SUM("net_sales") AS current_value') &&
    !momQuery.sql.includes('measureExpr')
  );

  const avgConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: 'unit_price',
    measureFunction: 'AVG',
    mode: 'mom'
  };
  const avgQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    avgConfig,
    100
  );
  record(
    '14. Alternate measure AVG("unit_price") is dynamically substituted',
    avgQuery.sql.includes('AVG("unit_price") AS current_value')
  );

  const countStarConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: '*',
    measureFunction: 'COUNT',
    mode: 'mom'
  };
  const countStarQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    countStarConfig,
    100
  );
  record(
    '15. Wildcard measure substitutes COUNT(*) AS current_value',
    countStarQuery.sql.includes('COUNT(*) AS current_value')
  );

  // ========================================================
  // 6. NO UNRESOLVED TEMPLATE PLACEHOLDERS IN GENERATED SQL
  // ========================================================
  const allDateModes: ('trend' | 'mom' | 'yoy' | 'running_sum' | 'running_count' | 'rolling_avg')[] = [
    'trend',
    'mom',
    'yoy',
    'running_sum',
    'running_count',
    'rolling_avg'
  ];

  let anyPlaceholderFound = false;
  for (const m of allDateModes) {
    const q = sqliteGenerator.generateDateAnalysis(
      'imported',
      'datapilot_analytics_test_dataset',
      {
        dateColumn: 'order_date',
        period: 'month',
        measureColumn: 'net_sales',
        measureFunction: 'SUM',
        mode: m,
        rollingWindow: 3
      },
      50
    );

    const forbidden = ['measureExpr', 'dateExpr', 'columnExpr', 'periodExpr', 'windowSize', 'Clause', 'undefined', 'NaN', '[object Object]'];
    for (const f of forbidden) {
      if (q.sql.includes(f)) {
        anyPlaceholderFound = true;
      }
    }
  }

  record(
    '16. All 6 Date Analysis modes are completely free of unresolved template placeholders',
    !anyPlaceholderFound
  );

  // Test that validateNoPlaceholders actively detects and throws on measureExpr
  let detectedMeasureExpr = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT measureExpr FROM t;');
  } catch (err: any) {
    if (err.message.includes('measureExpr')) {
      detectedMeasureExpr = true;
    }
  }
  record(
    '17. validateNoPlaceholders actively catches and rejects measureExpr',
    detectedMeasureExpr
  );

  // ========================================================
  // 7. SQLITE SYNTAX AND CLEAN TABLE QUALIFICATION FOR IMPORTED
  // ========================================================
  record(
    '18. Imported dataset queries reference table directly without imported. prefix',
    momQuery.sql.includes('FROM "datapilot_analytics_test_dataset"') &&
    !momQuery.sql.includes('"imported".')
  );

  record(
    '19. Query metadata tablesUsed contains clean table display name',
    momQuery.tablesUsed.length === 1 && momQuery.tablesUsed[0] === 'datapilot_analytics_test_dataset'
  );

  // ========================================================
  // 8. POSTGRESQL DATE ANALYSIS BEHAVIOR REMAINS UNCHANGED
  // ========================================================
  const pgAdapter = new PostgreSQLAdapter({
    type: 'postgresql',
    host: 'localhost',
    database: 'analytics_db',
    username: 'postgres'
  });
  const pgGenerator = new AnalysisSqlGenerator(pgAdapter.getDialect());

  const pgMomQuery = pgGenerator.generateDateAnalysis(
    'analytics_practice',
    'orders',
    momConfig,
    100
  );

  record(
    '20. PostgreSQL continues to generate DATE_TRUNC(\'month\', "order_date")',
    pgMomQuery.sql.includes('DATE_TRUNC(\'month\', "order_date")')
  );

  record(
    '21. PostgreSQL preserves schema qualification "analytics_practice"."orders"',
    pgMomQuery.sql.includes('FROM "analytics_practice"."orders"')
  );

  record(
    '22. PostgreSQL correctly resolves measure SUM("net_sales")',
    pgMomQuery.sql.includes('SUM("net_sales") AS current_value') &&
    !pgMomQuery.sql.includes('measureExpr')
  );

  // ========================================================
  // 9. OTHER DATABASE DIALECTS (MYSQL, SQL SERVER, ORACLE)
  // ========================================================

  // MySQL
  const mysqlAdapter = new MySQLAdapter({ type: 'mysql', host: 'localhost', database: 'db', username: 'root' });
  const mysqlGen = new AnalysisSqlGenerator(mysqlAdapter.getDialect());
  const mysqlQuery = mysqlGen.generateDateAnalysis('analytics_practice', 'orders', momConfig, 100);
  record(
    '23. MySQL dialect generates DATE_FORMAT(`order_date`, \'%Y-%m\') and backticks',
    mysqlQuery.sql.includes('DATE_FORMAT(`order_date`, \'%Y-%m\')') &&
    mysqlQuery.sql.includes('`analytics_practice`.`orders`')
  );

  // SQL Server
  const mssqlAdapter = new SQLServerAdapter({ type: 'sqlserver', host: 'localhost', database: 'db', username: 'sa', password: 'p', port: 1433 } as any);
  const mssqlGen = new AnalysisSqlGenerator(mssqlAdapter.getDialect());
  const mssqlQuery = mssqlGen.generateDateAnalysis('sales', 'orders', momConfig, 100);
  record(
    '24. SQL Server dialect generates FORMAT([order_date], \'yyyy-MM\') and brackets',
    mssqlQuery.sql.includes('FORMAT([order_date], \'yyyy-MM\')') &&
    mssqlQuery.sql.includes('[sales].[orders]')
  );

  // Oracle
  const oracleAdapter = new OracleAdapter({ type: 'oracle', host: 'localhost', database: 'XE', username: 'HR' });
  const oracleGen = new AnalysisSqlGenerator(oracleAdapter.getDialect());
  const oracleQuery = oracleGen.generateDateAnalysis('HR', 'EMPLOYEES', { ...momConfig, dateColumn: 'HIRE_DATE', measureColumn: 'SALARY' }, 100);
  record(
    '25. Oracle dialect generates TRUNC("HIRE_DATE", \'MM\')',
    oracleQuery.sql.includes('TRUNC("HIRE_DATE", \'MM\')') &&
    oracleQuery.sql.includes('"HR"."EMPLOYEES"')
  );

  // ========================================================
  // 10. ROLLING AVERAGE AND RUNNING TOTAL IN SQLITE
  // ========================================================
  const rollingConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: 'net_sales',
    measureFunction: 'SUM',
    mode: 'rolling_avg',
    rollingWindow: 3
  };
  const rollingQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    rollingConfig,
    100
  );

  const rollingRows = db.prepare(rollingQuery.sql).all() as any[];
  record(
    '26. Rolling moving average query executes cleanly in SQLite',
    rollingRows.length === 6 && rollingRows[0].rolling_3_month_avg !== undefined
  );

  const runningSumConfig: DateAnalysisConfig = {
    dateColumn: 'order_date',
    period: 'month',
    measureColumn: 'net_sales',
    measureFunction: 'SUM',
    mode: 'running_sum'
  };
  const runningSumQuery = sqliteGenerator.generateDateAnalysis(
    'imported',
    'datapilot_analytics_test_dataset',
    runningSumConfig,
    100
  );

  const runningSumRows = db.prepare(runningSumQuery.sql).all() as any[];
  record(
    '27. Cumulative running SUM query executes cleanly in SQLite with cumulative totals',
    runningSumRows.length === 7 &&
    runningSumRows[0].running_total === 1000 &&
    runningSumRows[1].running_total === 2500 &&
    runningSumRows[6].running_total === 27500
  );

  return results;
}
