import { DatabaseSync } from 'node:sqlite';
import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';
import { TopNPerGroupConfig } from '../src/types/analysis';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAnalysisRankingTopNPerGroupTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  // SQLite dialect configuration as used in queryRoutes.ts for imported datasets
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

  // Setup SQLite test database with realistic test dataset
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
      -- Surat (7 records to test Top 5 cut-off)
      (1, '2026-01-10', 'Surat', 'Tech', 'Mouse', 5, 20.0, 100.0),
      (2, '2026-01-12', 'Surat', 'Tech', 'Keyboard', 3, 50.0, 150.0),
      (3, '2026-01-15', 'Surat', 'Office', 'Chair', 2, 200.0, 400.0),
      (4, '2026-01-18', 'Surat', 'Office', 'Desk', 1, 600.0, 600.0),
      (5, '2026-01-20', 'Surat', 'Tech', 'Monitor', 4, 300.0, 1200.0),
      (6, '2026-01-22', 'Surat', 'Tech', 'Laptop', 1, 1500.0, 1500.0),
      (7, '2026-01-25', 'Surat', 'Office', 'Lamp', 2, 25.0, 50.0),

      -- Mumbai (3 records)
      (8, '2026-02-01', 'Mumbai', 'Tech', 'Server', 1, 5000.0, 5000.0),
      (9, '2026-02-05', 'Mumbai', 'Office', 'Whiteboard', 2, 150.0, 300.0),
      (10, '2026-02-10', 'Mumbai', 'Tech', 'Router', 3, 200.0, 600.0),

      -- Ahmedabad (2 records)
      (11, '2026-03-01', 'Ahmedabad', 'Tech', 'Tablet', 2, 450.0, 900.0),
      (12, '2026-03-05', 'Ahmedabad', 'Office', 'Paper', 10, 10.0, 100.0);
  `);

  // ========================================================
  // 1. IMPORTED DATASET RANKING (USER REPORTED FLOW)
  // ========================================================
  const userConfig: TopNPerGroupConfig = {
    groupColumn: 'city',
    rankingColumn: 'net_sales',
    n: 5,
    direction: 'DESC',
    rankingMethod: 'ROW_NUMBER'
  };

  const userQuery = sqliteGenerator.generateTopNPerGroup(
    'imported',
    'datapilot_analytics_test_dataset',
    userConfig
  );

  record(
    '1. Generated Ranking SQL starts with WITH ranked AS CTE',
    userQuery.sql.startsWith('WITH ranked AS (')
  );

  record(
    '2. Generated Ranking SQL uses ROW_NUMBER() window function over partition',
    userQuery.sql.includes('ROW_NUMBER() OVER (')
  );

  record(
    '3. Group/partition column dynamically quotes selected column ("city")',
    userQuery.sql.includes('PARTITION BY "city"')
  );

  record(
    '4. Ranking metric dynamically quotes selected metric ("net_sales")',
    userQuery.sql.includes('ORDER BY "net_sales" DESC')
  );

  record(
    '5. Top N filter uses selected value (WHERE rank <= 5)',
    userQuery.sql.includes('WHERE rank <= 5')
  );

  record(
    '6. Final ORDER BY sorts by partition column then rank',
    userQuery.sql.includes('ORDER BY "city" ASC, rank ASC')
  );

  record(
    '7. Does NOT contain invalid reference "config"',
    !userQuery.sql.includes('config')
  );

  record(
    '8. Does NOT contain unresolved template variable "groupCol"',
    !userQuery.sql.includes('groupCol')
  );

  record(
    '9. Does NOT contain unresolved template variable "rankCol"',
    !userQuery.sql.includes('rankCol')
  );

  // ========================================================
  // 2. LIVE SQLITE EXECUTION & DATA INTEGRITY
  // ========================================================
  let rows: any[] = [];
  let executionError: string | undefined;
  try {
    rows = db.prepare(userQuery.sql).all() as any[];
  } catch (err: any) {
    executionError = err.message;
  }

  record(
    '10. Query executes cleanly in SQLite without syntax errors (near "config" is resolved)',
    executionError === undefined && rows.length > 0,
    executionError
  );

  // Check columns returned
  const returnedCols = rows.length > 0 ? Object.keys(rows[0]) : [];
  const expectedCols = [
    'order_id',
    'order_date',
    'city',
    'category',
    'product',
    'quantity',
    'unit_price',
    'net_sales',
    'rank'
  ];

  record(
    '11. Preserves all original columns in original order with "rank" appended at the end',
    JSON.stringify(returnedCols) === JSON.stringify(expectedCols)
  );

  // Check partition count and Top 5 enforcement
  // Surat had 7 rows, should be cut off to 5
  // Mumbai had 3 rows, all 3 returned
  // Ahmedabad had 2 rows, both 2 returned
  // Total expected = 5 + 3 + 2 = 10 rows
  const suratRows = rows.filter(r => r.city === 'Surat');
  const mumbaiRows = rows.filter(r => r.city === 'Mumbai');
  const ahmedabadRows = rows.filter(r => r.city === 'Ahmedabad');

  record(
    '12. Exactly Top 5 rows returned for Surat (7 total cut off to 5)',
    suratRows.length === 5
  );

  record(
    '13. Surat ranks are sequentially 1, 2, 3, 4, 5',
    suratRows.map(r => r.rank).join(',') === '1,2,3,4,5'
  );

  record(
    '14. Surat top rank is Laptop with highest net_sales (1500.0)',
    suratRows[0].product === 'Laptop' && suratRows[0].net_sales === 1500.0 && suratRows[0].rank === 1
  );

  record(
    '15. Surat second rank is Monitor (1200.0)',
    suratRows[1].product === 'Monitor' && suratRows[1].net_sales === 1200.0 && suratRows[1].rank === 2
  );

  record(
    '16. Surat excluded rows are lowest net_sales (Lamp 50.0 and Mouse 100.0)',
    !suratRows.some(r => r.product === 'Lamp') && !suratRows.some(r => r.product === 'Mouse')
  );

  record(
    '17. Mumbai all 3 rows returned with ranks 1, 2, 3',
    mumbaiRows.length === 3 && mumbaiRows.map(r => r.rank).join(',') === '1,2,3'
  );

  record(
    '18. Mumbai rank 1 is Server with 5000.0 net_sales',
    mumbaiRows[0].product === 'Server' && mumbaiRows[0].net_sales === 5000.0 && mumbaiRows[0].rank === 1
  );

  record(
    '19. Ahmedabad all 2 rows returned with ranks 1, 2',
    ahmedabadRows.length === 2 && ahmedabadRows.map(r => r.rank).join(',') === '1,2'
  );

  record(
    '20. Total returned rows across all partitions is exactly 10 (5 + 3 + 2)',
    rows.length === 10
  );

  // ========================================================
  // 3. ASC / LOWEST FIRST DIRECTION
  // ========================================================
  const ascConfig: TopNPerGroupConfig = {
    groupColumn: 'city',
    rankingColumn: 'net_sales',
    n: 3,
    direction: 'ASC',
    rankingMethod: 'ROW_NUMBER'
  };

  const ascQuery = sqliteGenerator.generateTopNPerGroup(
    'imported',
    'datapilot_analytics_test_dataset',
    ascConfig
  );

  record(
    '21. ASC direction generates ORDER BY "net_sales" ASC',
    ascQuery.sql.includes('ORDER BY "net_sales" ASC')
  );

  const ascRows = db.prepare(ascQuery.sql).all() as any[];
  const suratAsc = ascRows.filter(r => r.city === 'Surat');

  record(
    '22. Lowest First (ASC) assigns rank 1 to lowest net_sales (Lamp: 50.0)',
    suratAsc[0].product === 'Lamp' && suratAsc[0].net_sales === 50.0 && suratAsc[0].rank === 1
  );

  record(
    '23. Lowest First (ASC) Surat rank 2 is Mouse: 100.0',
    suratAsc[1].product === 'Mouse' && suratAsc[1].net_sales === 100.0 && suratAsc[1].rank === 2
  );

  // ========================================================
  // 4. DIFFERENT TOP N VALUES (TOP 2, TOP 1)
  // ========================================================
  const top2Config: TopNPerGroupConfig = {
    groupColumn: 'city',
    rankingColumn: 'net_sales',
    n: 2,
    direction: 'DESC',
    rankingMethod: 'ROW_NUMBER'
  };
  const top2Query = sqliteGenerator.generateTopNPerGroup(
    'imported',
    'datapilot_analytics_test_dataset',
    top2Config
  );
  const top2Rows = db.prepare(top2Query.sql).all() as any[];
  record(
    '24. Top N = 2 limits every city to at most 2 records (Surat=2, Mumbai=2, Ahmedabad=2 -> 6 total)',
    top2Rows.length === 6 &&
    top2Rows.filter(r => r.city === 'Surat').length === 2 &&
    top2Rows.filter(r => r.city === 'Mumbai').length === 2 &&
    top2Rows.filter(r => r.city === 'Ahmedabad').length === 2
  );

  // ========================================================
  // 5. DYNAMIC SELECTED COLUMNS (PARTITION BY CATEGORY, RANK BY UNIT_PRICE)
  // ========================================================
  const dynamicConfig: TopNPerGroupConfig = {
    groupColumn: 'category',
    rankingColumn: 'unit_price',
    n: 3,
    direction: 'DESC',
    rankingMethod: 'ROW_NUMBER'
  };
  const dynamicQuery = sqliteGenerator.generateTopNPerGroup(
    'imported',
    'datapilot_analytics_test_dataset',
    dynamicConfig
  );

  record(
    '25. Dynamic columns partition by "category" and order by "unit_price"',
    dynamicQuery.sql.includes('PARTITION BY "category"') &&
    dynamicQuery.sql.includes('ORDER BY "unit_price" DESC')
  );

  const dynamicRows = db.prepare(dynamicQuery.sql).all() as any[];
  record(
    '26. Dynamic category ranking executes cleanly and limits Tech & Office to Top 3 each',
    dynamicRows.filter(r => r.category === 'Tech').length === 3 &&
    dynamicRows.filter(r => r.category === 'Office').length === 3
  );

  // ========================================================
  // 6. RANKING METHODS (DENSE_RANK & RANK)
  // ========================================================
  const denseRankQuery = sqliteGenerator.generateTopNPerGroup(
    'imported',
    'datapilot_analytics_test_dataset',
    { ...userConfig, rankingMethod: 'DENSE_RANK' }
  );
  record(
    '27. rankingMethod: DENSE_RANK generates DENSE_RANK() OVER',
    denseRankQuery.sql.includes('DENSE_RANK() OVER (')
  );

  const rankQuery = sqliteGenerator.generateTopNPerGroup(
    'imported',
    'datapilot_analytics_test_dataset',
    { ...userConfig, rankingMethod: 'RANK' }
  );
  record(
    '28. rankingMethod: RANK generates RANK() OVER',
    rankQuery.sql.includes('RANK() OVER (')
  );

  // ========================================================
  // 7. PLACEHOLDER & CONFIG DETECTION VALIDATION
  // ========================================================
  let detectedConfigRef = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT * FROM t ORDER BY col config.direction;');
  } catch (err: any) {
    if (err.message.includes('config.property')) {
      detectedConfigRef = true;
    }
  }
  record(
    '29. validateNoPlaceholders detects and rejects un-interpolated config.direction',
    detectedConfigRef
  );

  let detectedRankCol = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT * FROM t ORDER BY rankCol DESC;');
  } catch (err: any) {
    if (err.message.includes('rankCol')) {
      detectedRankCol = true;
    }
  }
  record(
    '30. validateNoPlaceholders detects and rejects un-interpolated rankCol',
    detectedRankCol
  );

  let detectedGroupCol = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT * FROM t PARTITION BY groupCol;');
  } catch (err: any) {
    if (err.message.includes('groupCol')) {
      detectedGroupCol = true;
    }
  }
  record(
    '31. validateNoPlaceholders detects and rejects un-interpolated groupCol',
    detectedGroupCol
  );

  // ========================================================
  // 8. TABLE QUOTING & METADATA FOR IMPORTED DATASETS
  // ========================================================
  record(
    '32. Imported dataset references table directly without imported. prefix',
    userQuery.sql.includes('FROM "datapilot_analytics_test_dataset"') &&
    !userQuery.sql.includes('"imported".')
  );

  record(
    '33. Query metadata tablesUsed contains clean table display name',
    userQuery.tablesUsed.length === 1 && userQuery.tablesUsed[0] === 'datapilot_analytics_test_dataset'
  );

  record(
    '34. Query metadata columnsUsed tracks both group and rank columns',
    userQuery.columnsUsed.includes('city') && userQuery.columnsUsed.includes('net_sales')
  );

  // ========================================================
  // 9. MULTI-DIALECT COMPATIBILITY (POSTGRESQL, MYSQL, MSSQL, ORACLE)
  // ========================================================
  const pgAdapter = new PostgreSQLAdapter({ type: 'postgresql', host: 'localhost', database: 'analytics_db', username: 'postgres' });
  const pgGen = new AnalysisSqlGenerator(pgAdapter.getDialect());
  const pgQuery = pgGen.generateTopNPerGroup('analytics_practice', 'orders', userConfig);
  record(
    '35. PostgreSQL dialect qualifies schema and quotes identifiers',
    pgQuery.sql.includes('FROM "analytics_practice"."orders"') &&
    pgQuery.sql.includes('PARTITION BY "city"') &&
    pgQuery.sql.includes('ORDER BY "net_sales" DESC')
  );

  const mysqlAdapter = new MySQLAdapter({ type: 'mysql', host: 'localhost', database: 'analytics_db', username: 'root' });
  const mysqlGen = new AnalysisSqlGenerator(mysqlAdapter.getDialect());
  const mysqlQuery = mysqlGen.generateTopNPerGroup('sales', 'orders', userConfig);
  record(
    '36. MySQL dialect qualifies schema and uses backticks',
    mysqlQuery.sql.includes('FROM `sales`.`orders`') &&
    mysqlQuery.sql.includes('PARTITION BY `city`') &&
    mysqlQuery.sql.includes('ORDER BY `net_sales` DESC')
  );

  const mssqlAdapter = new SQLServerAdapter({ type: 'sqlserver', host: 'localhost', database: 'sales_db', username: 'sa' });
  const mssqlGen = new AnalysisSqlGenerator(mssqlAdapter.getDialect());
  const mssqlQuery = mssqlGen.generateTopNPerGroup('sales', 'orders', userConfig);
  record(
    '37. SQL Server dialect qualifies schema and uses square brackets',
    mssqlQuery.sql.includes('FROM [sales].[orders]') &&
    mssqlQuery.sql.includes('PARTITION BY [city]') &&
    mssqlQuery.sql.includes('ORDER BY [net_sales] DESC')
  );

  const oracleAdapter = new OracleAdapter({ type: 'oracle', host: 'localhost', database: 'XE', username: 'HR' });
  const oracleGen = new AnalysisSqlGenerator(oracleAdapter.getDialect());
  const oracleQuery = oracleGen.generateTopNPerGroup('HR', 'EMPLOYEES', {
    ...userConfig,
    groupColumn: 'DEPARTMENT_ID',
    rankingColumn: 'SALARY'
  });
  record(
    '38. Oracle dialect qualifies schema and uses standard double quotes',
    oracleQuery.sql.includes('FROM "HR"."EMPLOYEES"') &&
    oracleQuery.sql.includes('PARTITION BY "DEPARTMENT_ID"') &&
    oracleQuery.sql.includes('ORDER BY "SALARY" DESC')
  );

  return results;
}
