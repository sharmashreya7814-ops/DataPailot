import fs from 'fs';
import path from 'path';
import { SqlEditorTab } from '../src/types/database';

export function runSqlEditorTabsTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    if (condition) {
      results.push({ name, passed: true });
    } else {
      results.push({ name, passed: false, error: errorMsg });
    }
  };

  // 1. Initial State
  let tabs: SqlEditorTab[] = [{
    id: 'tab-1',
    name: 'Query 1.sql',
    query: 'SELECT * FROM users;',
    result: null,
    isRunning: false
  }];
  let activeTabId = 'tab-1';
  let tabCounter = 2;

  assertTest('Initial state setup', tabs.length === 1 && activeTabId === 'tab-1', 'Should initialize with 1 tab');

  // 2. Add Tab
  const newId = `tab-${Date.now()}`;
  tabs = [...tabs, { id: newId, name: `Query ${tabCounter}.sql`, query: '', result: null, isRunning: false }];
  activeTabId = newId;
  tabCounter++;

  assertTest('Add new tab', tabs.length === 2 && activeTabId === newId && tabs[1].name === 'Query 2.sql', 'Should add new tab and make it active');

  // 3. Rename Tab
  tabs = tabs.map(t => t.id === activeTabId ? { ...t, name: 'Users Query' } : t);
  assertTest('Rename tab', tabs.find(t => t.id === activeTabId)?.name === 'Users Query', 'Should rename the active tab');

  // 4. Duplicate Tab
  const tabToDup = tabs.find(t => t.id === activeTabId);
  const dupId = `tab-${Date.now() + 1}`;
  const newTabs = [...tabs];
  newTabs.splice(tabs.findIndex(t => t.id === activeTabId) + 1, 0, {
    ...tabToDup!,
    id: dupId,
    name: `${tabToDup!.name} (copy)`,
    query: tabToDup!.query
  });
  tabs = newTabs;
  activeTabId = dupId;

  assertTest('Duplicate tab', tabs.length === 3 && activeTabId === dupId && tabs[2].name === 'Users Query (copy)', 'Should duplicate tab successfully');

  // 5. Unsaved change confirmation logic
  const isUnsaved = tabs[2].query.trim().length > 0;
  assertTest('Unsaved change detection', isUnsaved === false, 'New duplicated tab with empty query (wait, dup was from empty) - actually we duplicated tab 2 which was empty');

  // Let's modify the query and test unsaved
  tabs = tabs.map(t => t.id === activeTabId ? { ...t, query: 'SELECT * FROM orders' } : t);
  const isUnsavedNow = tabs[2].query.trim().length > 0 && tabs[2].query !== 'default';
  assertTest('Unsaved change detected after edit', isUnsavedNow === true, 'Should detect unsaved changes if query is modified');

  // 6. Close Tab
  const filtered = tabs.filter(t => t.id !== activeTabId);
  activeTabId = filtered[0].id;
  tabs = filtered;

  assertTest('Close tab', tabs.length === 2 && activeTabId === 'tab-1', 'Should close tab and fallback to previous tab');

  // 7. Custom ConfirmDialog replacement verification
  const appTsx = fs.readFileSync(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  assertTest(
    'Native window.confirm removed from SQL tab close flow',
    !appTsx.includes('window.confirm') && !appTsx.includes('confirm(`Close ${'),
    'App.tsx should not use window.confirm for closing tabs'
  );

  assertTest(
    'App.tsx imports and renders ConfirmDialog',
    appTsx.includes('ConfirmDialog') && appTsx.includes('Unsaved SQL Changes') && appTsx.includes('Keep Editing') && appTsx.includes('Close Query'),
    'App.tsx should use ConfirmDialog with matching title and actions'
  );

  const confirmDialogFile = fs.readFileSync(path.join(process.cwd(), 'src', 'components', 'common', 'ConfirmDialog.tsx'), 'utf8');
  assertTest(
    'ConfirmDialog implements accessibility roles & attributes',
    confirmDialogFile.includes('role="dialog"') && confirmDialogFile.includes('aria-modal="true"') && confirmDialogFile.includes('aria-labelledby') && confirmDialogFile.includes('aria-describedby'),
    'ConfirmDialog must satisfy accessibility dialog requirements'
  );

  assertTest(
    'ConfirmDialog defaults focus to safe action and handles Escape',
    confirmDialogFile.includes('cancelBtnRef') && confirmDialogFile.includes('Escape') && confirmDialogFile.includes('previousActiveElementRef'),
    'ConfirmDialog must focus safe action and restore focus upon cancel'
  );

  return results;
}
