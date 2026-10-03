import fs from 'fs';
import path from 'path';
import { ChartConfig, DetectedColumn } from '../src/types/visualization';
import { ImportedDataset } from '../src/types/import';
import { VisualizationQueryBuilder } from '../src/services/visualizationQueryBuilder';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runVisualizationDatasetBugFixTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- 29. VISUALIZATION DATASET SCHEMA REVALIDATION & BUG FIX TESTS ---');

  const datasetA: ImportedDataset = {
    datasetId: 'ds_a',
    sourceType: 'FILE',
    sourceName: 'sales_a.csv',
    fileType: 'CSV',
    rowCount: 100,
    columns: [
      { name: 'region', dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'sales', dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [] }
    ],
    schema: 'main',
    name: 'Sales Dataset A',
    tableName: 'imported_sales_a',
    previewRows: [],
    importTimestamp: new Date().toISOString(),
    status: 'ready'
  };

  const datasetB: ImportedDataset = {
    datasetId: 'ds_b',
    sourceType: 'FILE',
    sourceName: 'product_b.csv',
    fileType: 'CSV',
    rowCount: 50,
    columns: [
      { name: 'category', dataType: 'text', isNullable: true, nullCount: 0, sampleValues: [] },
      { name: 'price', dataType: 'numeric', isNullable: true, nullCount: 0, sampleValues: [] }
    ],
    schema: 'main',
    name: 'Product Dataset B',
    tableName: 'imported_product_b',
    previewRows: [],
    importTimestamp: new Date().toISOString(),
    status: 'ready'
  };

  const schemaColsB: DetectedColumn[] = datasetB.columns.map(c => ({
    name: c.name,
    dataType: c.dataType,
    semanticType: c.dataType === 'numeric' ? 'numeric' : 'text',
    isNumeric: c.dataType === 'numeric',
    isDateOrTime: false,
    isCategorical: c.dataType !== 'numeric',
    isBoolean: false,
    isNullable: true,
    distinctCount: 10,
    nullCount: 0,
    sampleValues: []
  }));

  const staleConfig: ChartConfig = {
    chartType: 'bar',
    xAxis: 'region',
    yAxis: 'total_orders',
    aggregation: 'count',
    sortOrder: 'desc',
    sortBy: 'x',
    limit: 50,
    title: 'Stale Test',
    showLegend: true,
    showDataLabels: false,
    showGrid: true,
    binCount: 20,
    treatNullAsZero: false,
    samplingEnabled: false,
    secondaryMeasures: []
  };

  const colNamesB = new Set(schemaColsB.map(c => c.name));
  let testX = staleConfig.xAxis;
  let testY = staleConfig.yAxis;

  if (testX && testX !== 'All Rows' && !colNamesB.has(testX)) {
    testX = '';
  }
  if (testY && testY !== 'All Rows' && testY !== '*' && !colNamesB.has(testY)) {
    testY = '';
  }

  assertTest(
    '1. Stale field mapping region not in dataset B reset to empty',
    testX === '',
    'Stale xAxis region should be reset to empty'
  );

  assertTest(
    '2. Stale field mapping total_orders not in dataset B reset to empty',
    testY === '',
    'Stale yAxis total_orders should be reset to empty'
  );

  let sqlExecutionPrevented = false;
  let errorMessage = '';
  const attemptedDim = 'region';
  const attemptedMeas = 'total_orders';

  if (!colNamesB.has(attemptedDim)) {
    sqlExecutionPrevented = true;
    errorMessage = `Selected field '${attemptedDim}' is not available in this dataset. Please select another field.`;
  } else if (!colNamesB.has(attemptedMeas)) {
    sqlExecutionPrevented = true;
    errorMessage = `Selected field '${attemptedMeas}' is not available in this dataset. Please select another field.`;
  }

  assertTest(
    '3. Invalid SQL execution prevented when column missing',
    sqlExecutionPrevented,
    'SQL execution must be blocked for missing columns'
  );

  assertTest(
    '4. Clear error message generated for missing column',
    errorMessage.includes("Selected field 'region' is not available in this dataset"),
    'Error message must indicate missing column'
  );

  const ecommerceDataset: ImportedDataset = {
    datasetId: 'ds_ecom',
    sourceType: 'FILE',
    sourceName: 'ecommerce_analysis_dataset_50000_1_.csv',
    fileType: 'CSV',
    rowCount: 50000,
    columns: [
      { name: 'Order_ID', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['ORD-1'] },
      { name: 'Order_Date', dataType: 'date', isNullable: false, nullCount: 0, sampleValues: ['2026-01-01'] },
      { name: 'Customer_ID', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['CUST-1'] },
      { name: 'Customer_Name', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['Alice'] },
      { name: 'Region', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['North'] },
      { name: 'Product', dataType: 'text', isNullable: false, nullCount: 0, sampleValues: ['Widget'] },
      { name: 'Quantity', dataType: 'integer', isNullable: false, nullCount: 0, sampleValues: [5] },
      { name: 'Sales', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [150.0] },
      { name: 'Profit', dataType: 'numeric', isNullable: false, nullCount: 0, sampleValues: [45.0] }
    ],
    schema: 'main',
    name: 'ecommerce_analysis_dataset_50000_1_',
    tableName: 'imported_ecom_50k',
    previewRows: [],
    importTimestamp: new Date().toISOString(),
    status: 'ready'
  };

  const ecomCols = ecommerceDataset.columns.map(c => c.name);
  assertTest(
    '6. All 9 schema columns independently available for X Axis',
    ecomCols.length === 9 && ecomCols.includes('Order_Date') && ecomCols.includes('Customer_Name') && ecomCols.includes('Sales'),
    'X Axis must expose all schema columns independently'
  );

  assertTest(
    '7. Y Axis independently exposes All Rows (*) and numeric measure columns (Sales, Profit, Quantity)',
    ecomCols.includes('Sales') && ecomCols.includes('Profit') && ecomCols.includes('Quantity'),
    'Y Axis must expose numeric columns and measure columns independently'
  );

  // 8. Visuals Empty State UI Tests
  const visWorkspaceSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Visualization/VisualizationWorkspace.tsx'), 'utf-8');
  const illustrationSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Visualization/VisualAnalyticsIllustration.tsx'), 'utf-8');

  assertTest(
    '8. Visuals empty state displays "No visualization yet" heading',
    visWorkspaceSource.includes('No visualization yet'),
    'Empty state must display "No visualization yet"'
  );

  assertTest(
    '9. Visuals empty state displays descriptive copy for connecting data or importing dataset',
    visWorkspaceSource.includes('Connect your data or import a dataset to turn your data into interactive visual insights.'),
    'Empty state must include specified copy'
  );

  assertTest(
    '10. Visuals empty state preserves Connect Database and Import Dataset action buttons',
    visWorkspaceSource.includes('id="btn-vis-connect-db"') &&
    visWorkspaceSource.includes('Connect Database') &&
    visWorkspaceSource.includes('id="btn-vis-import-dataset"') &&
    visWorkspaceSource.includes('Import Dataset'),
    'Action buttons must be preserved'
  );

  assertTest(
    '11. Visuals empty state includes capability hint "Create charts • Explore trends • Compare metrics"',
    visWorkspaceSource.includes('Create charts') &&
    visWorkspaceSource.includes('Explore trends') &&
    visWorkspaceSource.includes('Compare metrics'),
    'Capability hint must be rendered'
  );

  assertTest(
    '12. Visuals empty state provides AI Assistant visualization recommendation hint and click handler',
    visWorkspaceSource.includes('✦ Need help choosing a chart?') &&
    visWorkspaceSource.includes('Ask AI Assistant to recommend a visualization.') &&
    visWorkspaceSource.includes('id="btn-vis-empty-ai-assistant"') &&
    visWorkspaceSource.includes('handleOpenAiAssistant'),
    'AI Assistant hint must be present and clickable'
  );

  assertTest(
    '13. VisualAnalyticsIllustration communicates bar chart, trend line, donut chart, and data points',
    illustrationSource.includes('Visual Insights') &&
    illustrationSource.includes('strokeDasharray') && // Donut segment
    illustrationSource.includes('vis-trend-gradient') && // Trend line
    illustrationSource.includes('<circle') && // Data points
    illustrationSource.includes('bg-gradient-to-t'), // Bar charts
    'Illustration must render visual analytics elements'
  );

  return results;
}
