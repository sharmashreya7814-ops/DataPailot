import { TableColumnInfo } from '../src/types/database';
import { SmartFieldMapper, AnalysisCompatibility, classifyColumns } from '../src/utils/analysisCompatibility';
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

export async function runAnalysisSmartFieldMappingTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  function col(name: string, dataType: string, isNullable = false, isPrimaryKey = false, isForeignKey = false): TableColumnInfo {
    return { name, dataType, isNullable, isPrimaryKey, isForeignKey };
  }

  // -------------------------------------------------------------
  // Test Dataset 1: The user reported Excel imported dataset
  // -------------------------------------------------------------
  const excelColumns: TableColumnInfo[] = [
    col('order_id', 'INTEGER', false, true, false),
    col('order_date', 'TEXT', false, false, false),
    col('city', 'TEXT', true, false, false),
    col('category', 'TEXT', true, false, false),
    col('product', 'TEXT', false, false, false),
    col('quantity', 'INTEGER', false, false, false),
    col('unit_price', 'REAL', false, false, false),
    col('net_sales', 'REAL', false, false, false)
  ];

  // ========================================================
  // 1. SALES ANALYSIS: net_sales PREFERRED OVER order_id
  // ========================================================
  const salesCompat = AnalysisCompatibility.checkSalesAnalysis(excelColumns);
  record(
    '1. Sales Analysis automatically suggests net_sales for revenueColumn (NOT order_id)',
    salesCompat.suggestions.revenueColumn === 'net_sales'
  );

  const suggestedMonetary = SmartFieldMapper.suggestColumn(excelColumns, 'monetary');
  record(
    '2. SmartFieldMapper monetary role resolves to net_sales',
    suggestedMonetary === 'net_sales'
  );

  const monetaryScoreNetSales = SmartFieldMapper.scoreColumn(excelColumns[7], 'monetary');
  const monetaryScoreOrderId = SmartFieldMapper.scoreColumn(excelColumns[0], 'monetary');
  record(
    '3. net_sales monetary score is significantly higher than order_id score',
    monetaryScoreNetSales > 100 && monetaryScoreOrderId < -100
  );

  // ========================================================
  // 2. CUSTOMER ANALYSIS: net_sales PREFERRED OVER order_id
  // ========================================================
  const custCompat = AnalysisCompatibility.checkCustomerAnalysis(excelColumns);
  record(
    '4. Customer Analysis automatically suggests net_sales for amountColumn (NOT order_id)',
    custCompat.suggestions.amountColumn === 'net_sales'
  );

  record(
    '5. Customer Analysis uses order_date for dateColumn',
    custCompat.suggestions.dateColumn === 'order_date'
  );

  record(
    '6. Customer Analysis safely falls back to order_id when customer_id is absent',
    custCompat.suggestions.customerId === 'order_id'
  );

  // ========================================================
  // 3. PRODUCT ANALYSIS: product PREFERRED OVER city
  // ========================================================
  const prodCompat = AnalysisCompatibility.checkProductAnalysis(excelColumns);
  record(
    '7. Product Analysis automatically suggests product for productColumn (NOT city)',
    prodCompat.suggestions.productColumn === 'product'
  );

  record(
    '8. Product Analysis automatically suggests net_sales for measureColumn (NOT order_id)',
    prodCompat.suggestions.measureColumn === 'net_sales'
  );

  const prodScoreProduct = SmartFieldMapper.scoreColumn(excelColumns[4], 'product');
  const prodScoreCity = SmartFieldMapper.scoreColumn(excelColumns[2], 'product');
  record(
    '9. product score is positive and city receives heavy negative penalty for product role',
    prodScoreProduct > 100 && prodScoreCity < -100
  );

  // ========================================================
  // 4. CONVERSION FUNNEL & EVENT DETECTION
  // ========================================================
  const funnelColumns: TableColumnInfo[] = [
    col('user_id', 'BIGINT', false, false, false),
    col('event_name', 'VARCHAR', false, false, false),
    col('city', 'VARCHAR', true, false, false),
    col('page_path', 'VARCHAR', true, false, false),
    col('event_time', 'TIMESTAMPTZ', false, false, false)
  ];

  const funnelCompat = AnalysisCompatibility.checkFunnelAnalysis(funnelColumns);
  record(
    '10. Funnel Analysis automatically suggests event_name for eventColumn (NOT city)',
    funnelCompat.suggestions.eventColumn === 'event_name'
  );

  record(
    '11. Funnel Analysis automatically suggests user_id for userIdColumn',
    funnelCompat.suggestions.userIdColumn === 'user_id'
  );

  const eventScoreEventName = SmartFieldMapper.scoreColumn(funnelColumns[1], 'event');
  const eventScoreCity = SmartFieldMapper.scoreColumn(funnelColumns[2], 'event');
  record(
    '12. event_name receives high score and city receives negative penalty for event role',
    eventScoreEventName > 100 && eventScoreCity < -100
  );

  // ========================================================
  // 5. CUSTOMER IDENTITY: customer_id & user_id PREFERRED OVER order_id
  // ========================================================
  const multiIdColumns: TableColumnInfo[] = [
    col('order_id', 'BIGINT', false, true, false),
    col('customer_id', 'BIGINT', false, false, true),
    col('product_id', 'BIGINT', false, false, true),
    col('total_amount', 'NUMERIC', false, false, false)
  ];

  const suggestedCustomer = SmartFieldMapper.suggestColumn(multiIdColumns, 'customer');
  record(
    '13. customer_id is preferred over order_id and product_id for customer role',
    suggestedCustomer === 'customer_id'
  );

  const userTableColumns: TableColumnInfo[] = [
    col('transaction_id', 'INTEGER', false, false, false),
    col('user_id', 'INTEGER', false, false, false),
    col('gross_sales', 'REAL', false, false, false)
  ];
  const suggestedUser = SmartFieldMapper.suggestColumn(userTableColumns, 'customer');
  record(
    '14. user_id is preferred over transaction_id for customer role',
    suggestedUser === 'user_id'
  );

  // ========================================================
  // 6. DATE COLUMNS CORRECTLY DETECTED
  // ========================================================
  const dateColumnsTable: TableColumnInfo[] = [
    col('id', 'INT', false, true, false),
    col('updated_at', 'TIMESTAMP', true, false, false),
    col('order_date', 'DATE', false, false, false),
    col('status', 'VARCHAR', true, false, false)
  ];

  const suggestedDate = SmartFieldMapper.suggestColumn(dateColumnsTable, 'date');
  record(
    '15. order_date is preferred for date role over updated_at',
    suggestedDate === 'order_date'
  );

  const dateCompat = AnalysisCompatibility.checkDateAnalysis(excelColumns);
  record(
    '16. Date Analysis suggestions select order_date and net_sales',
    dateCompat.suggestions.dateColumn === 'order_date' &&
    dateCompat.suggestions.measureColumn === 'net_sales'
  );

  // ========================================================
  // 7. CATEGORY / REGION / CITY AS DIMENSIONS
  // ========================================================
  const suggestedDim = SmartFieldMapper.suggestColumn(excelColumns, 'dimension');
  record(
    '17. category or city is suggested as dimension',
    suggestedDim === 'category' || suggestedDim === 'city'
  );

  // ========================================================
  // 8. QUANTITY / UNITS DETECTION
  // ========================================================
  const suggestedQty = SmartFieldMapper.suggestColumn(excelColumns, 'quantity');
  record(
    '18. quantity is accurately detected for quantity role',
    suggestedQty === 'quantity'
  );

  // ========================================================
  // 9. FALLBACK BEHAVIOR WHEN SEMANTIC COLUMNS ARE ABSENT
  // ========================================================
  const genericColumns: TableColumnInfo[] = [
    col('col_a', 'VARCHAR', true, false, false),
    col('col_b', 'INTEGER', true, false, false),
    col('col_c', 'REAL', true, false, false)
  ];

  const fallbackMonetary = SmartFieldMapper.suggestColumn(genericColumns, 'monetary');
  record(
    '19. Fallback for monetary chooses first available numeric column',
    fallbackMonetary === 'col_b' || fallbackMonetary === 'col_c'
  );

  const fallbackDim = SmartFieldMapper.suggestColumn(genericColumns, 'dimension');
  record(
    '20. Fallback for dimension chooses first available string column',
    fallbackDim === 'col_a'
  );

  const fallbackEmpty = SmartFieldMapper.suggestColumn([], 'monetary');
  record(
    '21. Fallback for empty column array safely returns empty string without error',
    fallbackEmpty === ''
  );

  // ========================================================
  // 10. MULTI-DATABASE DIALECTS COMPATIBILITY
  // ========================================================
  // PostgreSQL
  const pgColumns: TableColumnInfo[] = [
    col('order_id', 'bigint', false, true, false),
    col('customer_id', 'bigint', false, false, false),
    col('total_revenue', 'numeric(12,2)', false, false, false),
    col('order_timestamp', 'timestamp with time zone', false, false, false),
    col('product_sku', 'character varying(50)', false, false, false)
  ];
  record(
    '22. PostgreSQL: total_revenue selected for monetary and product_sku for product',
    SmartFieldMapper.suggestColumn(pgColumns, 'monetary') === 'total_revenue' &&
    SmartFieldMapper.suggestColumn(pgColumns, 'product') === 'product_sku'
  );

  // MySQL
  const mysqlColumns: TableColumnInfo[] = [
    col('user_id', 'int', false, false, false),
    col('lifetime_spend', 'decimal(10,2)', false, false, false),
    col('region', 'varchar(100)', true, false, false),
    col('signup_date', 'datetime', false, false, false)
  ];
  record(
    '23. MySQL: lifetime_spend selected for monetary and region for dimension',
    SmartFieldMapper.suggestColumn(mysqlColumns, 'monetary') === 'lifetime_spend' &&
    SmartFieldMapper.suggestColumn(mysqlColumns, 'dimension') === 'region'
  );

  // SQL Server
  const sqlServerColumns: TableColumnInfo[] = [
    col('TransactionID', 'int', false, false, false),
    col('AccountID', 'nvarchar(50)', false, false, false),
    col('SalesAmount', 'money', false, false, false),
    col('ItemName', 'nvarchar(255)', false, false, false)
  ];
  record(
    '24. SQL Server: SalesAmount selected for monetary, ItemName for product, AccountID for customer',
    SmartFieldMapper.suggestColumn(sqlServerColumns, 'monetary') === 'SalesAmount' &&
    SmartFieldMapper.suggestColumn(sqlServerColumns, 'product') === 'ItemName' &&
    SmartFieldMapper.suggestColumn(sqlServerColumns, 'customer') === 'AccountID'
  );

  // Oracle
  const oracleColumns: TableColumnInfo[] = [
    col('EMPLOYEE_ID', 'NUMBER(6)', false, true, false),
    col('SALARY', 'NUMBER(8,2)', false, false, false),
    col('DEPARTMENT_NAME', 'VARCHAR2(30)', true, false, false),
    col('HIRE_DATE', 'DATE', false, false, false)
  ];
  record(
    '25. Oracle: SALARY selected for monetary, DEPARTMENT_NAME for dimension, HIRE_DATE for date',
    SmartFieldMapper.suggestColumn(oracleColumns, 'monetary') === 'SALARY' &&
    SmartFieldMapper.suggestColumn(oracleColumns, 'dimension') === 'DEPARTMENT_NAME' &&
    SmartFieldMapper.suggestColumn(oracleColumns, 'date') === 'HIRE_DATE'
  );

  // ========================================================
  // 11. GENERATED SQL WITH SMART MAPPING PRODUCES CLEAN SQL
  // ========================================================
  const sqliteDialect = {
    quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
    formatLimit: (sql: string, limit: number) => `${sql}\nLIMIT ${limit}`,
    formatPagination: (sql: string, limit: number, offset: number) => `${sql} LIMIT ${limit} OFFSET ${offset}`,
    formatDate: (date: Date) => `'${date.toISOString()}'`,
    formatExplain: (sql: string) => `EXPLAIN QUERY PLAN ${sql}`,
    qualifyTable: (_schema: string | undefined, table: string) => `"${table.replace(/"/g, '""')}"`,
    dialectType: 'sqlite' as const
  };

  const generator = new AnalysisSqlGenerator(sqliteDialect);
  const salesQuery = generator.generateSalesTemplate(
    'imported',
    'datapilot_analytics_test_dataset',
    'total_sales',
    {
      revenueColumn: salesCompat.suggestions.revenueColumn
    }
  );

  record(
    '26. Generated Sales SQL uses net_sales without placeholders',
    salesQuery.sql.includes('SUM("net_sales")') &&
    !salesQuery.sql.includes('order_id') &&
    !salesQuery.sql.includes('revCol')
  );

  const prodQuery = generator.generateProductTemplate(
    'imported',
    'datapilot_analytics_test_dataset',
    'top_products',
    {
      productColumn: prodCompat.suggestions.productColumn,
      measureColumn: prodCompat.suggestions.measureColumn
    }
  );

  record(
    '27. Generated Product SQL groups by "product" and sums "net_sales"',
    prodQuery.sql.includes('"product"') &&
    prodQuery.sql.includes('SUM("net_sales")') &&
    !prodQuery.sql.includes('"city"')
  );

  return results;
}
