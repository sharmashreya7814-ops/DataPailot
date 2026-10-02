import * as XLSX from 'xlsx';
import { ExcelExportService } from '../src/services/excelExportService';
import { ExcelWorkbookSession } from '../src/services/excelWorkbookSession';
import { QueryResultColumn } from '../src/types/database';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAnalysisExcelExportWorkflowTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  function record(name: string, condition: boolean, error?: string) {
    results.push({
      name,
      passed: condition,
      error: condition ? undefined : (error || 'Assertion failed')
    });
  }

  // Sample data fixtures
  const salesColumns: QueryResultColumn[] = [
    { name: 'order_id', dataType: 'integer' },
    { name: 'city', dataType: 'text' },
    { name: 'quantity', dataType: 'integer' },
    { name: 'unit_price', dataType: 'numeric' },
    { name: 'net_sales', dataType: 'numeric' }
  ];

  const salesRows: Record<string, unknown>[] = [
    { order_id: 1, city: 'Surat', quantity: 5, unit_price: 20.0, net_sales: 100.0 },
    { order_id: 2, city: 'Mumbai', quantity: 2, unit_price: 150.0, net_sales: 300.0 },
    { order_id: 3, city: 'Ahmedabad', quantity: 10, unit_price: 15.5, net_sales: 155.0 }
  ];

  const genderColumns: QueryResultColumn[] = [
    { name: 'gender', dataType: 'text' },
    { name: 'customer_count', dataType: 'integer' },
    { name: 'total_spend', dataType: 'numeric' }
  ];

  const genderRows: Record<string, unknown>[] = [
    { gender: 'Female', customer_count: 3, total_spend: 2248.97 },
    { gender: 'Male', customer_count: 2, total_spend: 599.49 },
    { gender: 'Other', customer_count: 2, total_spend: 988.97 }
  ];

  const monthlyColumns: QueryResultColumn[] = [
    { name: 'month', dataType: 'text' },
    { name: 'revenue', dataType: 'numeric' },
    { name: 'order_count', dataType: 'integer' }
  ];

  const monthlyRows: Record<string, unknown>[] = [
    { month: '2025-01', revenue: 4500.5, order_count: 14 },
    { month: '2025-02', revenue: 6200.0, order_count: 19 }
  ];

  const cityColumns: QueryResultColumn[] = [
    { name: 'city', dataType: 'text' },
    { name: 'total_orders', dataType: 'integer' },
    { name: 'total_revenue', dataType: 'numeric' }
  ];

  const cityRows: Record<string, unknown>[] = [
    { city: 'Surat', total_orders: 8, total_revenue: 1600.0 },
    { city: 'Mumbai', total_orders: 12, total_revenue: 3400.0 }
  ];

  const productColumns: QueryResultColumn[] = [
    { name: 'product', dataType: 'text' },
    { name: 'units_sold', dataType: 'integer' },
    { name: 'gross_profit', dataType: 'numeric' }
  ];

  const productRows: Record<string, unknown>[] = [
    { product: 'UltraBook Pro', units_sold: 4, gross_profit: 2400.0 },
    { product: 'Wireless Headphones', units_sold: 15, gross_profit: 1500.0 }
  ];

  // ========================================================
  // 1. OPTION 1: NORMAL EXCEL DOWNLOAD STILL WORKS
  // ========================================================
  const singleResult = ExcelExportService.exportQueryResultToExcel(salesColumns, salesRows, {
    filename: 'sales_export.xlsx',
    sheetName: 'Sales'
  });

  record(
    '1. Option 1 standalone Excel download produces valid buffer',
    singleResult.buffer instanceof Uint8Array && singleResult.buffer.byteLength > 0
  );

  record(
    '2. Option 1 standalone Excel export retains correct filename and counts',
    singleResult.filename === 'sales_export.xlsx' &&
    singleResult.rowCount === 3 &&
    singleResult.columnCount === 5
  );

  const parsedSingleWb = XLSX.read(singleResult.buffer, { type: 'buffer' });
  record(
    '3. Standalone Excel export contains single sheet named "Sales"',
    parsedSingleWb.SheetNames.length === 1 && parsedSingleWb.SheetNames[0] === 'Sales'
  );

  // ========================================================
  // 2. OPTION 2: FIRST RESULT CREATES WORKBOOK IN SESSION
  // ========================================================
  const session = ExcelWorkbookSession.getInstance();
  session.clearSession();

  record(
    '4. New export session initializes with zero sheets',
    session.getSheets().length === 0
  );

  const firstAdd = session.addSheet('Sales', salesColumns, salesRows);

  record(
    '5. Adding first result creates worksheet successfully',
    firstAdd.success === true && firstAdd.sheetName === 'Sales'
  );

  record(
    '6. Session holds exactly 1 worksheet after first addition',
    session.getSheets().length === 1 && session.getSheetNames()[0] === 'Sales'
  );

  // ========================================================
  // 3. SUBSEQUENT RESULTS ARE ADDED AS SEPARATE SHEETS
  // ========================================================
  const secondAdd = session.addSheet('Gender Analysis', genderColumns, genderRows);

  record(
    '7. Second result is added as a separate worksheet without replacing first',
    secondAdd.success === true && secondAdd.sheetName === 'Gender Analysis'
  );

  record(
    '8. Session holds both sheets in order: ["Sales", "Gender Analysis"]',
    session.getSheets().length === 2 &&
    JSON.stringify(session.getSheetNames()) === JSON.stringify(['Sales', 'Gender Analysis'])
  );

  // ========================================================
  // 4. ORIGINAL / SOURCE SHEET REMAINS UNCHANGED (IMMUTABILITY)
  // ========================================================
  const storedSalesSheet = session.getSheets()[0];

  record(
    '9. Original source sheet name remains "Sales"',
    storedSalesSheet.sheetName === 'Sales'
  );

  record(
    '10. Original source sheet row count remains 3 rows',
    storedSalesSheet.rowCount === 3 && storedSalesSheet.rows.length === 3
  );

  record(
    '11. Original source sheet column count remains 5 columns',
    storedSalesSheet.columnCount === 5 && storedSalesSheet.columns.length === 5
  );

  record(
    '12. Original source sheet row values remain untouched',
    storedSalesSheet.rows[0].order_id === 1 && storedSalesSheet.rows[0].city === 'Surat'
  );

  // ========================================================
  // 5. CUSTOM SHEET NAMES WORK
  // ========================================================
  const customAdd = session.addSheet('Revenue by Month', monthlyColumns, monthlyRows);

  record(
    '13. Custom sheet name "Revenue by Month" is accepted and registered',
    customAdd.success === true && session.hasSheet('Revenue by Month')
  );

  // ========================================================
  // 6. DUPLICATE SHEET NAMES ARE HANDLED SAFELY
  // ========================================================
  const duplicateAdd = session.addSheet('Gender Analysis', genderColumns, genderRows);

  record(
    '14. Attempting to add duplicate sheet name fails safely',
    duplicateAdd.success === false && duplicateAdd.error !== undefined
  );

  record(
    '15. Duplicate error message warns user that sheet already exists',
    Boolean(duplicateAdd.error && duplicateAdd.error.includes('already exists'))
  );

  const safeSuggestion = session.getUniqueSheetName('Gender Analysis');
  record(
    '16. getUniqueSheetName suggests "Gender Analysis (2)" when "Gender Analysis" exists',
    safeSuggestion === 'Gender Analysis (2)'
  );

  // Case-insensitive check
  record(
    '17. hasSheet performs case-insensitive duplicate check for "gender analysis"',
    session.hasSheet('gender analysis') === true
  );

  // Adding the suggested safe name succeeds
  const safeAdd = session.addSheet(safeSuggestion, genderColumns, genderRows);
  record(
    '18. Adding suggested safe name "Gender Analysis (2)" succeeds',
    safeAdd.success === true && session.hasSheet('Gender Analysis (2)')
  );

  // Next suggestion increments to (3)
  const safeSuggestion3 = session.getUniqueSheetName('Gender Analysis');
  record(
    '19. Next duplicate suggestion safely increments to "Gender Analysis (3)"',
    safeSuggestion3 === 'Gender Analysis (3)'
  );

  // Clean up test sheet (2) before building the example workbook
  session.removeSheet('Gender Analysis (2)');

  // ========================================================
  // 7. MULTIPLE RESULTS: BUILD COMPLETE EXAMPLE WORKBOOK
  // ========================================================
  // Example workbook required in prompt:
  // DataPilot_Analysis.xlsx
  //   - Sales
  //   - Gender Analysis
  //   - Revenue by Month
  //   - City Analysis
  //   - Product Analysis

  session.addSheet('City Analysis', cityColumns, cityRows);
  session.addSheet('Product Analysis', productColumns, productRows);

  const expectedWorkbookSheets = [
    'Sales',
    'Gender Analysis',
    'Revenue by Month',
    'City Analysis',
    'Product Analysis'
  ];

  record(
    '20. Example workbook contains all 5 required worksheets in sequence',
    JSON.stringify(session.getSheetNames()) === JSON.stringify(expectedWorkbookSheets)
  );

  // ========================================================
  // 8. FINAL WORKBOOK DOWNLOADS CORRECTLY
  // ========================================================
  const multiBuffer = session.downloadWorkbook('DataPilot_Analysis.xlsx');

  record(
    '21. downloadWorkbook returns valid binary buffer',
    multiBuffer instanceof Uint8Array && multiBuffer.byteLength > 0
  );

  const parsedMultiWb = XLSX.read(multiBuffer, { type: 'buffer' });

  record(
    '22. Downloaded Excel workbook contains exactly 5 worksheets',
    parsedMultiWb.SheetNames.length === 5
  );

  record(
    '23. Worksheets in downloaded file match expected names in exact order',
    JSON.stringify(parsedMultiWb.SheetNames) === JSON.stringify(expectedWorkbookSheets)
  );

  // ========================================================
  // 9. RESULT DATA & TYPES REMAIN ACCURATE ACROSS SHEETS
  // ========================================================
  const salesSheetData = XLSX.utils.sheet_to_json(parsedMultiWb.Sheets['Sales']) as any[];
  record(
    '24. Sales sheet in final workbook has 3 data rows',
    salesSheetData.length === 3
  );

  record(
    '25. Sales sheet row 1 preserves net_sales = 100.0 and city = "Surat"',
    salesSheetData[0].net_sales === 100 && salesSheetData[0].city === 'Surat'
  );

  const genderSheetData = XLSX.utils.sheet_to_json(parsedMultiWb.Sheets['Gender Analysis']) as any[];
  record(
    '26. Gender Analysis sheet preserves Female row spend (2248.97) and count (3)',
    genderSheetData[0].gender === 'Female' &&
    genderSheetData[0].customer_count === 3 &&
    genderSheetData[0].total_spend === 2248.97
  );

  const productSheetData = XLSX.utils.sheet_to_json(parsedMultiWb.Sheets['Product Analysis']) as any[];
  record(
    '27. Product Analysis sheet preserves gross_profit = 2400.0',
    productSheetData[0].product === 'UltraBook Pro' && productSheetData[0].gross_profit === 2400
  );

  // ========================================================
  // 10. SENSIBLE WORKSHEET NAME SUGGESTIONS
  // ========================================================
  const genderSqlSug = ExcelExportService.suggestSheetName({
    sql: 'SELECT gender, count(*) FROM customers GROUP BY gender'
  });
  record(
    '28. suggestSheetName infers "Gender Analysis" from GROUP BY gender SQL',
    genderSqlSug === 'Gender Analysis'
  );

  const monthSqlSug = ExcelExportService.suggestSheetName({
    sql: 'SELECT date_trunc(\'month\', order_date), sum(revenue) FROM orders GROUP BY month'
  });
  record(
    '29. suggestSheetName infers "Revenue by Month" from monthly SQL',
    monthSqlSug === 'Revenue by Month'
  );

  const citySqlSug = ExcelExportService.suggestSheetName({
    sql: 'SELECT * FROM orders WHERE city = \'Surat\''
  });
  record(
    '30. suggestSheetName infers "City Analysis" from WHERE city SQL',
    citySqlSug === 'City Analysis'
  );

  const salesSourceSug = ExcelExportService.suggestSheetName({
    sourceName: 'sales_records'
  });
  record(
    '31. suggestSheetName infers "Sales" from sales_records sourceName',
    salesSourceSug === 'Sales'
  );

  const explicitNameSug = ExcelExportService.suggestSheetName({
    analysisName: 'Calculated Column (Profit)'
  });
  record(
    '32. suggestSheetName infers "Profit Analysis" from analysis metadata',
    explicitNameSug === 'Profit Analysis'
  );

  // ========================================================
  // 11. SHEET NAME SANITIZATION (EXCEL RULES)
  // ========================================================
  const dirtySheetName = 'Sales:2024*Q1/[Draft]?';
  const cleanSheetName = ExcelExportService.sanitizeSheetName(dirtySheetName);

  record(
    '33. sanitizeSheetName removes forbidden chars : * / ? [ ]',
    !/[:*\/?[\]]/.test(cleanSheetName)
  );

  const longSheetName = 'This is a very long worksheet title that exceeds the Excel thirty-one character limit';
  const cappedSheetName = ExcelExportService.sanitizeSheetName(longSheetName);

  record(
    '34. sanitizeSheetName caps length at maximum 31 characters',
    cappedSheetName.length <= 31
  );

  // ========================================================
  // 12. FORMULA INJECTION PROTECTION IN MULTI-SHEET WORKBOOKS
  // ========================================================
  const attackCols: QueryResultColumn[] = [{ name: 'payload', dataType: 'text' }];
  const attackRows = [
    { payload: '=cmd|"/C calc"!A0' },
    { payload: '+123456789' },
    { payload: '@HYPERLINK("http://evil.com")' }
  ];

  const attackBuffer = ExcelExportService.exportMultiSheetExcel([
    { sheetName: 'Security', columns: attackCols, rows: attackRows }
  ]);
  const parsedAttack = XLSX.read(attackBuffer.buffer, { type: 'buffer' });
  const rawAttackRows = XLSX.utils.sheet_to_json(parsedAttack.Sheets['Security']) as any[];

  record(
    '35. Formula injection payloads are safely quoted in multi-sheet export',
    String(rawAttackRows[0].payload).startsWith('\'=cmd') &&
    String(rawAttackRows[1].payload).startsWith('\'+123') &&
    String(rawAttackRows[2].payload).startsWith('\'@HYPERLINK')
  );

  return results;
}
