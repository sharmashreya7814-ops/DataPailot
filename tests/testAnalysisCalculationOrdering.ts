import { DatabaseSync } from 'node:sqlite';
import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';
import { CalculatedColumnConfig } from '../src/types/analysis';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAnalysisCalculationOrderingTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  // SQLite dialect as used for imported datasets
  const sqliteDialect = {
    quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
    formatLimit: (sql: string, limit: number) => `${sql}\nLIMIT ${limit}`,
    formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`,
    formatDate: (date: Date) => `'${date.toISOString()}'`,
    formatExplain: (sql: string) => `EXPLAIN QUERY PLAN ${sql}`,
    qualifyTable: (_schema: string | undefined, table: string) => `"${table.replace(/"/g, '""')}"`
  };

  const sqliteGenerator = new AnalysisSqlGenerator(sqliteDialect);

  // Expected original columns for the user dataset in exact sequence
  const originalColumns = [
    'order_id',
    'order_date',
    'city',
    'category',
    'product',
    'quantity',
    'unit_price',
    'discount',
    'channel',
    'status',
    'region',
    'gross_sales',
    'discount_amount',
    'net_sales'
  ];

  const expectedCalculatedColumns = [...originalColumns, 'Profit'];

  // Setup in-memory SQLite fixture with the user's exact dataset schema
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
      discount REAL,
      channel TEXT,
      status TEXT,
      region TEXT,
      gross_sales REAL,
      discount_amount REAL,
      net_sales REAL
    );

    INSERT INTO datapilot_analytics_test_dataset VALUES
      (101, '2024-01-10', 'Surat', 'Electronics', 'Laptop Mouse', 5, 20.0, 0, 'Online', 'Delivered', 'West', 100.0, 0, 100.0),
      (102, '2024-01-11', 'Mumbai', 'Furniture', 'Ergo Chair', 2, 150.0, 10.0, 'Retail', 'Delivered', 'West', 300.0, 30.0, 270.0),
      (103, '2024-01-12', 'Ahmedabad', 'Supplies', 'Desk Pad', 10, 15.5, 5.0, 'Online', 'Processing', 'West', 155.0, 7.75, 147.25),
      (104, '2024-01-13', 'Surat', 'Audio', 'Earbuds', 4, 45.0, 0, 'Direct', 'Shipped', 'West', 180.0, 0, 180.0);
  `);

  // ========================================================
  // 1. GENERATE SQL FOR Profit = quantity * unit_price
  // ========================================================
  const profitConfig: CalculatedColumnConfig = {
    col1: 'quantity',
    operator: '*',
    col2: 'unit_price',
    alias: 'Profit'
  };

  const profitQuery = sqliteGenerator.generateCalculatedColumn(
    'imported',
    'datapilot_analytics_test_dataset',
    profitConfig,
    100
  );

  record(
    '1. Generated SQL selects "*" first and appends calculation expression at the end',
    profitQuery.sql.includes('SELECT\n    *,\n    ("quantity" * "unit_price") AS "Profit"\nFROM "datapilot_analytics_test_dataset"')
  );

  record(
    '2. Generated SQL does NOT place input columns (col1, col2) at the start of SELECT projection',
    !profitQuery.sql.startsWith('SELECT\n    "quantity",') &&
    !profitQuery.sql.includes('SELECT\n    "quantity",\n    "unit_price"')
  );

  record(
    '3. Generated SQL description correctly interpolates operator instead of literal string',
    profitQuery.description.includes('Compute quantity * unit_price as Profit')
  );

  record(
    '4. Query metadata tablesUsed identifies target table without invalid imported prefix',
    profitQuery.tablesUsed.length === 1 && profitQuery.tablesUsed[0] === 'datapilot_analytics_test_dataset'
  );

  record(
    '5. Query metadata columnsUsed tracks both input columns',
    profitQuery.columnsUsed.includes('quantity') && profitQuery.columnsUsed.includes('unit_price')
  );

  // ========================================================
  // 2. EXECUTE QUERY AND VERIFY COLUMN ORDERING
  // ========================================================
  const resultRows = db.prepare(profitQuery.sql).all() as Record<string, any>[];
  const actualColumnKeys = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

  record(
    '6. Result column count equals original column count + 1 (14 original + 1 Profit = 15)',
    actualColumnKeys.length === 15,
    `Expected 15 columns, got ${actualColumnKeys.length}`
  );

  record(
    '7. Result column sequence EXACTLY matches required dataset column order with Profit at the end',
    JSON.stringify(actualColumnKeys) === JSON.stringify(expectedCalculatedColumns),
    `Expected:\n${JSON.stringify(expectedCalculatedColumns)}\nGot:\n${JSON.stringify(actualColumnKeys)}`
  );

  record(
    '8. Calculation input column "quantity" remains at its original index (index 5) and is NOT moved to index 0',
    actualColumnKeys.indexOf('quantity') === 5 && actualColumnKeys[0] === 'order_id'
  );

  record(
    '9. Calculation input column "unit_price" remains at its original index (index 6) and is NOT moved to index 1',
    actualColumnKeys.indexOf('unit_price') === 6 && actualColumnKeys[1] === 'order_date'
  );

  record(
    '10. Newly calculated column "Profit" is located at the very last index (index 14)',
    actualColumnKeys[actualColumnKeys.length - 1] === 'Profit'
  );

  record(
    '11. No columns are duplicated in the result set (all 15 column names are distinct)',
    new Set(actualColumnKeys).size === actualColumnKeys.length
  );

  // ========================================================
  // 3. ROW ORDER & VALUE CORRECTNESS VERIFICATION
  // ========================================================
  record(
    '12. Row count matches original dataset row count (4 rows)',
    resultRows.length === 4
  );

  const rowOrderPreserved =
    resultRows[0].order_id === 101 &&
    resultRows[1].order_id === 102 &&
    resultRows[2].order_id === 103 &&
    resultRows[3].order_id === 104;

  record(
    '13. Original row order is strictly preserved (101, 102, 103, 104)',
    rowOrderPreserved
  );

  record(
    '14. Row 1 calculated Profit value is correct (5 * 20.0 = 100.0)',
    resultRows[0].Profit === 100.0,
    `Expected 100.0, got ${resultRows[0].Profit}`
  );

  record(
    '15. Row 2 calculated Profit value is correct (2 * 150.0 = 300.0)',
    resultRows[1].Profit === 300.0,
    `Expected 300.0, got ${resultRows[1].Profit}`
  );

  record(
    '16. Row 3 calculated Profit value is correct (10 * 15.5 = 155.0)',
    resultRows[2].Profit === 155.0,
    `Expected 155.0, got ${resultRows[2].Profit}`
  );

  record(
    '17. Row 4 calculated Profit value is correct (4 * 45.0 = 180.0)',
    resultRows[3].Profit === 180.0,
    `Expected 180.0, got ${resultRows[3].Profit}`
  );

  // ========================================================
  // 4. VERIFY ALL OPERATORS (+, -, *, /)
  // ========================================================

  // Addition (+)
  const addConfig: CalculatedColumnConfig = {
    col1: 'gross_sales',
    operator: '+',
    col2: 'discount_amount',
    alias: 'total_computed'
  };
  const addQuery = sqliteGenerator.generateCalculatedColumn(
    'imported',
    'datapilot_analytics_test_dataset',
    addConfig,
    100
  );
  const addRows = db.prepare(addQuery.sql).all() as Record<string, any>[];
  const addCols = Object.keys(addRows[0]);
  record(
    '18. Addition operator (+) appends calculated column at the end and preserves original column order',
    addCols[addCols.length - 1] === 'total_computed' &&
    JSON.stringify(addCols.slice(0, 14)) === JSON.stringify(originalColumns) &&
    addRows[1].total_computed === 330.0 // 300.0 + 30.0
  );

  // Subtraction (-)
  const subConfig: CalculatedColumnConfig = {
    col1: 'gross_sales',
    operator: '-',
    col2: 'discount_amount',
    alias: 'net_computed'
  };
  const subQuery = sqliteGenerator.generateCalculatedColumn(
    'imported',
    'datapilot_analytics_test_dataset',
    subConfig,
    100
  );
  const subRows = db.prepare(subQuery.sql).all() as Record<string, any>[];
  const subCols = Object.keys(subRows[0]);
  record(
    '19. Subtraction operator (-) appends calculated column at the end and preserves original column order',
    subCols[subCols.length - 1] === 'net_computed' &&
    JSON.stringify(subCols.slice(0, 14)) === JSON.stringify(originalColumns) &&
    subRows[1].net_computed === 270.0 // 300.0 - 30.0
  );

  // Division (/)
  const divConfig: CalculatedColumnConfig = {
    col1: 'gross_sales',
    operator: '/',
    col2: 'quantity',
    alias: 'unit_calc'
  };
  const divQuery = sqliteGenerator.generateCalculatedColumn(
    'imported',
    'datapilot_analytics_test_dataset',
    divConfig,
    100
  );
  const divRows = db.prepare(divQuery.sql).all() as Record<string, any>[];
  const divCols = Object.keys(divRows[0]);
  record(
    '20. Division operator (/) appends calculated column at the end and preserves original column order',
    divCols[divCols.length - 1] === 'unit_calc' &&
    JSON.stringify(divCols.slice(0, 14)) === JSON.stringify(originalColumns) &&
    divRows[0].unit_calc === 20.0 // 100.0 / 5
  );

  // Division by zero safe handling with NULLIF
  db.exec(`INSERT INTO datapilot_analytics_test_dataset (order_id, quantity, gross_sales) VALUES (999, 0, 50.0);`);
  const divZeroRows = db.prepare(divQuery.sql).all() as Record<string, any>[];
  const zeroRow = divZeroRows.find(r => r.order_id === 999);
  record(
    '21. Division by zero safely yields NULL via NULLIF without throwing runtime error',
    zeroRow !== undefined && (zeroRow.unit_calc === null || zeroRow.unit_calc === undefined)
  );

  // ========================================================
  // 5. EXTERNAL CONNECTED DATABASE DIALECTS COMPATIBILITY
  // ========================================================

  // PostgreSQL
  const pgAdapter = new PostgreSQLAdapter({ type: 'postgresql', host: 'localhost', database: 'testdb', username: 'postgres' });
  const pgGenerator = new AnalysisSqlGenerator(pgAdapter.getDialect());
  const pgQuery = pgGenerator.generateCalculatedColumn(
    'analytics_practice',
    'orders',
    profitConfig,
    50
  );
  record(
    '22. PostgreSQL dialect generates "SELECT *, (expr) AS alias FROM schema.table" with limit',
    pgQuery.sql.includes('SELECT\n    *,\n    ("quantity" * "unit_price") AS "Profit"\nFROM "analytics_practice"."orders"') &&
    pgQuery.sql.includes('LIMIT 50;')
  );

  // MySQL
  const mysqlAdapter = new MySQLAdapter({ type: 'mysql', host: 'localhost', database: 'testdb', username: 'root' });
  const mysqlGenerator = new AnalysisSqlGenerator(mysqlAdapter.getDialect());
  const mysqlQuery = mysqlGenerator.generateCalculatedColumn(
    'analytics_practice',
    'orders',
    profitConfig,
    50
  );
  record(
    '23. MySQL dialect generates "SELECT *, (expr) AS alias FROM `schema`.`table`" with backticks',
    mysqlQuery.sql.includes('SELECT\n    *,\n    (`quantity` * `unit_price`) AS `Profit`\nFROM `analytics_practice`.`orders`')
  );

  // SQL Server
  const sqlserverAdapter = new SQLServerAdapter({ type: 'sqlserver', host: 'localhost', database: 'testdb', username: 'sa', password: 'p', port: 1433 } as any);
  const sqlserverGenerator = new AnalysisSqlGenerator(sqlserverAdapter.getDialect());
  const sqlserverQuery = sqlserverGenerator.generateCalculatedColumn(
    'sales',
    'orders',
    profitConfig,
    50
  );
  record(
    '24. SQL Server dialect generates "SELECT TOP (50) *, (expr) AS alias FROM [sales].[orders]"',
    sqlserverQuery.sql.includes('*,') &&
    sqlserverQuery.sql.includes('([quantity] * [unit_price]) AS [Profit]') &&
    sqlserverQuery.sql.includes('FROM [sales].[orders]')
  );

  // Oracle
  const oracleAdapter = new OracleAdapter({ type: 'oracle', host: 'localhost', database: 'XE', username: 'SYSTEM' });
  const oracleGenerator = new AnalysisSqlGenerator(oracleAdapter.getDialect());
  const oracleQuery = oracleGenerator.generateCalculatedColumn(
    'HR',
    'EMPLOYEES',
    { col1: 'SALARY', operator: '*', col2: 'COMMISSION_PCT', alias: 'BONUS' },
    50
  );
  record(
    '25. Oracle dialect qualifies table and appends calculation at the end of "*"',
    oracleQuery.sql.includes('SELECT\n    *,\n    ("SALARY" * "COMMISSION_PCT") AS "BONUS"\nFROM "HR"."EMPLOYEES"')
  );

  // ========================================================
  // 6. EXISTING CASE CATEGORY TESTS CONTINUE TO PRESERVE ORDER
  // ========================================================
  const caseQuery = sqliteGenerator.generateCaseCategory(
    'imported',
    'datapilot_analytics_test_dataset',
    {
      column: 'net_sales',
      rules: [
        { id: '1', column: 'net_sales', operator: '>=', value: '200', resultLabel: 'High' },
        { id: '2', column: 'net_sales', operator: '>=', value: '100', resultLabel: 'Medium' }
      ],
      fallbackLabel: 'Low',
      alias: 'sales_tier'
    },
    100
  );
  const caseRows = db.prepare(caseQuery.sql).all() as Record<string, any>[];
  const caseCols = Object.keys(caseRows[0]);
  record(
    '26. CASE Category queries also preserve original column order and append category alias at the end',
    caseCols[caseCols.length - 1] === 'sales_tier' &&
    JSON.stringify(caseCols.slice(0, 14)) === JSON.stringify(originalColumns) &&
    caseRows[0].sales_tier === 'Medium' && // 100.0
    caseRows[1].sales_tier === 'High'     // 270.0
  );

  return results;
}
