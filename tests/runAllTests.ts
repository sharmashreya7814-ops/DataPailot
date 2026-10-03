import { runComprehensiveTestMatrix } from './testPhase12Matrix';
import { runSQLiteConnectionTests } from './testSQLiteConnection';
import { runDataLineageTests } from './testDataLineage';
import { runSqlSecurityTests } from './testSqlSecurity';
import { runSchemaAndGroundingTests } from './testSchemaAndGrounding';
import { runDashboardAndFilterTests } from './testDashboardAndFilters';
import { runDatabaseAdapterTests } from './testDatabaseAdapter';
import { runDatabaseAdapterTests as runAdapterFoundationTests } from './runDatabaseAdapterTests';
import { runSqlAutocompleteTests } from './testSqlAutocomplete';
import { runSqlEditorTabsTests } from './testSqlEditorTabs';
import { runQueryLibraryTests } from './testQueryLibrary';
import { runSqlSnippetsTests } from './testSqlSnippets';
import { runPerformanceAnalyzerTests } from './testPerformanceAnalyzer';
import { runImportWorkflowTests } from './testImportWorkflow';
import { runVisualizationImportIntegrationTests } from './testVisualizationImportIntegration';
import { runDatabaseVisualizationIntegrationTests } from './testDatabaseVisualizationIntegration';
import { runExcelExportTests } from './testExcelExport';
import { runDataQualityTests } from './testDataQuality';
import { runDataQualitySelectionTests } from './testDataQualitySelection';
import { runDataQualityImportIntegrationTests } from './testDataQualityImportIntegration';
import { runDataTransformation15_2Tests } from './testDataTransformation15_2';
import { runAiDataCleaning15_5Tests } from './testAiDataCleaning15_5';
import { runLargeDatasetPerformance15_6Tests } from './testLargeDatasetPerformance15_6';
import { runPhase16_1Tests } from './testPhase16_1UiOptimization';
import { runPhase16_3Tests } from './testPhase16_3Collaboration';
import { runProjectSwitchingAndIsolationTests } from './testProjectSwitchingAndIsolation';
import { runPhase16_4Tests } from './testPhase16_4Production';
import { runMigrationTests } from './testMigrations';
import { runDockerAndProductionTests } from './testDockerAndProduction';
import { runDeploymentSmokeTests } from './testDeploymentSmoke';
import { runProductionReadinessAudit } from './testProductionReadiness';
import { runSqlSyntaxHighlighterTests } from './testSqlSyntaxHighlighter';
import { runVisualizationDatasetBugFixTests } from './testVisualizationDatasetBugFix';
import { runRbacEnforcementTests } from './testRbacEnforcement';
import { runRbacSecurityAuditTests } from './testRbacSecurityAudit';
import { runRbacRoleSwitchingTests } from './testRbacRoleSwitching';
import { runRealAuthFoundationTests } from './testRealAuthFoundation';
import { runPasswordResetTests } from './testPasswordReset';
import { runEmailVerificationTests } from './testEmailVerification';
import { runRealEmailDeliveryTests } from './testPhase33RealEmailDelivery';
import { runSchemaSyncAndSavedConnectionsTests } from './testSchemaSyncAndSavedConnections';
import { runPreviewGeneratedSqlTests } from './testPreviewGeneratedSql';
import { runAnalysisFilteringFlowTests } from './testAnalysisFilteringFlow';
import { runAnalysisCalculationOrderingTests } from './testAnalysisCalculationOrdering';
import { runAnalysisExcelExportWorkflowTests } from './testAnalysisExcelExportWorkflow';
import { runAnalysisDateAnalysisDialectsTests } from './testAnalysisDateAnalysisDialects';
import { runAnalysisRankingTopNPerGroupTests } from './testAnalysisRankingTopNPerGroup';
import { runAnalysisStatisticalSummaryNumericTests } from './testAnalysisStatisticalSummaryNumeric';
import { runAnalysisSmartFieldMappingTests } from './testAnalysisSmartFieldMapping';
import { runSqlModalExecutionBehaviorTests } from './testSqlModalExecutionBehavior';

