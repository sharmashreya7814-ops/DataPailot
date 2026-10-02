import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import { MySQLAdapter } from '../server/database/MySQLAdapter';
import { SQLServerAdapter } from '../server/database/SQLServerAdapter';
import { OracleAdapter } from '../server/database/OracleAdapter';
import { FilterCondition } from '../src/types/analysis';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAnalysisFilteringFlowTests(): Promise<TestResult[]> {
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

  // 1. Regression test: imported dataset city = Surat
  const filterSurat: FilterCondition[] = [
    { id: 'f-1', column: 'city', operator: '=', value: 'Surat', logic: 'AND' }
  ];
  const querySurat = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterSurat,
    [],
    100
  );

  const expectedSuratSql = `SELECT *\nFROM "datapilot_analytics_test_dataset"\nWHERE "city" = 'Surat'\nLIMIT 100;`;
  record(
    '1. Imported dataset city = Surat produces exact expected SQL predicate',
    querySurat.sql === expectedSuratSql,
    `Expected:\n${expectedSuratSql}\nGot:\n${querySurat.sql}`
  );

  record(
    '2. Imported dataset city = Surat contains NO "Clause" placeholder',
    !querySurat.sql.includes('Clause') && !querySurat.sql.includes('clause')
  );

  record(
    '3. Imported dataset city = Surat omits "imported" schema prefix',
    querySurat.sql.includes('FROM "datapilot_analytics_test_dataset"') &&
    !querySurat.sql.includes('"imported"."datapilot_analytics_test_dataset"') &&
    !querySurat.sql.includes('imported.datapilot_analytics_test_dataset')
  );

  record(
    '4. Query metadata correctly identifies tablesUsed without schema prefix',
    querySurat.tablesUsed.length === 1 && querySurat.tablesUsed[0] === 'datapilot_analytics_test_dataset'
  );

  // 2. Numeric comparison: net_sales > 30000 (must remain numeric without quotes)
  const filterNumeric: FilterCondition[] = [
    { id: 'f-2', column: 'net_sales', operator: '>', value: '30000', logic: 'AND' }
  ];
  const queryNumeric = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterNumeric,
    ['order_id', 'net_sales'],
    50
  );

  record(
    '5. Numeric comparison net_sales > 30000 formats value as bare number',
    queryNumeric.sql.includes('"net_sales" > 30000') && !queryNumeric.sql.includes('"net_sales" > \'30000\'')
  );

  const filterDecimal: FilterCondition[] = [
    { id: 'f-3', column: 'unit_price', operator: '<=', value: '19.99', logic: 'AND' }
  ];
  const queryDecimal = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterDecimal,
    [],
    100
  );
  record(
    '6. Decimal comparison formats as bare decimal number',
    queryDecimal.sql.includes('"unit_price" <= 19.99')
  );

  // 3. IN and NOT IN operators
  const filterInText: FilterCondition[] = [
    { id: 'f-4', column: 'city', operator: 'IN', value: 'Surat, Ahmedabad, Mumbai', logic: 'AND' }
  ];
  const queryInText = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterInText,
    [],
    100
  );
  record(
    '7. IN operator parses comma-separated text values with single quotes',
    queryInText.sql.includes(`"city" IN ('Surat', 'Ahmedabad', 'Mumbai')`)
  );

  const filterInNumeric: FilterCondition[] = [
    { id: 'f-5', column: 'status_code', operator: 'IN', value: '100, 200, 300', logic: 'AND' }
  ];
  const queryInNumeric = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterInNumeric,
    [],
    100
  );
  record(
    '8. IN operator parses comma-separated numeric values without quotes',
    queryInNumeric.sql.includes(`"status_code" IN (100, 200, 300)`)
  );

  const filterNotIn: FilterCondition[] = [
    { id: 'f-6', column: 'city', operator: 'NOT IN', value: 'Surat, Mumbai', logic: 'AND' }
  ];
  const queryNotIn = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterNotIn,
    [],
    100
  );
  record(
    '9. NOT IN operator generates correct SQL predicate',
    queryNotIn.sql.includes(`"city" NOT IN ('Surat', 'Mumbai')`)
  );

  // 4. BETWEEN operator
  const filterBetweenNum: FilterCondition[] = [
    { id: 'f-7', column: 'net_sales', operator: 'BETWEEN', value: '10000', value2: '50000', logic: 'AND' }
  ];
  const queryBetweenNum = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterBetweenNum,
    [],
    100
  );
  record(
    '10. BETWEEN operator handles numeric bounds correctly',
    queryBetweenNum.sql.includes('"net_sales" BETWEEN 10000 AND 50000')
  );

  const filterBetweenDate: FilterCondition[] = [
    { id: 'f-8', column: 'order_date', operator: 'BETWEEN', value: '2023-01-01', value2: '2023-12-31', logic: 'AND' }
  ];
  const queryBetweenDate = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterBetweenDate,
    [],
    100
  );
  record(
    '11. BETWEEN operator handles date bounds as quoted literals',
    queryBetweenDate.sql.includes(`"order_date" BETWEEN '2023-01-01' AND '2023-12-31'`)
  );

  // 5. IS NULL and IS NOT NULL operators (do not require values)
  const filterIsNull: FilterCondition[] = [
    { id: 'f-9', column: 'delivery_date', operator: 'IS NULL', value: '', logic: 'AND' }
  ];
  const queryIsNull = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterIsNull,
    [],
    100
  );
  record(
    '12. IS NULL operator formats cleanly without requiring a value',
    queryIsNull.sql.includes('"delivery_date" IS NULL') && !queryIsNull.sql.includes("''")
  );

  const filterIsNotNull: FilterCondition[] = [
    { id: 'f-10', column: 'delivery_date', operator: 'IS NOT NULL', value: '', logic: 'AND' }
  ];
  const queryIsNotNull = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterIsNotNull,
    [],
    100
  );
  record(
    '13. IS NOT NULL operator formats cleanly without requiring a value',
    queryIsNotNull.sql.includes('"delivery_date" IS NOT NULL')
  );

  // 6. Multi-condition filters with AND / OR
  const filterMulti: FilterCondition[] = [
    { id: 'f-11', column: 'city', operator: '=', value: 'Surat', logic: 'AND' },
    { id: 'f-12', column: 'net_sales', operator: '>', value: '30000', logic: 'AND' }
  ];
  const queryMulti = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterMulti,
    [],
    100
  );
  const expectedMultiWhere = `WHERE\n  "city" = 'Surat'\n  AND "net_sales" > 30000`;
  record(
    '14. Multi-condition filter formats WHERE clause with indent and AND conjunction',
    queryMulti.sql.includes(expectedMultiWhere),
    `Expected to include:\n${expectedMultiWhere}\nGot:\n${queryMulti.sql}`
  );

  const filterMultiOr: FilterCondition[] = [
    { id: 'f-13', column: 'city', operator: '=', value: 'Surat', logic: 'AND' },
    { id: 'f-14', column: 'city', operator: '=', value: 'Ahmedabad', logic: 'OR' },
    { id: 'f-15', column: 'net_sales', operator: '>=', value: '25000', logic: 'AND' }
  ];
  const queryMultiOr = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterMultiOr,
    [],
    100
  );
  record(
    '15. Multi-condition with mixed OR and AND retains correct logic keywords',
    queryMultiOr.sql.includes('"city" = \'Surat\'') &&
    queryMultiOr.sql.includes('OR "city" = \'Ahmedabad\'') &&
    queryMultiOr.sql.includes('AND "net_sales" >= 25000')
  );

  // 7. SQL escaping / parameter safety
  const filterInjection: FilterCondition[] = [
    { id: 'f-16', column: 'city', operator: '=', value: "Surat' OR '1'='1", logic: 'AND' }
  ];
  const queryInjection = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterInjection,
    [],
    100
  );
  record(
    '16. Single quotes in user input are safely doubled to neutralize SQL injection',
    queryInjection.sql.includes(`"city" = 'Surat'' OR ''1''=''1'`)
  );

  const filterDrop: FilterCondition[] = [
    { id: 'f-17', column: 'search_term', operator: 'LIKE', value: "Surat'; DROP TABLE users; --", logic: 'AND' }
  ];
  const queryDrop = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterDrop,
    [],
    100
  );
  record(
    '17. Semicolons and SQL statements in LIKE patterns are escaped safely inside literals',
    queryDrop.sql.includes(`"search_term" LIKE '%Surat''; DROP TABLE users; --%'`)
  );

  // 8. LIKE / CONTAINS operator
  const filterLike: FilterCondition[] = [
    { id: 'f-18', column: 'city', operator: 'LIKE', value: 'Surat', logic: 'AND' }
  ];
  const queryLike = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterLike,
    [],
    100
  );
  record(
    '18. LIKE operator wraps plain value with wildcard % safely',
    queryLike.sql.includes(`"city" LIKE '%Surat%'`)
  );

  // 9. Rejection of forbidden placeholders
  let caughtPlaceholder = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT * FROM tbl WHERE Clause LIMIT 10;');
  } catch {
    caughtPlaceholder = true;
  }
  record(
    '19. validateNoPlaceholders detects and rejects "Clause" placeholder',
    caughtPlaceholder
  );

  let caughtUndefined = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT * FROM tbl WHERE "col" = undefined;');
  } catch {
    caughtUndefined = true;
  }
  record(
    '20. validateNoPlaceholders detects and rejects "undefined" placeholder',
    caughtUndefined
  );

  let caughtObject = false;
  try {
    AnalysisSqlGenerator.validateNoPlaceholders('SELECT * FROM tbl WHERE "col" = [object Object];');
  } catch {
    caughtObject = true;
  }
  record(
    '21. validateNoPlaceholders detects and rejects "[object Object]" placeholder',
    caughtObject
  );

  // 10. Connected databases dialect compatibility
  const pgAdapter = new PostgreSQLAdapter({ type: 'postgresql', host: 'localhost', database: 'testdb', username: 'postgres' });
  const pgGenerator = new AnalysisSqlGenerator(pgAdapter.getDialect());
  const pgQuery = pgGenerator.generateFilterQuery(
    'analytics_practice',
    'orders',
    [{ id: 'f-19', column: 'city', operator: '=', value: 'Surat', logic: 'AND' }],
    [],
    50
  );
  record(
    '22. PostgreSQL dialect qualifies schema and table as "analytics_practice"."orders"',
    pgQuery.sql.includes('FROM "analytics_practice"."orders"') &&
    pgQuery.sql.includes('WHERE "city" = \'Surat\'') &&
    pgQuery.sql.includes('LIMIT 50;')
  );

  const mysqlAdapter = new MySQLAdapter({ type: 'mysql', host: 'localhost', database: 'testdb', username: 'root' });
  const mysqlGenerator = new AnalysisSqlGenerator(mysqlAdapter.getDialect());
  const mysqlQuery = mysqlGenerator.generateFilterQuery(
    'analytics_practice',
    'orders',
    [{ id: 'f-20', column: 'city', operator: '=', value: 'Surat', logic: 'AND' }],
    [],
    50
  );
  record(
    '23. MySQL dialect qualifies schema and table as `analytics_practice`.`orders` with backticks',
    mysqlQuery.sql.includes('FROM `analytics_practice`.`orders`') &&
    mysqlQuery.sql.includes('WHERE `city` = \'Surat\'')
  );

  const sqlserverAdapter = new SQLServerAdapter({ type: 'sqlserver', host: 'localhost', database: 'testdb', username: 'sa', password: 'p', port: 1433 } as any);
  const sqlserverGenerator = new AnalysisSqlGenerator(sqlserverAdapter.getDialect());
  const sqlserverQuery = sqlserverGenerator.generateFilterQuery(
    'sales',
    'orders',
    [{ id: 'f-21', column: 'city', operator: '=', value: 'Surat', logic: 'AND' }],
    [],
    50
  );
  record(
    '24. SQL Server dialect qualifies schema and table as [sales].[orders]',
    sqlserverQuery.sql.includes('FROM [sales].[orders]') &&
    sqlserverQuery.sql.includes('WHERE [city] = \'Surat\'')
  );

  const oracleAdapter = new OracleAdapter({ type: 'oracle', host: 'localhost', database: 'XE', username: 'SYSTEM' });
  const oracleGenerator = new AnalysisSqlGenerator(oracleAdapter.getDialect());
  const oracleQuery = oracleGenerator.generateFilterQuery(
    'HR',
    'EMPLOYEES',
    [{ id: 'f-22', column: 'CITY', operator: '=', value: 'Surat', logic: 'AND' }],
    [],
    50
  );
  record(
    '25. Oracle dialect qualifies schema and table as "HR"."EMPLOYEES"',
    oracleQuery.sql.includes('FROM "HR"."EMPLOYEES"') &&
    oracleQuery.sql.includes('WHERE "CITY" = \'Surat\'')
  );

  // 11. Column projection
  const queryProjected = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    filterSurat,
    ['order_id', 'city', 'net_sales'],
    100
  );
  record(
    '26. Selected columns are explicitly projected in SELECT clause',
    queryProjected.sql.startsWith('SELECT "order_id", "city", "net_sales"')
  );

  // 12. Empty filters returns clean unfiltered query
  const queryEmptyFilters = sqliteGenerator.generateFilterQuery(
    'imported',
    'datapilot_analytics_test_dataset',
    [],
    [],
    100
  );
  record(
    '27. Empty filters list returns valid query with NO WHERE clause',
    !queryEmptyFilters.sql.includes('WHERE') && queryEmptyFilters.sql.includes('FROM "datapilot_analytics_test_dataset"')
  );

  return results;
}
