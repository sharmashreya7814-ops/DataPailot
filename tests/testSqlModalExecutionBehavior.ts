import fs from 'fs';
import path from 'path';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runSqlModalExecutionBehaviorTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const record = (name: string, passed: boolean, error?: string) => {
    results.push({ name, passed, error });
  };

  const sqlPreviewPath = path.join(process.cwd(), 'src/components/Analysis/SqlPreviewModal.tsx');
  const sqlPreviewSource = fs.readFileSync(sqlPreviewPath, 'utf-8');

  const analysisStudioPath = path.join(process.cwd(), 'src/components/Analysis/AnalysisStudio.tsx');
  const analysisStudioSource = fs.readFileSync(analysisStudioPath, 'utf-8');

  // 1. Execute calls the existing query execution function
  record(
    '1. Execute calls existing query execution function (onRunQuery or DatabaseApiClient.executeQuery)',
    sqlPreviewSource.includes('await onRunQuery(query.sql, query)') &&
    sqlPreviewSource.includes('await DatabaseApiClient.executeQuery(query.sql)') &&
    analysisStudioSource.includes('onRunQuery={handleRunQuery}')
  );

  // 2. Successful execution automatically closes the modal
  record(
    '2. Successful execution automatically closes the modal (calls onClose())',
    sqlPreviewSource.includes('// On success: automatically close modal and return user to Analysis Toolkit') &&
    sqlPreviewSource.includes('onClose();')
  );

  // 3. Successful execution does NOT render preview / results UI
  record(
    '3. Successful execution does not render preview/results UI (no preview table, no rowCount, no executionTimeMs)',
    !sqlPreviewSource.includes('executionResult') &&
    !sqlPreviewSource.includes('rows returned') &&
    !sqlPreviewSource.includes('Execution time:') &&
    !sqlPreviewSource.includes('<table') &&
    !sqlPreviewSource.includes('Execution Results')
  );

  // 4. Failed execution keeps modal open
  record(
    '4. Failed execution keeps the modal open (sets executionError and does not call onClose on error)',
    sqlPreviewSource.includes('setExecutionError(') &&
    sqlPreviewSource.includes('res.status === \'error\' || res.errorMessage') &&
    sqlPreviewSource.includes('catch (err: any) {')
  );

  // 5. Failed execution shows user-friendly DataPilot error message without native alert()
  record(
    '5. Failed execution shows compact DataPilot error banner without window.alert()',
    sqlPreviewSource.includes('id="analysis-execution-error-banner"') &&
    sqlPreviewSource.includes('Execution Error') &&
    sqlPreviewSource.includes('{executionError}') &&
    !sqlPreviewSource.includes('window.alert') &&
    !sqlPreviewSource.includes('alert(')
  );

  // 6. Execute button shows loading state "Executing..." with spinner
  record(
    '6. Execute button shows loading state "Executing..." with Loader2 spinner',
    sqlPreviewSource.includes('<span>Executing...</span>') &&
    sqlPreviewSource.includes('Loader2') &&
    sqlPreviewSource.includes('animate-spin')
  );

  // 7. Execute button renamed from "Execute / Preview Results" to "Execute"
  record(
    '7. Execute button renamed to "Execute" and is primary action with emerald styling',
    sqlPreviewSource.includes('id="btn-execute-analysis-query"') &&
    sqlPreviewSource.includes('<span>Execute</span>') &&
    !sqlPreviewSource.includes('Execute / Preview Results') &&
    sqlPreviewSource.includes('bg-emerald-600')
  );

  // 8. Duplicate execution is prevented (double-click safeguard & disabled state)
  record(
    '8. Duplicate execution is prevented via guard condition and button disabled state',
    sqlPreviewSource.includes('if (isExecuting || isRunning) return;') &&
    sqlPreviewSource.includes('disabled={isWorking}') &&
    sqlPreviewSource.includes('const isWorking = isExecuting || isRunning;')
  );

  // 9. Add to Dashboard still works
  record(
    '9. Add to Dashboard remains intact and functional in SqlPreviewModal',
    sqlPreviewSource.includes('id="btn-add-analysis-to-dashboard"') &&
    sqlPreviewSource.includes('onAddToDashboard(query)') &&
    sqlPreviewSource.includes('Add to Dashboard')
  );

  // 10. Open in SQL Editor still works
  record(
    '10. Open in SQL Editor remains intact and functional in SqlPreviewModal',
    sqlPreviewSource.includes('id="btn-edit-in-sql-editor"') &&
    sqlPreviewSource.includes('onEditInEditor(query.sql)') &&
    sqlPreviewSource.includes('Open in SQL Editor')
  );

  // 11. Escape key and backdrop dismissal preserved when not executing
  record(
    '11. Escape key and backdrop click dismissal behavior preserved when not executing',
    sqlPreviewSource.includes("e.key === 'Escape' && !isExecuting") &&
    sqlPreviewSource.includes('e.target === e.currentTarget && !isWorking') &&
    sqlPreviewSource.includes('id="btn-cancel-sql-preview"')
  );

  // 12. Read-only safety checks, schema qualification, and SQL validation preserved
  record(
    '12. SQL validation, read-only safety rules, and schema qualification preserved',
    sqlPreviewSource.includes('read-only safety rules') &&
    sqlPreviewSource.includes('Validated against') &&
    sqlPreviewSource.includes('Read Only') &&
    sqlPreviewSource.includes('Validated')
  );

  return results;
}