console.log('\n============================================================');
console.log('DATAPILOT PHASE 8: AUTOMATED TEST SUITE & REGRESSION MATRIX');
console.log('============================================================\n');

export interface TestGroup {
  name: string;
  runner: () => any;
}

export const suites: TestGroup[] = [
  { name: '0. DATA LINEAGE', runner: runDataLineageTests },
  { name: '0. PERFORMANCE ANALYZER', runner: runPerformanceAnalyzerTests },
  { name: '0. SQL SNIPPETS', runner: runSqlSnippetsTests },
  { name: '0. QUERY LIBRARY', runner: runQueryLibraryTests },
  { name: '0. SQL EDITOR TABS', runner: runSqlEditorTabsTests },
  { name: '0. SQL AUTOCOMPLETE', runner: runSqlAutocompleteTests },
  { name: '5. DATABASE ADAPTER FOUNDATION', runner: runAdapterFoundationTests  },
  { name: '1b. SQLITE CONNECTION VALIDATION', runner: runSQLiteConnectionTests },
  { name: '1. DATABASE & ADAPTER HARDENING', runner: runDatabaseAdapterTests },
  { name: '2. SQL SECURITY & REGRESSION MATRIX', runner: runSqlSecurityTests },
  { name: '3. SCHEMA GROUNDING & HALLUCINATION REJECTION', runner: runSchemaAndGroundingTests },
  { name: '4. DASHBOARD FILTERS & EXPORT SECURITY', runner: runDashboardAndFilterTests },
  { name: '12. PHASE 12 COMPREHENSIVE MATRIX', runner: runComprehensiveTestMatrix },
  { name: '13. DATA IMPORT & UNIFIED DATA LAYER', runner: runImportWorkflowTests },
  { name: '14. IMPORTED DATASET VISUALIZATION INTEGRATION', runner: runVisualizationImportIntegrationTests },
  { name: '14b. DATABASE TABLE VISUALIZATION & MULTI-SOURCE MATRIX', runner: runDatabaseVisualizationIntegrationTests },
  { name: '15. EXCEL (XLSX) QUERY RESULT EXPORT', runner: runExcelExportTests },
  { name: '16. DATA QUALITY & PROFILING 2.0', runner: runDataQualityTests },
  { name: '16b. DATA QUALITY IMPORT & CLEANED DATASET INTEGRATION', runner: runDataQualityImportIntegrationTests },
  { name: '17. DATA QUALITY WORKSPACE SELECTION', runner: runDataQualitySelectionTests },
  { name: '18. ADVANCED DATA TRANSFORMATION WORKSPACE (15.2)', runner: runDataTransformation15_2Tests },
  { name: '19. AI-ASSISTED DATA CLEANING & AUTO-CLEAN RECOMMENDATIONS (15.5)', runner: runAiDataCleaning15_5Tests },
  { name: '20. LARGE DATASET PERFORMANCE & PROCESSING ENGINE (15.6)', runner: runLargeDatasetPerformance15_6Tests },
  { name: '21. PHASE 16.1 UI/UX POLISH & SQL WORKSPACE OPTIMIZATION', runner: runPhase16_1Tests },
  { name: '22. PHASE 16.3 SHARING, REPORTS & COLLABORATION UX', runner: runPhase16_3Tests },
  { name: '22b. PROJECT SWITCHING & SCOPED RESOURCE ISOLATION MATRIX', runner: runProjectSwitchingAndIsolationTests },
  { name: '23. PHASE 16.4 PRODUCTION DEPLOYMENT & INFRASTRUCTURE', runner: runPhase16_4Tests },
  { name: '24. PHASE 16.4A PRODUCTION MIGRATION SYSTEM', runner: runMigrationTests },
  { name: '25. PHASE 16.4B DOCKER & PRODUCTION RUNTIME', runner: runDockerAndProductionTests },
  { name: '26. PHASE 16.4C DEPLOYMENT SMOKE TESTS', runner: runDeploymentSmokeTests },
  { name: '27. PHASE 16.5 PRODUCTION READINESS QA AUDIT', runner: runProductionReadinessAudit },
  { name: '28. SQL SYNTAX HIGHLIGHTING & TOKEN ENGINE', runner: runSqlSyntaxHighlighterTests },
  { name: '29. VISUALIZATION DATASET SCHEMA REVALIDATION & BUG FIX', runner: runVisualizationDatasetBugFixTests },
  { name: '30. RBAC & PERMISSION ENFORCEMENT', runner: runRbacEnforcementTests },
  { name: '31. RBAC SECURITY AUDIT & PRODUCTION HARDENING', runner: runRbacSecurityAuditTests },
  { name: '32. RBAC ROLE SWITCHING & SYNCHRONIZATION', runner: runRbacRoleSwitchingTests },
  { name: '33. REAL USER AUTHENTICATION FOUNDATION', runner: runRealAuthFoundationTests },
  { name: '34. PRODUCTION PASSWORD RESET & RECOVERY', runner: runPasswordResetTests },
  { name: '35. EMAIL VERIFICATION & LIFECYCLE (PHASE 3.2)', runner: runEmailVerificationTests },
  { name: '36. REAL EMAIL DELIVERY & SECURITY (PHASE 3.3)', runner: runRealEmailDeliveryTests },
  { name: '37. SCHEMA SYNC WITH ANALYSIS TOOLKIT & SAVED DATABASE CONNECTIONS', runner: runSchemaSyncAndSavedConnectionsTests },
  { name: '38. PREVIEW GENERATED SQL IN EASY DATA ANALYSIS TOOLKIT', runner: runPreviewGeneratedSqlTests },
  { name: '39. ANALYSIS TOOLKIT FILTERING FLOW FOR IMPORTED DATASETS & CONNECTED DBS', runner: runAnalysisFilteringFlowTests },
  { name: '40. ANALYSIS TOOLKIT CALCULATIONS RESULT-COLUMN ORDERING', runner: runAnalysisCalculationOrderingTests },
  { name: '41. ANALYSIS TOOLKIT EXCEL EXPORT WORKFLOW (MULTI-SHEET WORKBOOK)', runner: runAnalysisExcelExportWorkflowTests },
  { name: '42. ANALYSIS TOOLKIT DATE ANALYSIS (SQLITE & MULTI-DIALECT COMPATIBILITY)', runner: runAnalysisDateAnalysisDialectsTests },
  { name: '43. ANALYSIS TOOLKIT RANKING (TOP N PER GROUP & SQLITE COMPATIBILITY)', runner: runAnalysisRankingTopNPerGroupTests },
  { name: '44. ANALYSIS TOOLKIT STATISTICAL SUMMARY (NUMERIC & SQLITE COMPATIBILITY)', runner: runAnalysisStatisticalSummaryNumericTests },
  { name: '45. ANALYSIS TOOLKIT SMART SEMANTIC FIELD MAPPING & SCORING MATRIX', runner: runAnalysisSmartFieldMappingTests },
  { name: '46. SELECT COLUMNS / GENERATED SQL MODAL EXECUTION BEHAVIOR', runner: runSqlModalExecutionBehaviorTests }
];

async function runAll() {
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

for (const suite of suites) {
  console.log(`\n--- ${suite.name} ---`);
  const results = await suite.runner();
  for (const res of results) {
    totalTests++;
    if (res.passed) {
      passedTests++;
      console.log(`  ✓ PASS: ${res.name}`);
    } else {
      failedTests++;
      console.error(`  ✗ FAIL: ${res.name} -> ${res.error || 'Check failed'}`);
    }
  }
}

console.log('\n============================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} failed)`);
console.log('============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
}
runAll().catch(console.error);
