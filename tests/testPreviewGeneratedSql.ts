import { AnalysisSqlGenerator } from '../server/database/AnalysisSqlGenerator';
import { PostgreSQLAdapter } from '../server/database/PostgreSQLAdapter';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runPreviewGeneratedSqlTests(): Promise<TestResult[]> {
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

  // 1. Select Columns on Imported Dataset
  const selectColsQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'select_columns',
    {
      columns: ['order_id', 'product', 'quantity', 'unit_price', 'net_sales'],
      limit: 20
    }
  );

  record(
    '1. Select Columns generated SQL references "imported_dataset" directly without invalid schema prefix',
    selectColsQuery.sql.includes('FROM "imported_dataset"') && !selectColsQuery.sql.includes('FROM "imported"."imported_dataset"')
  );

  record(
    '2. Select Columns generated SQL includes all requested column identifiers',
    selectColsQuery.sql.includes('"order_id"') &&
    selectColsQuery.sql.includes('"product"') &&
    selectColsQuery.sql.includes('"quantity"') &&
    selectColsQuery.sql.includes('"unit_price"') &&
    selectColsQuery.sql.includes('"net_sales"')
  );

  record(
    '3. Select Columns generated SQL includes LIMIT 20',
    selectColsQuery.sql.includes('LIMIT 20;')
  );

  record(
    '4. Select Columns query metadata reports tablesUsed as ["imported_dataset"]',
    selectColsQuery.tablesUsed.length === 1 && selectColsQuery.tablesUsed[0] === 'imported_dataset'
  );

  record(
    '5. Select Columns query metadata reports all 5 columnsUsed',
    selectColsQuery.columnsUsed.length === 5 && selectColsQuery.columnsUsed.includes('net_sales')
  );

  // 2. Preview Data operation on Imported Dataset
  const previewDataQuery = sqliteGenerator.generateBasic(
    'imported',
    'sales_records',
    'preview',
    { limit: 20 }
  );

  record(
    '6. Preview Data generated SQL targets "sales_records" with LIMIT 20',
    previewDataQuery.sql.includes('FROM "sales_records"') && previewDataQuery.sql.includes('LIMIT 20;')
  );

  // 3. Top N Rows operation on Imported Dataset
  const topNQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'top_n',
    { column: 'net_sales', limit: 10 }
  );

  record(
    '7. Top N Rows generated SQL orders by "net_sales" DESC with LIMIT 10',
    topNQuery.sql.includes('FROM "imported_dataset"') &&
    topNQuery.sql.includes('ORDER BY "net_sales" DESC') &&
    topNQuery.sql.includes('LIMIT 10;')
  );

  // 4. Bottom N Rows operation on Imported Dataset
  const bottomNQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'bottom_n',
    { column: 'net_sales', limit: 10 }
  );

  record(
    '8. Bottom N Rows generated SQL orders by "net_sales" ASC with LIMIT 10',
    bottomNQuery.sql.includes('FROM "imported_dataset"') &&
    bottomNQuery.sql.includes('ORDER BY "net_sales" ASC') &&
    bottomNQuery.sql.includes('LIMIT 10;')
  );

  // 5. Distinct Values operation on Imported Dataset
  const distinctQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'distinct',
    { column: 'product', limit: 25 }
  );

  record(
    '9. Distinct Values generated SQL includes SELECT DISTINCT and filters NULLs',
    distinctQuery.sql.includes('SELECT DISTINCT') &&
    distinctQuery.sql.includes('FROM "imported_dataset"') &&
    distinctQuery.sql.includes('"product" IS NOT NULL')
  );

  // 6. Count Rows operation on Imported Dataset
  const countRowsQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'count_rows',
    {}
  );

  record(
    '10. Count Rows generated SQL produces SELECT COUNT(*) AS total_rows',
    countRowsQuery.sql.includes('SELECT COUNT(*) AS total_rows') &&
    countRowsQuery.sql.includes('FROM "imported_dataset";')
  );

  // 7. Count Distinct operation on Imported Dataset
  const countDistinctQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'count_distinct',
    { column: 'product' }
  );

  record(
    '11. Count Distinct generated SQL produces SELECT COUNT(DISTINCT "product")',
    countDistinctQuery.sql.includes('COUNT(DISTINCT "product") AS distinct_count') &&
    countDistinctQuery.sql.includes('FROM "imported_dataset";')
  );

  // 8. Sort Ascending and Sort Descending
  const sortAscQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'sort_asc',
    { column: 'unit_price', limit: 50 }
  );

  record(
    '12. Sort Ascending generated SQL sorts by "unit_price" ASC',
    sortAscQuery.sql.includes('ORDER BY "unit_price" ASC')
  );

  const sortDescQuery = sqliteGenerator.generateBasic(
    'imported',
    'imported_dataset',
    'sort_desc',
    { column: 'unit_price', limit: 50 }
  );

  record(
    '13. Sort Descending generated SQL sorts by "unit_price" DESC',
    sortDescQuery.sql.includes('ORDER BY "unit_price" DESC')
  );

  // 9. Dialect Independence & Preservation of Connected Database Qualification
  const pgGen = new AnalysisSqlGenerator(
    new PostgreSQLAdapter({ type: 'postgresql', host: 'localhost', database: 'datapilot_demo', username: 'postgres' }).getDialect()
  );
  const pgQuery = pgGen.generateBasic('analytics_practice', 'orders', 'select_columns', {
    columns: ['id', 'total'],
    limit: 20
  });

  record(
    '14. PostgreSQL preserves schema qualification for real database ("analytics_practice"."orders")',
    pgQuery.sql.includes('FROM "analytics_practice"."orders"')
  );

  // When schema is 'imported', even with PostgreSQL dialect, it must not output "imported"."dataset"
  const pgImportedQuery = pgGen.generateBasic('imported', 'uploaded_csv', 'preview', { limit: 10 });
  record(
    '15. AnalysisSqlGenerator does not qualify "imported" schema on external dialects',
    pgImportedQuery.sql.includes('FROM "uploaded_csv"') && !pgImportedQuery.sql.includes('"imported"."uploaded_csv"')
  );

  // 10. Check UI Components and Accessibility
  const basicOpsSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Analysis/builders/BasicOperationsBuilder.tsx'), 'utf-8');
  record(
    '16. BasicOperationsBuilder contains id="btn-preview-generated-sql"',
    basicOpsSource.includes('id="btn-preview-generated-sql"')
  );

  record(
    '17. BasicOperationsBuilder contains dynamic loading spinner and "Generating SQL..." state',
    basicOpsSource.includes('Generating SQL...') && basicOpsSource.includes('isGenerating')
  );

  record(
    '18. BasicOperationsBuilder has inline error alert display with role="alert"',
    basicOpsSource.includes('id="basic-ops-generate-error"') && basicOpsSource.includes('role="alert"')
  );

  record(
    '19. BasicOperationsBuilder has useEffect to sync column selections when table changes',
    basicOpsSource.includes('setSelectedColumns([])') && basicOpsSource.includes('table.schema, table.name')
  );

  record(
    '20. BasicOperationsBuilder disables button and renders helper text when select_columns has 0 columns',
    basicOpsSource.includes('Select at least 1 column to preview SQL') && basicOpsSource.includes('isButtonDisabled')
  );

  // 11. Check SqlPreviewModal component
  const sqlPreviewSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Analysis/SqlPreviewModal.tsx'), 'utf-8');
  record(
    '21. SqlPreviewModal implements role="dialog" and aria-modal="true"',
    sqlPreviewSource.includes('role="dialog"') && sqlPreviewSource.includes('aria-modal="true"')
  );

  record(
    '22. SqlPreviewModal provides Copy SQL action',
    sqlPreviewSource.includes('id="btn-copy-generated-sql"') && sqlPreviewSource.includes('Copy SQL')
  );

  record(
    '23. SqlPreviewModal provides Open in SQL Editor action',
    sqlPreviewSource.includes('id="btn-edit-in-sql-editor"') && sqlPreviewSource.includes('Open in SQL Editor')
  );

  record(
    '24. SqlPreviewModal provides Execute / Preview Results action',
    sqlPreviewSource.includes('id="btn-execute-analysis-query"') && sqlPreviewSource.includes('Execute / Preview Results')
  );

  record(
    '25. SqlPreviewModal provides Close action and Escape key dismissal',
    sqlPreviewSource.includes('id="btn-cancel-sql-preview"') &&
    sqlPreviewSource.includes('Close') &&
    sqlPreviewSource.includes("e.key === 'Escape'")
  );

  record(
    '26. SqlPreviewModal closes on backdrop overlay click',
    sqlPreviewSource.includes('e.target === e.currentTarget') && sqlPreviewSource.includes('onClose()')
  );

  record(
    '27. SqlPreviewModal subtitle clearly displays Operation and Schema-qualified table context',
    sqlPreviewSource.includes('subtitleContext') &&
    sqlPreviewSource.includes('OPERATION') &&
    sqlPreviewSource.includes('analytics_practice.products')
  );

  record(
    '28. SqlPreviewModal shows Tables Referenced with prominent count badge',
    sqlPreviewSource.includes('Tables Referenced') &&
    sqlPreviewSource.includes('query.tablesUsed.length')
  );

  record(
    '29. SqlPreviewModal shows Columns Utilized with column count and chips',
    sqlPreviewSource.includes('Columns Utilized') &&
    sqlPreviewSource.includes('query.columnsUsed.length')
  );

  record(
    '30. SqlPreviewModal includes PostgreSQL / Read Only / Validated status badges',
    sqlPreviewSource.includes('Read Only') &&
    sqlPreviewSource.includes('Validated') &&
    sqlPreviewSource.includes('dbName')
  );

  record(
    '31. SqlPreviewModal includes compact security banner with ShieldCheck icon',
    sqlPreviewSource.includes('ShieldCheck') &&
    sqlPreviewSource.includes('Validated against') &&
    sqlPreviewSource.includes('read-only safety rules')
  );

  record(
    '32. SqlPreviewModal shows loading state "Executing Query..." with spinner on execution',
    sqlPreviewSource.includes('Executing Query...') &&
    sqlPreviewSource.includes('Loader2') &&
    sqlPreviewSource.includes('disabled={isWorking}')
  );

  record(
    '33. SqlPreviewModal renders scrollable table preview on successful execution',
    sqlPreviewSource.includes('executionResult') &&
    sqlPreviewSource.includes('rows returned') &&
    sqlPreviewSource.includes('Execution time:') &&
    sqlPreviewSource.includes('<table')
  );

  record(
    '34. SqlPreviewModal displays clean DataPilot error state without window.alert on execution failure',
    sqlPreviewSource.includes('executionError') &&
    sqlPreviewSource.includes('AlertTriangle') &&
    !sqlPreviewSource.includes('window.alert') &&
    !sqlPreviewSource.includes('alert(')
  );

  return results;
}
