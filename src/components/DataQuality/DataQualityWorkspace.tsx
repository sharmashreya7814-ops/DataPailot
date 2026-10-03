import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, Info, Loader2, Table2, Search, FileSpreadsheet, 
  RefreshCw, Hash, ShieldCheck, ShieldX, Copy, FileJson, FileText,
  ChevronRight, Brain, X, CheckCircle2, ListFilter
} from 'lucide-react';
import { DatabaseApiClient } from '../../services/databaseApi';
import { DiscoveredTable, SanitizedConnectionInfo, TableDetailsResult } from '../../types/database';
import { DataProfile, QualityIssue, ImportedDataset } from '../../types/import';
import { ExcelExportService } from '../../services/excelExportService';
import { DataQualityEmptyStateIllustration } from './DataQualityEmptyStateIllustration';

interface DataQualityWorkspaceProps {
  selectedTable: TableDetailsResult | null;
  connection: SanitizedConnectionInfo | null;
  activeDatasetId?: string | null;
  dataset?: ImportedDataset | null;
  onSelectTable: (table: DiscoveredTable) => void;
  tables: DiscoveredTable[];
}

type TabType = 'overview' | 'columns' | 'missing' | 'duplicates' | 'numeric' | 'dates' | 'issues' | 'ai';

export const DataQualityWorkspace: React.FC<DataQualityWorkspaceProps> = ({
  selectedTable,
  connection,
  activeDatasetId,
  dataset,
  tables
}) => {
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  // Issues & Sample rows state
  const [inspectingIssue, setInspectingIssue] = useState<QualityIssue | null>(null);
  const [sampleRows, setSampleRows] = useState<Record<string, unknown>[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  
  // AI State
  const [aiRecommendations, setAiRecommendations] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const loadProfile = async (schema: string, name: string) => {
    setIsLoading(true);
    setError(null);
    setAiRecommendations(null);
    setInspectingIssue(null);
    try {
      const data = await DatabaseApiClient.getDataQualityProfile(schema, name);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load data quality profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const isImported = selectedTable?.schema === 'imported' || !!dataset;
    const sourceName = dataset?.tableName || selectedTable?.name;
    const schema = dataset ? 'imported' : (selectedTable?.schema || 'imported');
    
    if (sourceName && schema) {
      loadProfile(schema, sourceName);
    } else {
      setProfile(null);
    }
  }, [selectedTable?.schema, selectedTable?.name, dataset?.datasetId, dataset?.tableName]);

  const handleExportCSV = () => {
    if (!profile) return;
    const rows = Object.values(profile.columns).map(c => 
      `${c.columnName},${c.dataType},${c.missingPercentage || 0}%,${c.qualityStatus || 'Good'}`
    );
    const csvContent = "data:text/csv;charset=utf-8,Column,Type,Missing %,Status\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${profile.datasetName}_quality.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!profile) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const link = document.createElement('a');
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `${profile.datasetName}_quality.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!profile) return;
    
    // Quality Summary Sheet
    const summarySheet = {
      sheetName: 'Quality Summary',
      columns: [{ name: 'Metric' }, { name: 'Value' }],
      rows: [
        { Metric: 'Dataset', Value: profile.datasetName },
        { Metric: 'Total Rows', Value: profile.totalRows },
        { Metric: 'Total Columns', Value: profile.totalColumns },
        { Metric: 'Overall Score', Value: profile.overallQualityScore ?? 'N/A' },
        { Metric: 'Category', Value: profile.qualityScoreCategory ?? 'N/A' },
        { Metric: 'Duplicate Rows', Value: profile.duplicateRowCount || 0 },
        { Metric: 'Duplicate Row %', Value: profile.duplicateRowPercentage || 0 }
      ]
    };

    const columnsArr = Object.values(profile.columns);

    // Column Profile Sheet
    const profileSheet = {
      sheetName: 'Column Profile',
      columns: [
        { name: 'Column Name' }, { name: 'Data Type' }, { name: 'Missing %' },
        { name: 'Unique %' }, { name: 'Type Consistency %' }, { name: 'Quality Status' }
      ],
      rows: columnsArr.map(c => ({
        'Column Name': c.columnName,
        'Data Type': c.dataType,
        'Missing %': c.missingPercentage || 0,
        'Unique %': c.uniquePercentage || 0,
        'Type Consistency %': c.typeConsistencyPercentage || 100,
        'Quality Status': c.qualityStatus || 'Good'
      }))
    };

    // Missing Values Sheet
    const missingSheet = {
      sheetName: 'Missing Values',
      columns: [
        { name: 'Column Name' }, { name: 'Null Count' }, { name: 'Empty String Count' },
        { name: 'Whitespace Count' }, { name: 'Total Missing Count' }, { name: 'Missing %' }
      ],
      rows: columnsArr.map(c => ({
        'Column Name': c.columnName,
        'Null Count': c.nullCount,
        'Empty String Count': c.emptyStringCount || 0,
        'Whitespace Count': c.whitespaceCount || 0,
        'Total Missing Count': c.missingCount || 0,
        'Missing %': c.missingPercentage || 0
      }))
    };

    // Numeric Profile Sheet
    const numericSheet = {
      sheetName: 'Numeric Profile',
      columns: [
        { name: 'Column Name' }, { name: 'Min' }, { name: 'Max' }, { name: 'Average' },
        { name: 'Median' }, { name: 'Zero Count' }, { name: 'Negative Count' }, { name: 'Outlier Count' }
      ],
      rows: columnsArr.filter(c => c.dataType === 'numeric' || c.dataType === 'integer').map(c => ({
        'Column Name': c.columnName,
        'Min': c.min,
        'Max': c.max,
        'Average': c.average,
        'Median': c.median,
        'Zero Count': c.zeroCount || 0,
        'Negative Count': c.negativeCount || 0,
        'Outlier Count': c.outlierCount || 0
      }))
    };

    // Date Quality Sheet
    const dateSheet = {
      sheetName: 'Date Quality',
      columns: [
        { name: 'Column Name' }, { name: 'Earliest Date' }, { name: 'Latest Date' }, 
        { name: 'Invalid Dates' }, { name: 'Future Dates' }
      ],
      rows: columnsArr.filter(c => c.dataType === 'date' || c.dataType === 'timestamp').map(c => ({
        'Column Name': c.columnName,
        'Earliest Date': c.earliestDate,
        'Latest Date': c.latestDate,
        'Invalid Dates': c.invalidDateCount || 0,
        'Future Dates': c.futureDateCount || 0
      }))
    };
    
    // Duplicate Analysis Sheet
    const duplicateSheet = {
      sheetName: 'Duplicate Analysis',
      columns: [{ name: 'Metric' }, { name: 'Value' }],
      rows: [
        { Metric: 'Duplicate Row Count', Value: profile.duplicateRowCount || 0 },
        { Metric: 'Duplicate Row Percentage', Value: profile.duplicateRowPercentage || 0 }
      ]
    };

    // Issues Sheet
    const issuesSheet = {
      sheetName: 'Issues',
      columns: [
        { name: 'Severity' }, { name: 'Column' }, { name: 'Issue' },
        { name: 'Affected Rows' }, { name: 'Affected %' }, { name: 'Recommendation' }
      ],
      rows: (profile.issues || []).map(i => ({
        'Severity': i.severity,
        'Column': i.column,
        'Issue': i.issue,
        'Affected Rows': i.affectedRowCount,
        'Affected %': i.affectedPercentage,
        'Recommendation': i.recommendedAction
      }))
    };

    try {
      ExcelExportService.exportMultiSheetExcel(
        [summarySheet, profileSheet, missingSheet, numericSheet, dateSheet, duplicateSheet, issuesSheet],
        { filename: `${profile.datasetName}_data_quality.xlsx`, sourceName: profile.datasetName }
      );
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  };

  const handleInspectIssue = async (issue: QualityIssue) => {
    if (!selectedTable) return;
    setInspectingIssue(issue);
    setIsLoadingSamples(true);
    setSampleRows([]);

    try {
      // Build a simple query to fetch sample rows based on the issue
      let whereClause = '';
      const col = `"${issue.column}"`;
      
      if (issue.issue.toLowerCase().includes('missing')) {
        whereClause = `WHERE ${col} IS NULL OR ${col} = ''`;
      } else if (issue.issue.toLowerCase().includes('whitespace')) {
        whereClause = `WHERE ${col} LIKE ' %' OR ${col} LIKE '% '`;
      } else if (issue.issue.toLowerCase().includes('negative')) {
        whereClause = `WHERE ${col} < 0`;
      } else if (issue.issue.toLowerCase().includes('outlier')) {
        whereClause = `WHERE ${col} IS NOT NULL`; // Fallback, would need actual bounds
      } else if (issue.issue.toLowerCase().includes('future date')) {
        whereClause = `WHERE ${col} > CURRENT_DATE`;
      } else {
        whereClause = `WHERE ${col} IS NOT NULL`; 
      }

      const sql = `SELECT * FROM ${selectedTable.schema ? `"${selectedTable.schema}".` : ''}"${selectedTable.name}" ${whereClause} LIMIT 100`;
      
      const result = await DatabaseApiClient.executeQuery(sql, 100, undefined);
      if (result && result.rows) {
        setSampleRows(result.rows);
      }
    } catch (err) {
      console.error('Failed to load sample rows', err);
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const generateAiRecommendations = async () => {
    if (!profile) return;
    setIsGeneratingAi(true);
    try {
      const summary = {
        score: profile.overallQualityScore,
        rows: profile.totalRows,
        issues: profile.issues?.map(i => `${i.severity} on ${i.column}: ${i.issue} (${i.affectedPercentage}%)`)
      };
      
      const res = await fetch('/api/database/ai/data-quality-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      setAiRecommendations(data.data);
    } catch (err) {
      setAiRecommendations('Failed to generate AI recommendations. Please check your API key and connection.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return 'text-slate-400';
    if (score >= 90) return 'text-emerald-400';
    if (score >= 75) return 'text-amber-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-rose-400';
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <p>Profiling data quality (may take a moment for large datasets)...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-rose-400 space-y-2">
          <ShieldX className="w-12 h-12 mb-2 opacity-50" />
          <p className="font-semibold text-lg">Profiling Failed</p>
          <p className="text-sm opacity-80">{error}</p>
          <button 
            onClick={() => {
              const src = dataset?.tableName || selectedTable?.name;
              const sch = dataset ? 'imported' : (selectedTable?.schema || 'imported');
              if (src && sch) loadProfile(sch, src);
            }}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    if (!profile) {
      return (
        <div id="data-quality-empty-state" className="flex flex-col items-center justify-center h-full p-8 text-center select-none">
          <div className="max-w-lg w-full flex flex-col items-center">
            <DataQualityEmptyStateIllustration className="w-full max-w-sm sm:max-w-md h-auto mb-6" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
              No Data Source Selected
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
              Select a table or imported dataset from the sidebar to inspect its Data Quality profile.
            </p>
          </div>
        </div>
      );
    }

    const filteredColumns = Object.values(profile.columns).filter(c => 
      c.columnName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="h-full flex flex-col">
        {/* Score Card Section */}
        <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-4 gap-4 p-6 pb-0">
          <div className="col-span-1 md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center">
            <div className={`text-5xl font-bold ${getScoreColor(profile.overallQualityScore)}`}>
              {profile.overallQualityScore ?? '--'}
            </div>
            <div className="text-sm font-semibold text-slate-300 mt-2 uppercase tracking-wider">
              {profile.qualityScoreCategory || 'Unknown'} Quality
            </div>
            <div className="text-xs text-slate-500 mt-1 text-center">Overall Health Score</div>
            {profile.isSampled ? (
              <div className="mt-2 text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full font-medium text-center">
                Sampled ({profile.rowsAnalyzed?.toLocaleString()} rows, {profile.samplePercentage}%)
              </div>
            ) : (
              <div className="mt-2 text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-medium text-center">
                Exact (100% Analyzed)
              </div>
            )}
          </div>
          
          <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <Hash className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Rows</span>
              </div>
              <div className="text-2xl font-bold text-white">{profile.totalRows.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <Table2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Columns</span>
              </div>
              <div className="text-2xl font-bold text-white">{profile.totalColumns.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <Copy className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Duplicated Rows</span>
              </div>
              <div className={`text-2xl font-bold ${profile.duplicateRowCount ? 'text-rose-400' : 'text-emerald-400'}`}>
                {profile.duplicateRowCount?.toLocaleString() || '0'}
                <span className="text-sm ml-1 opacity-70">({profile.duplicateRowPercentage || 0}%)</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Critical Issues</span>
              </div>
              <div className="text-2xl font-bold text-rose-400">
                {profile.issues?.filter(i => i.severity === 'Critical').length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex-shrink-0 flex border-b border-slate-800 px-6 mt-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'columns', label: 'Column Profile' },
            { id: 'missing', label: 'Missing Values' },
            { id: 'duplicates', label: 'Duplicates' },
            { id: 'numeric', label: 'Numeric Quality' },
            { id: 'dates', label: 'Date Quality' },
            { id: 'issues', label: 'Issues', badge: profile.issues?.length },
            { id: 'ai', label: 'AI Recommendations' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center space-x-2 ${
                activeTab === tab.id ? 'border-rose-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="bg-rose-500/20 text-rose-400 py-0.5 px-2 rounded-full text-[10px]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* OVERVIEW / COLUMN PROFILE */}
          {(activeTab === 'overview' || activeTab === 'columns') && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search columns..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500 w-64 transition-colors"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={handleExportCSV} className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700">
                    <FileText className="w-3.5 h-3.5" /> <span>CSV</span>
                  </button>
                  <button onClick={handleExportJSON} className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700">
                    <FileJson className="w-3.5 h-3.5" /> <span>JSON</span>
                  </button>
                  <button onClick={handleExportExcel} className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs rounded border border-slate-700">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> <span>Excel</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex space-x-6 min-h-0">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                  <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Column</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Missing %</th>
                          <th className="px-4 py-3 font-semibold">Unique %</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          {activeTab === 'columns' && <th className="px-4 py-3 font-semibold">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredColumns.map(col => (
                          <tr key={col.columnName} className={`hover:bg-slate-800/30 transition-colors ${selectedColumn === col.columnName ? 'bg-slate-800/50' : ''}`}>
                            <td className="px-4 py-3 font-mono text-emerald-300">{col.columnName}</td>
                            <td className="px-4 py-3 text-slate-300">{col.dataType}</td>
                            <td className="px-4 py-3">
                              <span className={`${(col.missingPercentage || 0) > 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {col.missingPercentage || 0}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{col.uniquePercentage}%</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                col.qualityStatus === 'Good' ? 'bg-emerald-500/10 text-emerald-400' :
                                col.qualityStatus === 'Warning' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-rose-500/10 text-rose-400'
                              }`}>
                                {col.qualityStatus || 'Good'}
                              </span>
                            </td>
                            {activeTab === 'columns' && (
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedColumn(col.columnName)}
                                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center"
                                >
                                  Details <ChevronRight className="w-3 h-3 ml-1" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Column Detail Panel */}
                {activeTab === 'columns' && selectedColumn && profile.columns[selectedColumn] && (
                  <div className="w-80 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">{selectedColumn}</h3>
                      <button onClick={() => setSelectedColumn(null)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-4 text-sm">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <div className="flex justify-between mb-1"><span className="text-slate-400">Data Type</span><span className="text-slate-200">{profile.columns[selectedColumn].dataType}</span></div>
                        <div className="flex justify-between mb-1"><span className="text-slate-400">Quality Status</span><span className={getScoreColor(profile.columns[selectedColumn].qualityStatus === 'Good' ? 100 : profile.columns[selectedColumn].qualityStatus === 'Warning' ? 75 : 0)}>{profile.columns[selectedColumn].qualityStatus}</span></div>
                        <div className="flex justify-between mb-1"><span className="text-slate-400">Missing %</span><span className="text-slate-200">{profile.columns[selectedColumn].missingPercentage}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Unique %</span><span className="text-slate-200">{profile.columns[selectedColumn].uniquePercentage}%</span></div>
                      </div>

                      {['numeric', 'integer'].includes(profile.columns[selectedColumn].dataType) && (
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Numeric Stats</h4>
                          <div className="flex justify-between mb-1"><span className="text-slate-400">Min</span><span className="text-slate-200">{String(profile.columns[selectedColumn].min ?? 'N/A')}</span></div>
                          <div className="flex justify-between mb-1"><span className="text-slate-400">Max</span><span className="text-slate-200">{String(profile.columns[selectedColumn].max ?? 'N/A')}</span></div>
                          <div className="flex justify-between mb-1"><span className="text-slate-400">Average</span><span className="text-slate-200">{String(profile.columns[selectedColumn].average ?? 'N/A')}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Outliers</span><span className="text-slate-200">{profile.columns[selectedColumn].outlierCount || 0}</span></div>
                        </div>
                      )}

                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Sample Values</h4>
                        <div className="space-y-1">
                          {profile.columns[selectedColumn].sampleValues?.slice(0, 5).map((val, i) => (
                            <div key={i} className="text-xs text-slate-300 truncate bg-slate-900 px-2 py-1 rounded">
                              {String(val === null ? 'NULL' : val === '' ? '"" (Empty)' : val)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MISSING VALUES */}
          {activeTab === 'missing' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Column</th>
                    <th className="px-4 py-3 font-semibold">Total Missing</th>
                    <th className="px-4 py-3 font-semibold">Missing %</th>
                    <th className="px-4 py-3 font-semibold">Null Count</th>
                    <th className="px-4 py-3 font-semibold">Empty String</th>
                    <th className="px-4 py-3 font-semibold">Whitespace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {Object.values(profile.columns).sort((a,b) => (b.missingPercentage || 0) - (a.missingPercentage || 0)).map(col => (
                    <tr key={col.columnName} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-emerald-300">{col.columnName}</td>
                      <td className="px-4 py-3 text-slate-300">{col.missingCount || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${(col.missingPercentage||0) > 10 ? 'bg-rose-500' : (col.missingPercentage||0) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(col.missingPercentage || 0, 100)}%` }} 
                            />
                          </div>
                          <span className="text-xs">{col.missingPercentage || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{col.nullCount}</td>
                      <td className="px-4 py-3 text-slate-400">{col.emptyStringCount || 0}</td>
                      <td className="px-4 py-3 text-slate-400">{col.whitespaceCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DUPLICATES */}
          {activeTab === 'duplicates' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-center">
                  <div className="flex items-center space-x-2 text-slate-400 mb-2">
                    <Copy className="w-5 h-5" />
                    <span className="font-semibold uppercase">Total Duplicate Rows</span>
                  </div>
                  <div className={`text-4xl font-bold ${profile.duplicateRowCount ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {profile.duplicateRowCount?.toLocaleString() || '0'}
                  </div>
                  <div className="text-sm text-slate-500 mt-2">
                    Rows that are exact copies of another row across all columns.
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-center">
                  <div className="flex items-center space-x-2 text-slate-400 mb-2">
                    <ListFilter className="w-5 h-5" />
                    <span className="font-semibold uppercase">Duplicate Percentage</span>
                  </div>
                  <div className={`text-4xl font-bold ${profile.duplicateRowPercentage ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {profile.duplicateRowPercentage || 0}%
                  </div>
                  <div className="text-sm text-slate-500 mt-2">
                    Percentage of the dataset containing exact duplicates.
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Column</th>
                      <th className="px-4 py-3 font-semibold">Unique %</th>
                      <th className="px-4 py-3 font-semibold">Duplicate Suspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {Object.values(profile.columns).filter(c => c.uniquePercentage < 100).sort((a,b) => b.uniquePercentage - a.uniquePercentage).map(col => (
                      <tr key={col.columnName} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-emerald-300">{col.columnName}</td>
                        <td className="px-4 py-3 text-slate-400">{col.uniquePercentage}%</td>
                        <td className="px-4 py-3">
                          {col.uniquePercentage > 95 && col.uniquePercentage < 100 ? (
                            <span className="text-amber-400 text-xs">Possible PK Duplicates</span>
                          ) : (
                            <span className="text-slate-500 text-xs">Standard distribution</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* NUMERIC QUALITY */}
          {activeTab === 'numeric' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Numeric Column</th>
                    <th className="px-4 py-3 font-semibold">Min</th>
                    <th className="px-4 py-3 font-semibold">Max</th>
                    <th className="px-4 py-3 font-semibold">Average</th>
                    <th className="px-4 py-3 font-semibold">Zeros</th>
                    <th className="px-4 py-3 font-semibold">Negatives</th>
                    <th className="px-4 py-3 font-semibold">Outliers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {Object.values(profile.columns).filter(c => c.dataType === 'numeric' || c.dataType === 'integer').map(col => (
                    <tr key={col.columnName} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-emerald-300">{col.columnName}</td>
                      <td className="px-4 py-3 text-slate-300">{String(col.min ?? '--')}</td>
                      <td className="px-4 py-3 text-slate-300">{String(col.max ?? '--')}</td>
                      <td className="px-4 py-3 text-slate-300">{String(col.average ?? '--')}</td>
                      <td className="px-4 py-3 text-slate-400">{col.zeroCount || 0}</td>
                      <td className="px-4 py-3 text-slate-400">{col.negativeCount || 0}</td>
                      <td className="px-4 py-3">
                        <span className={(col.outlierCount || 0) > 0 ? 'text-amber-400' : 'text-slate-400'}>
                          {col.outlierCount || 0} ({col.outlierPercentage || 0}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                  {Object.values(profile.columns).filter(c => c.dataType === 'numeric' || c.dataType === 'integer').length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No numeric columns found in this dataset.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* DATE QUALITY */}
          {activeTab === 'dates' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date Column</th>
                    <th className="px-4 py-3 font-semibold">Earliest Date</th>
                    <th className="px-4 py-3 font-semibold">Latest Date</th>
                    <th className="px-4 py-3 font-semibold">Invalid Dates</th>
                    <th className="px-4 py-3 font-semibold">Future Dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {Object.values(profile.columns).filter(c => c.dataType === 'date' || c.dataType === 'timestamp').map(col => (
                    <tr key={col.columnName} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-emerald-300">{col.columnName}</td>
                      <td className="px-4 py-3 text-slate-300">{col.earliestDate || '--'}</td>
                      <td className="px-4 py-3 text-slate-300">{col.latestDate || '--'}</td>
                      <td className="px-4 py-3">
                        <span className={(col.invalidDateCount || 0) > 0 ? 'text-rose-400' : 'text-slate-400'}>
                          {col.invalidDateCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={(col.futureDateCount || 0) > 0 ? 'text-amber-400' : 'text-slate-400'}>
                          {col.futureDateCount || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {Object.values(profile.columns).filter(c => c.dataType === 'date' || c.dataType === 'timestamp').length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No date columns found in this dataset.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ISSUES & INSPECT ROWS */}
          {activeTab === 'issues' && (
            <div className="flex h-full space-x-6 min-h-0">
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                {!profile.issues || profile.issues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-slate-800 rounded-xl bg-slate-900 border-dashed">
                    <ShieldCheck className="w-12 h-12 mb-3 text-emerald-500/50" />
                    <p className="font-semibold text-white">No Issues Detected</p>
                    <p className="text-sm mt-1">This dataset appears to have excellent data quality.</p>
                  </div>
                ) : (
                  profile.issues.map((issue, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border flex flex-col space-y-3 ${
                      inspectingIssue === issue ? 'ring-1 ring-rose-500/50' : ''
                    } ${
                      issue.severity === 'Critical' ? 'bg-rose-950/20 border-rose-900/50' :
                      issue.severity === 'Warning' ? 'bg-amber-950/20 border-amber-900/50' :
                      'bg-slate-900 border-slate-800'
                    }`}>
                      <div className="flex items-start space-x-4">
                        {issue.severity === 'Critical' && <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />}
                        {issue.severity === 'Warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
                        {issue.severity === 'Info' && <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-white">{issue.column}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                              issue.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                              issue.severity === 'Warning' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 mt-1.5 leading-relaxed break-words">{issue.issue}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-slate-400">
                            <div className="flex items-center space-x-1"><Hash className="w-3.5 h-3.5" /> <span>Affected: {issue.affectedRowCount?.toLocaleString()} ({issue.affectedPercentage}%)</span></div>
                            <div className="flex items-center space-x-1"><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">Rec: {issue.recommendedAction}</span></div>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleInspectIssue(issue)}
                          className="flex-shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded border border-slate-700 transition-colors flex items-center space-x-1"
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          <span>Inspect Rows</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Inspection Panel */}
              {inspectingIssue && (
                <div className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                      <ListFilter className="w-4 h-4 text-rose-400" />
                      <span>Inspecting: {inspectingIssue.column}</span>
                    </h3>
                    <button onClick={() => setInspectingIssue(null)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4">
                    {isLoadingSamples ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
                        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                        <span className="text-sm">Fetching affected rows (read-only)...</span>
                      </div>
                    ) : sampleRows.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                        <Info className="w-8 h-8 opacity-50" />
                        <span className="text-sm text-center">No sample rows could be fetched for this issue.<br/>Query execution might be limited or empty.</span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-800 overflow-x-auto max-w-full">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-950/80 text-slate-400">
                            <tr>
                              {Object.keys(sampleRows[0] || {}).slice(0, 8).map(k => (
                                <th key={k} className="px-3 py-2 font-semibold border-b border-slate-800">{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {sampleRows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-800/30">
                                {Object.keys(sampleRows[0] || {}).slice(0, 8).map((k, cIdx) => (
                                  <td key={cIdx} className={`px-3 py-2 ${k === inspectingIssue.column ? 'text-rose-300 font-medium bg-rose-500/5' : 'text-slate-300'}`}>
                                    {String(row[k] ?? 'NULL')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-xs text-slate-500 text-center flex items-center justify-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Read-only sample view. Max 100 rows shown.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI RECOMMENDATIONS */}
          {activeTab === 'ai' && (
            <div className="max-w-3xl mx-auto mt-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                      <Brain className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">AI Quality Recommendations</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Automated cleanup and transformation suggestions based on profiling.</p>
                    </div>
                  </div>
                  <button 
                    onClick={generateAiRecommendations}
                    disabled={isGeneratingAi}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isGeneratingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    <span>{aiRecommendations ? 'Regenerate' : 'Generate Suggestions'}</span>
                  </button>
                </div>

                {isGeneratingAi ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
                      <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full" />
                    </div>
                    <p className="text-slate-400 text-sm animate-pulse">Analyzing profile metadata and identifying optimization strategies...</p>
                  </div>
                ) : aiRecommendations ? (
                  <div className="prose prose-invert max-w-none text-sm text-slate-300 leading-relaxed">
                    {aiRecommendations.split('\\n').map((line, i) => (
                      <p key={i} className="mb-2">{line.replace(/\\*\\*/g, '').replace(/\\*/g, '•')}</p>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                      <Brain className="w-8 h-8 text-slate-500" />
                    </div>
                    <h4 className="text-slate-300 font-medium mb-2">Ready to Analyze</h4>
                    <p className="text-slate-500 text-sm max-w-md">
                      Click the button above to generate intelligent data cleaning and schema optimization recommendations based on the detected quality issues.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>Data Quality</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-emerald-400 font-mono text-base">{selectedTable?.name || 'No Source Selected'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated profiling, anomaly detection, and data health scoring.
                </p>
              </div>
            </div>
            {selectedTable && (
              <button
                onClick={() => loadProfile(selectedTable.schema, selectedTable.name)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center space-x-2 text-xs font-medium"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Profile</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
