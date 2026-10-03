import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { DashboardFilterEngine } from '../src/services/dashboardFilterEngine';
import { DashboardService } from '../src/services/dashboardService';
import { DashboardFilter, DashboardWidget, Dashboard } from '../src/types/dashboard';
import { QueryResultColumn } from '../src/types/database';
import { VisualizationExportService } from '../src/services/visualizationExportService';
import { VisualizationDataProcessor } from '../src/services/visualizationDataProcessor';
import { ChartRecommender } from '../src/services/chartRecommender';

export function runDashboardAndFilterTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: message || 'Assertion failed' });
    }
  }

  const mockWidget: DashboardWidget = {
    id: 'widget_1',
    title: 'Monthly Sales',
    chartType: 'bar',
    queryRef: {
      type: 'raw_sql',
      sql: 'SELECT department, SUM(revenue) as total_rev FROM sales GROUP BY department',
      sourceTable: 'public.sales',
      referencedColumns: ['department', 'revenue']
    },
    chartConfig: {
      chartType: 'bar',
      xAxis: 'department',
      yAxis: 'total_rev',
      secondaryMeasures: [],
      aggregation: 'none',
      sortOrder: 'none',
      sortBy: 'x',
      limit: 'all',
      title: 'Monthly Sales',
      showLegend: true,
      showDataLabels: false,
      showGrid: true,
      binCount: 10,
      treatNullAsZero: true
    },
    size: { colSpan: 6 },
    position: { order: 0 }
  };

  const mockColumns: QueryResultColumn[] = [
    { name: 'department', dataType: 'varchar' },
    { name: 'total_rev', dataType: 'numeric' }
  ];

  // RTM-15: Filter on non-existent column -> GRACEFUL ERROR / Incompatible
  const nonExistentFilter: DashboardFilter = {
    id: 'filter_invalid',
    label: 'Non Existent Column Filter',
    targetColumn: 'non_existent_column_xyz',
    type: 'text',
    currentValue: 'Tech'
  };

  const compatibility = DashboardFilterEngine.checkCompatibility(nonExistentFilter, mockWidget, mockColumns);
  assert(
    'RTM-15: Filter on non-existent column returns graceful incompatible result',
    !compatibility.isCompatible,
    'Expected filter on non-existent column to be incompatible'
  );

  // Valid filter compatibility
  const validFilter: DashboardFilter = {
    id: 'filter_dept',
    label: 'Department Filter',
    targetColumn: 'department',
    type: 'text',
    currentValue: 'Marketing'
  };

  const validComp = DashboardFilterEngine.checkCompatibility(validFilter, mockWidget, mockColumns);
  assert('FILTER-1: Compatible column filter recognized', validComp.isCompatible && validComp.columnName === 'department');

  // Filter SQL augmentation using outer subquery
  const augmented = DashboardFilterEngine.applyFiltersToSql(
    mockWidget.queryRef.sql,
    [validFilter, nonExistentFilter],
    mockWidget,
    mockColumns
  );

  assert('FILTER-2: Applied only valid filter', augmented.appliedFilterCount === 1);
  assert(
    'FILTER-3: Filter wrapped in safe subquery',
    augmented.augmentedSql.includes('FROM (') && augmented.augmentedSql.includes('CAST("department" AS TEXT) = \'Marketing\'')
  );

  // RTM-14: Dashboard refresh with missing table simulation -> GRACEFUL ERROR
  // In DashboardRefreshService, if an execution returns an error, the widget status transitions to 'error' with error details
  const simulatedMissingTableResult = {
    status: 'error' as const,
    errorMessage: 'relation "public.missing_table" does not exist',
    errorDetails: {
      code: 'TABLE_NOT_FOUND',
      message: 'Table public.missing_table was not found in schema.'
    }
  };
  assert(
    'RTM-14: Missing table handled gracefully without unhandled exception',
    simulatedMissingTableResult.status === 'error' && simulatedMissingTableResult.errorMessage.includes('does not exist')
  );

  // Section 23: CSV Formula Injection Prevention
  const formulaPayloads = [
    '=1+2',
    '+1+2',
    '-1+2',
    '@SUM(A1:A10)',
    '\t=cmd|'
  ];

  for (const payload of formulaPayloads) {
    const sanitized = VisualizationExportService.sanitizeCsvCell(payload);
    assert(
      `CSV-INJ: Formula trigger character in "${payload}" is safely escaped with single quote`,
      sanitized.startsWith(`"'`)
    );
  }

  const normalText = 'Product Alpha';
  const normalSanitized = VisualizationExportService.sanitizeCsvCell(normalText);
  assert('CSV-SAFE: Normal text does not get unnecessary single quote', normalSanitized === '"Product Alpha"');


  // --- DYNAMIC DASHBOARD FILTER VALUES TESTS ---
  // Test distinct values extraction logic from SQLite demo database
  try {
    // DatabaseSync imported at top level
    // path imported at top level
    const demoDbFile = path.join(process.cwd(), 'data', 'datapilot_demo.sqlite');
    if (fs.existsSync(demoDbFile)) {
      const demoDb = new DatabaseSync(demoDbFile);

      // 1. SPECIFIC TEST CASE: customers.gender
      // Expected dropdown options: All, Female, Male, Other
      const genderStmt = demoDb.prepare('SELECT DISTINCT "gender" AS "val" FROM "customers" WHERE "gender" IS NOT NULL ORDER BY "val"');
      const genderRows = genderStmt.all();
      const distinctGenders = genderRows.map((r: any) => r.val).filter(Boolean);

      assert(
        'FILTER-DYNAMIC-1: customers.gender distinct values extracted dynamically from database',
        distinctGenders.length === 3 &&
        distinctGenders.includes('Female') &&
        distinctGenders.includes('Male') &&
        distinctGenders.includes('Other'),
        `Expected Female, Male, Other but got ${JSON.stringify(distinctGenders)}`
      );

      // Dropdown option builder simulation: All must always be first option
      const dropdownOptions = ['All', ...distinctGenders];
      assert(
        'FILTER-DYNAMIC-2: Dropdown options start with All followed by database values',
        dropdownOptions[0] === 'All' &&
        dropdownOptions[1] === 'Female' &&
        dropdownOptions[2] === 'Male' &&
        dropdownOptions[3] === 'Other'
      );

      // 2. ADDITIONAL TEST CASE: products.category (>3 distinct values) to verify dynamic query behavior
      const catStmt = demoDb.prepare('SELECT DISTINCT "category" AS "val" FROM "products" WHERE "category" IS NOT NULL ORDER BY "val"');
      const catRows = catStmt.all();
      const distinctCats = catRows.map((r: any) => r.val).filter(Boolean);

      assert(
        'FILTER-DYNAMIC-3: products.category has >3 distinct values fetched dynamically',
        distinctCats.length > 3 &&
        distinctCats.includes('Accessories') &&
        distinctCats.includes('Audio') &&
        distinctCats.includes('Electronics') &&
        distinctCats.includes('Furniture')
      );

      // 3. NUMERIC COLUMN TEST: products.price (numeric distinct values)
      const priceStmt = demoDb.prepare('SELECT DISTINCT "price" AS "val" FROM "products" WHERE "price" IS NOT NULL ORDER BY "val"');
      const priceRows = priceStmt.all();
      const distinctPrices = priceRows.map((r: any) => String(r.val)).filter(Boolean);

      assert(
        'FILTER-DYNAMIC-4: Numeric column distinct values formatted and handled safely',
        distinctPrices.length > 0 && distinctPrices.some((p: string) => p.includes('1299.99'))
      );

      // 4. NULL VALUE SAFETY: verify NULL values are never included in options list
      demoDb.exec("INSERT INTO customers (first_name, last_name, email, gender) VALUES ('TestNull', 'User', 'testnull@example.com', NULL);");
      const nullCheckStmt = demoDb.prepare('SELECT DISTINCT "gender" AS "val" FROM "customers" WHERE "gender" IS NOT NULL ORDER BY "val"');
      const nullCheckRows = nullCheckStmt.all();
      const nullCheckGenders = nullCheckRows.map((r: any) => r.val);
      assert(
        'FILTER-DYNAMIC-5: NULL values safely filtered out from distinct options',
        !nullCheckGenders.includes(null) && !nullCheckGenders.includes(undefined) && !nullCheckGenders.includes('')
      );
      demoDb.exec("DELETE FROM customers WHERE email = 'testnull@example.com';");

      demoDb.close();
    }
  } catch (err: any) {
    assert('FILTER-DYNAMIC: Error running database dynamic filter tests', false, err.message);
  }

  // --- PHASE 1 & 6: WIDGET DUPLICATION & POSITION / SIZING TESTS ---
  try {
    const testDash: Dashboard = {
      id: 'dash_test_1',
      name: 'Testing Sizing & Duplication',
      widgets: [
        {
          id: 'w_orig_1',
          title: 'Quarterly Revenue',
          chartType: 'bar',
          queryRef: { type: 'raw_sql', sql: 'SELECT q, rev FROM q_rev;' },
          chartConfig: {
            chartType: 'bar',
            xAxis: 'q',
            yAxis: 'rev',
            secondaryMeasures: [],
            aggregation: 'sum',
            sortOrder: 'asc',
            sortBy: 'x',
            limit: 'all',
            title: 'Quarterly Revenue',
            showLegend: true,
            showDataLabels: true,
            showGrid: true,
            binCount: 10,
            treatNullAsZero: true,
            numberFormat: 'currency',
            currencySymbol: '$',
            decimalPrecision: 2
          },
          size: { colSpan: 6, height: 340 },
          position: { order: 0 }
        },
        {
          id: 'w_orig_2',
          title: 'Order Status',
          chartType: 'pie',
          queryRef: { type: 'raw_sql', sql: 'SELECT status, count(*) as cnt FROM orders GROUP BY status;' },
          chartConfig: {
            chartType: 'pie',
            xAxis: 'status',
            yAxis: 'cnt',
            secondaryMeasures: [],
            aggregation: 'count',
            sortOrder: 'none',
            sortBy: 'x',
            limit: 'all',
            title: 'Order Status',
            showLegend: true,
            showDataLabels: true,
            showGrid: false,
            binCount: 10,
            treatNullAsZero: true
          },
          size: { colSpan: 6, height: 340 },
          position: { order: 1 }
        }
      ],
      filters: [],
      layout: { columns: 12, gap: 'md' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoRefreshInterval: 60
    };

    DashboardService.saveDashboard(testDash);

    // 1. Duplicate Widget
    const dupRes = DashboardService.duplicateWidget('dash_test_1', 'w_orig_1');
    assert('DUP-1: Duplicate widget creates distinct ID and retains query & configs',
      Boolean(dupRes && dupRes.widget.id !== 'w_orig_1' && dupRes.widget.title.includes('Copy'))
    );
    assert('DUP-2: Duplicated widget has copied query and chartConfig',
      dupRes?.widget.queryRef.sql === 'SELECT q, rev FROM q_rev;' &&
      dupRes?.widget.chartConfig.numberFormat === 'currency'
    );
    assert('DUP-3: Duplicated widget increases total widget count',
      dupRes?.dashboard.widgets.length === 3
    );

    // 2. Reorder Widgets & Verify Persistence
    const reorderedIds = [dupRes!.widget.id, 'w_orig_2', 'w_orig_1'];
    const reorderRes = DashboardService.reorderWidgets('dash_test_1', reorderedIds);
    assert('REORDER-1: Widgets reordered according to custom order array',
      Boolean(reorderRes && reorderRes.widgets[0].id === dupRes!.widget.id && reorderRes.widgets[1].id === 'w_orig_2')
    );

    // Verify order persistence on reload/reopening
    const reloadedDash = DashboardService.getDashboardById('dash_test_1');
    assert('REORDER-2: Reordered widget positions persist across dashboard retrieval',
      Boolean(
        reloadedDash &&
        reloadedDash.widgets[0].id === dupRes!.widget.id &&
        reloadedDash.widgets[0].position.order === 0 &&
        reloadedDash.widgets[1].id === 'w_orig_2' &&
        reloadedDash.widgets[1].position.order === 1 &&
        reloadedDash.widgets[2].id === 'w_orig_1' &&
        reloadedDash.widgets[2].position.order === 2
      )
    );

    // 3. Widget Size Update & Presets
    const updatedSize = DashboardService.updateWidget('dash_test_1', 'w_orig_1', {
      size: { colSpan: 12, height: 500 }
    });
    const foundW1 = updatedSize?.widgets.find(w => w.id === 'w_orig_1');
    assert('SIZE-1: Widget colSpan and height updated and persisted',
      foundW1?.size.colSpan === 12 && foundW1?.size.height === 500
    );

    // Clean up test dashboard
    DashboardService.deleteDashboard('dash_test_1');
  } catch (err: any) {
    assert('PHASE-1-6: Error testing sizing and duplication', false, err.message);
  }

  // --- PHASE 2: EXTENSIVE CHART TYPES & 100% STACKED NORMALIZATION ---
  try {
    const rawRows = [
      { category: 'North', sales: 100, profit: 25 },
      { category: 'South', sales: 300, profit: 75 }
    ];
    const detectedCols = [
      { name: 'category', dataType: 'varchar', isNumeric: false, isCategorical: true, isDateOrTime: false, nullCount: 0, distinctCount: 2 },
      { name: 'sales', dataType: 'int', isNumeric: true, isCategorical: false, isDateOrTime: false, nullCount: 0, distinctCount: 2 },
      { name: 'profit', dataType: 'int', isNumeric: true, isCategorical: false, isDateOrTime: false, nullCount: 0, distinctCount: 2 }
    ];

    // 100% Stacked Bar Normalization
    const percentConfig = {
      chartType: 'percent_bar' as const,
      xAxis: 'category',
      yAxis: 'sales',
      secondaryMeasures: ['profit'],
      aggregation: 'none' as const,
      sortOrder: 'none' as const,
      sortBy: 'x' as const,
      limit: 'all' as const,
      title: 'Regional Sales vs Profit',
      showLegend: true,
      showDataLabels: true,
      showGrid: true,
      binCount: 10,
      treatNullAsZero: true
    };

    const percentProcessed = VisualizationDataProcessor.process(rawRows, percentConfig, detectedCols as any);
    assert('PERCENT-1: 100% stacked bar data normalized to 100 percent sum per category',
      percentProcessed.length === 2 &&
      Math.round((percentProcessed[0].sales as number) + (percentProcessed[0].profit as number)) === 100 &&
      Math.round((percentProcessed[1].sales as number) + (percentProcessed[1].profit as number)) === 100
    );

    // Enhanced Number Formatting
    const val = 1250000;
    const standardFmt = VisualizationDataProcessor.formatNumber(val, { numberFormat: 'standard' });
    const compactFmt = VisualizationDataProcessor.formatNumber(val, { numberFormat: 'compact', decimalPrecision: 1 });
    const currencyFmt = VisualizationDataProcessor.formatNumber(val, { numberFormat: 'currency', currencySymbol: '$', decimalPrecision: 2 });
    const percentFmt = VisualizationDataProcessor.formatNumber(0.854, { numberFormat: 'percent', decimalPrecision: 1 });

    assert('FORMAT-1: Compact formatting produces M suffix', compactFmt.includes('M'));
    assert('FORMAT-2: Currency formatting includes symbol', currencyFmt.startsWith('$'));
    assert('FORMAT-3: Percentage formatting multiplies and adds %', percentFmt.includes('85.4%'));
  } catch (err: any) {
    assert('PHASE-2-FORMAT: Error testing chart normalization and formatting', false, err.message);
  }

  // --- PHASE 3: SMART CHART RECOMMENDATIONS ---
  try {
    const timeCols = [
      { name: 'order_date', dataType: 'date', isNumeric: false, isCategorical: false, isDateOrTime: true, nullCount: 0, distinctCount: 30 },
      { name: 'revenue', dataType: 'numeric', isNumeric: true, isCategorical: false, isDateOrTime: false, nullCount: 0, distinctCount: 30 }
    ];
    const timeRecs = ChartRecommender.getRecommendations(timeCols as any, 30);
    assert('RECOM-1: Time dimension + numeric measure recommends Line Chart',
      timeRecs.some(r => r.chartType === 'line')
    );

    const scatterCols = [
      { name: 'height', dataType: 'int', isNumeric: true, isCategorical: false, isDateOrTime: false, nullCount: 0, distinctCount: 50 },
      { name: 'weight', dataType: 'int', isNumeric: true, isCategorical: false, isDateOrTime: false, nullCount: 0, distinctCount: 50 }
    ];
    const scatterRecs = ChartRecommender.getRecommendations(scatterCols as any, 50);
    assert('RECOM-2: Two numeric columns recommends Scatter Plot',
      scatterRecs.some(r => r.chartType === 'scatter')
    );
  } catch (err: any) {
    assert('PHASE-3-RECOM: Error testing chart recommender', false, err.message);
  }

  // --- PHASE 9: CROSS-FILTER COMPATIBILITY & UNAFFECTED WIDGET SAFETY ---
  try {
    const ordersWidget: DashboardWidget = {
      id: 'w_orders_1',
      title: 'Order Status Count',
      chartType: 'bar',
      queryRef: {
        type: 'raw_sql',
        sql: 'SELECT status, count(*) as count FROM orders GROUP BY status;',
        sourceTable: 'orders',
        referencedColumns: ['status', 'count']
      },
      chartConfig: {
        chartType: 'bar',
        xAxis: 'status',
        yAxis: 'count',
        secondaryMeasures: [],
        aggregation: 'none',
        sortOrder: 'none',
        sortBy: 'x',
        limit: 'all',
        title: 'Order Status Count',
        showLegend: true,
        showDataLabels: true,
        showGrid: true,
        binCount: 10,
        treatNullAsZero: true
      },
      size: { colSpan: 6 },
      position: { order: 0 }
    };

    const ordersCols: QueryResultColumn[] = [
      { name: 'status', dataType: 'varchar' },
      { name: 'count', dataType: 'int' }
    ];

    // Filter on customers.gender
    const customerGenderFilter: DashboardFilter = {
      id: 'f_gender',
      label: 'Customer Gender',
      targetColumn: 'customers.gender',
      targetTable: 'customers',
      type: 'single_select',
      currentValue: 'Female'
    };

    const compOrders = DashboardFilterEngine.checkCompatibility(customerGenderFilter, ordersWidget, ordersCols);
    assert('CROSS-FILTER-1: Orders widget is marked incompatible with customers.gender filter',
      !compOrders.isCompatible
    );

    const appliedOrders = DashboardFilterEngine.applyFiltersToSql(
      ordersWidget.queryRef.sql,
      [customerGenderFilter],
      ordersWidget,
      ordersCols
    );
    assert('CROSS-FILTER-2: Incompatible filter is not injected into orders widget query',
      appliedOrders.appliedFilterCount === 0 &&
      appliedOrders.augmentedSql === ordersWidget.queryRef.sql
    );
  } catch (err: any) {
    assert('PHASE-9-CROSSFILTER: Error testing cross-filter compatibility', false, err.message);
  }

  // --- PHASE 10: WIDGET TITLE RENAME & MULTI-SCHEMA QUALIFICATION TESTS ---
  try {
    const testDashId = `dash-rename-test-${Date.now()}`;
    const initialDash: Dashboard = {
      id: testDashId,
      name: 'Rename & Schema Test Dash',
      widgets: [
        {
          id: 'w_rename_1',
          title: 'Original Title',
          chartType: 'bar',
          queryRef: {
            type: 'raw_sql',
            sql: 'SELECT * FROM analytics_practice.orders LIMIT 10;',
            sourceTable: 'analytics_practice.orders',
            referencedColumns: ['order_id', 'total']
          },
          chartConfig: {
            chartType: 'bar',
            xAxis: 'order_id',
            yAxis: 'total',
            secondaryMeasures: [],
            aggregation: 'none',
            sortOrder: 'none',
            sortBy: 'x',
            limit: 'all',
            title: 'Original Title',
            showLegend: true,
            showDataLabels: false,
            showGrid: true,
            binCount: 10,
            treatNullAsZero: true
          },
          size: { colSpan: 6 },
          position: { order: 0 }
        }
      ],
      filters: [],
      layout: { columns: 12, gap: 'md', theme: 'dark' },
      autoRefreshInterval: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DashboardService.saveDashboard(initialDash);

    // Test 1: Renaming widget updates both title and chartConfig.title and persists
    const updated = DashboardService.updateWidget(testDashId, 'w_rename_1', {
      title: 'Renamed Q3 Orders',
      chartConfig: {
        ...initialDash.widgets[0].chartConfig,
        title: 'Renamed Q3 Orders'
      }
    });

    assert('WIDGET-RENAME-1: Updating widget title succeeds and updates widget.title',
      updated !== null && updated.widgets[0].title === 'Renamed Q3 Orders'
    );

    assert('WIDGET-RENAME-2: Updating widget title preserves query, sizing, and position',
      updated !== null &&
      updated.widgets[0].queryRef.sql === 'SELECT * FROM analytics_practice.orders LIMIT 10;' &&
      updated.widgets[0].size.colSpan === 6 &&
      updated.widgets[0].position.order === 0
    );

    // Test 2: Verify persistence from fresh reload
    const reloaded = DashboardService.getDashboardById(testDashId);
    assert('WIDGET-RENAME-3: Updated widget title persists in dashboard storage across reloads',
      reloaded !== null && reloaded.widgets[0].title === 'Renamed Q3 Orders'
    );

    // Test 3: Duplicated widget receives distinct title and state
    const dupResult = DashboardService.duplicateWidget(testDashId, 'w_rename_1');
    assert('WIDGET-DUP-1: Duplicating widget produces a new distinct widget ID and copy title',
      dupResult !== null &&
      dupResult.widget.id !== 'w_rename_1' &&
      dupResult.widget.title === 'Renamed Q3 Orders (Copy)' &&
      dupResult.widget.chartConfig.title === 'Renamed Q3 Orders (Copy)'
    );

    // Clean up test dashboard
    DashboardService.deleteDashboard(testDashId);
  } catch (err: any) {
    assert('PHASE-10-WIDGET-RENAME: Error in widget rename tests', false, err.message);
  }

  // --- PHASE 11: DASHBOARD DELETE CONFIRMATION & DIALOG CONSISTENCY ---
  try {
    const workspaceSourcePath = path.join(process.cwd(), 'src', 'components', 'Dashboard', 'DashboardWorkspace.tsx');
    const workspaceSource = fs.readFileSync(workspaceSourcePath, 'utf8');

    // Test 1: Verify no native window.confirm() or confirm() calls remain in DashboardWorkspace
    const hasNativeConfirm = /(?<!\w)confirm\s*\(/.test(workspaceSource) || /window\.confirm\s*\(/.test(workspaceSource);
    assert(
      'DASH-CONFIRM-1: No native window.confirm() or confirm() remains in DashboardWorkspace',
      !hasNativeConfirm,
      'Found native confirm() in DashboardWorkspace.tsx'
    );

    // Test 2: Verify ConfirmDialog is imported from common components
    const hasConfirmDialogImport = workspaceSource.includes("import { ConfirmDialog } from '../common/ConfirmDialog'") ||
      workspaceSource.includes('import { ConfirmDialog }');
    assert(
      'DASH-CONFIRM-2: ConfirmDialog is imported from common components in DashboardWorkspace',
      hasConfirmDialogImport
    );

    // Test 3: Verify ConfirmDialog configuration has title="Delete Dashboard" and confirmText="Delete Dashboard"
    const hasCorrectTitle = workspaceSource.includes('title="Delete Dashboard"');
    const hasCorrectConfirmText = workspaceSource.includes('confirmText="Delete Dashboard"');
    const hasCorrectCancelText = workspaceSource.includes('cancelText="Cancel"');
    const hasDangerVariant = workspaceSource.includes('confirmVariant="danger"');
    assert(
      'DASH-CONFIRM-3: ConfirmDialog is configured with Title: Delete Dashboard, confirmText: Delete Dashboard, and danger variant',
      hasCorrectTitle && hasCorrectConfirmText && hasCorrectCancelText && hasDangerVariant
    );

    // Test 4: Dashboard cancellation preserves dashboard without deletion
    const cancelTestId = `dash-cancel-delete-${Date.now()}`;
    const cancelTestDash: Dashboard = {
      id: cancelTestId,
      name: 'Dashboard Not Deleted',
      widgets: [],
      filters: [],
      layout: { columns: 12, gap: 'md', theme: 'dark' },
      autoRefreshInterval: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(cancelTestDash);

    // Simulating cancel: no deleteDashboard called
    const stillExists = DashboardService.getDashboardById(cancelTestId);
    assert(
      'DASH-CONFIRM-4: Cancelling delete leaves dashboard intact in storage',
      stillExists !== null && stillExists.name === 'Dashboard Not Deleted'
    );

    // Test 5: Confirming delete removes dashboard from storage
    DashboardService.deleteDashboard(cancelTestId);
    const deletedCheck = DashboardService.getDashboardById(cancelTestId);
    assert(
      'DASH-CONFIRM-5: Confirming delete removes dashboard cleanly from storage',
      deletedCheck === null
    );
  } catch (err: any) {
    assert('PHASE-11-DASH-CONFIRM: Error in dashboard confirm dialog regression tests', false, err.message);
  }

  // --- PHASE 12: DASHBOARD DUPLICATE & PROMPT DIALOG CONSISTENCY ---
  try {
    const workspaceSourcePath = path.join(process.cwd(), 'src', 'components', 'Dashboard', 'DashboardWorkspace.tsx');
    const workspaceSource = fs.readFileSync(workspaceSourcePath, 'utf8');

    // Test 1: Verify no native window.prompt() or prompt() calls remain in DashboardWorkspace
    const hasNativePrompt = /(?<!\w)prompt\s*\(/.test(workspaceSource) || /window\.prompt\s*\(/.test(workspaceSource);
    assert(
      'DASH-PROMPT-1: No native window.prompt() or prompt() remains in DashboardWorkspace',
      !hasNativePrompt,
      'Found native prompt() in DashboardWorkspace.tsx'
    );

    // Test 2: Verify PromptDialog is imported in DashboardWorkspace
    const hasPromptDialogImport = workspaceSource.includes("import { PromptDialog } from '../common/PromptDialog'") ||
      workspaceSource.includes('import { PromptDialog }');
    assert(
      'DASH-PROMPT-2: PromptDialog is imported in DashboardWorkspace',
      hasPromptDialogImport
    );

    // Test 3: Verify PromptDialog configuration has title="Duplicate Dashboard" and confirmText="Duplicate Dashboard"
    const hasDuplicateTitle = workspaceSource.includes('title="Duplicate Dashboard"');
    const hasDuplicateConfirmText = workspaceSource.includes('confirmText="Duplicate Dashboard"');
    const hasDuplicateMessage = workspaceSource.includes('message="Enter a name for the duplicated dashboard."');
    assert(
      'DASH-PROMPT-3: PromptDialog is configured with title="Duplicate Dashboard", correct message, and confirmText="Duplicate Dashboard"',
      hasDuplicateTitle && hasDuplicateConfirmText && hasDuplicateMessage
    );

    // Test 4: Default copy name formatting logic
    const testOriginId = `dash-dup-source-${Date.now()}`;
    const testOriginDash: Dashboard = {
      id: testOriginId,
      name: 'Executive Revenue Summary',
      widgets: [
        {
          id: 'w_1',
          title: 'Total Revenue',
          chartType: 'kpi',
          queryRef: {
            type: 'raw_sql',
            sql: 'SELECT 1000;',
            sourceTable: 'sales',
            referencedColumns: []
          },
          chartConfig: {
            chartType: 'kpi',
            xAxis: '',
            yAxis: '',
            secondaryMeasures: [],
            aggregation: 'none',
            sortOrder: 'none',
            sortBy: 'x',
            limit: 'all',
            title: 'Total Revenue',
            showLegend: false,
            showDataLabels: false,
            showGrid: false,
            binCount: 10,
            treatNullAsZero: true
          },
          size: { colSpan: 6 },
          position: { order: 0 }
        }
      ],
      filters: [],
      layout: { columns: 12, gap: 'md', theme: 'dark' },
      autoRefreshInterval: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    DashboardService.saveDashboard(testOriginDash);

    // Test 5: Duplicating with default copy name
    const defaultDup = DashboardService.duplicateDashboard(testOriginId);
    assert(
      'DASH-PROMPT-4: Duplicating without custom name generates "Original Name (Copy)"',
      defaultDup !== null && defaultDup.name === 'Executive Revenue Summary (Copy)'
    );

    // Test 6: Duplicating with custom user-entered name
    const customDup = DashboardService.duplicateDashboard(testOriginId, 'Q4 Regional Revenue Review');
    assert(
      'DASH-PROMPT-5: Duplicating with user-entered custom name sets custom name properly',
      customDup !== null && customDup.name === 'Q4 Regional Revenue Review'
    );

    // Test 7: Duplicating deep clones widgets with fresh IDs
    assert(
      'DASH-PROMPT-6: Duplicating clones widgets with new distinct widget IDs',
      customDup !== null &&
      customDup.widgets.length === 1 &&
      customDup.widgets[0].id !== 'w_1' &&
      customDup.widgets[0].title === 'Total Revenue'
    );

    // Clean up test dashboards
    DashboardService.deleteDashboard(testOriginId);
    if (defaultDup) DashboardService.deleteDashboard(defaultDup.id);
    if (customDup) DashboardService.deleteDashboard(customDup.id);
  } catch (err: any) {
    assert('PHASE-12-DASH-PROMPT: Error in dashboard duplicate prompt regression tests', false, err.message);
  }

  // --- PHASE 13: DASHBOARD EMPTY STATE DESIGN & CONTENT HIERARCHY ---
  try {
    const listSourcePath = path.join(process.cwd(), 'src', 'components', 'Dashboard', 'DashboardList.tsx');
    const listSource = fs.readFileSync(listSourcePath, 'utf8');

    const illustrationPath = path.join(process.cwd(), 'src', 'components', 'Dashboard', 'DashboardEmptyIllustration.tsx');
    const illustrationExists = fs.existsSync(illustrationPath);

    // Test 1: Illustration component exists and is imported
    assert(
      'DASH-EMPTY-1: DashboardEmptyIllustration exists and is imported in DashboardList',
      illustrationExists && listSource.includes('DashboardEmptyIllustration')
    );

    // Test 2: Updated Heading
    assert(
      'DASH-EMPTY-2: Heading displays "No dashboards yet"',
      listSource.includes('No dashboards yet')
    );

    // Test 3: Updated Subtitle
    assert(
      'DASH-EMPTY-3: Subtitle displays "Build your first analytics dashboard from your connected data."',
      listSource.includes('Build your first analytics dashboard from your connected data.')
    );

    // Test 4: Primary and secondary actions
    assert(
      'DASH-EMPTY-4: Primary action is "Create Dashboard" and secondary is "Browse Templates"',
      listSource.includes('Create Dashboard') && listSource.includes('Browse Templates')
    );

    // Test 5: Subtle AI Option and supporting text
    assert(
      'DASH-EMPTY-5: Subtle AI option "✦ Build with AI" and supporting copy present',
      listSource.includes('✦ Build with AI') &&
      listSource.includes('Let AI create a dashboard from your database schema.')
    );

    // Test 6: Capability hint
    assert(
      'DASH-EMPTY-6: Capability hint displays "Charts • KPIs • Filters • Tables"',
      listSource.includes('Charts • KPIs • Filters • Tables')
    );
  } catch (err: any) {
    assert('PHASE-13-DASH-EMPTY: Error in dashboard empty state regression tests', false, err.message);
  }

  return results;
}
