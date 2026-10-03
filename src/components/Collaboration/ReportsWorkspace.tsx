import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { Report, ReportSnapshot, ReportKPI } from '../../types/collaboration';
import {
  FileText,
  Plus,
  Camera,
  Download,
  Share2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  Clock,
  Printer,
  ChevronRight,
  Shield,
  Layers,
  History
} from 'lucide-react';
import { ShareResourceModal } from './ShareResourceModal';
import { ReportsEmptyStateIllustration } from './ReportsEmptyStateIllustration';

export const ReportsWorkspace: React.FC = () => {
  const { activeWorkspace, activeProject, can, user } = useCollaboration();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ReportSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New Report Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [kpi1Title, setKpi1Title] = useState('Total Analyzed Rows');
  const [kpi1Val, setKpi1Val] = useState('1,248,500');
  const [kpi1Change, setKpi1Change] = useState('+14.2% MoM');
  const [kpi2Title, setKpi2Title] = useState('Query Throughput');
  const [kpi2Val, setKpi2Val] = useState('142 queries/min');
  const [kpi2Change, setKpi2Change] = useState('+8.1%');
  const [kpi3Title, setKpi3Title] = useState('Data Quality Score');
  const [kpi3Val, setKpi3Val] = useState('99.4%');
  const [kpi3Change, setKpi3Change] = useState('+0.4%');
  const [narrativeText, setNarrativeText] = useState(
    '1. Cross-table aggregation verified zero data discrepancies.\n2. Ingestion pipeline throughput increased by 14.2% with optimal index utilization.\n3. Data quality checks passed with 99.4% validity across all columns.'
  );

  // Sharing modal state
  const [sharingReport, setSharingReport] = useState<Report | null>(null);

  useEffect(() => {
    setSelectedReport(null);
    setSelectedSnapshot(null);
    setReports([]);
    if (activeWorkspace) {
      loadReports();
    }
  }, [activeWorkspace?.id, activeProject?.id]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const res = await CollaborationApiClient.listReports(activeProject?.id);
      if (res.success) {
        setReports(res.reports);
        if (res.reports.length > 0) {
          selectReport(res.reports[0]);
        } else {
          setSelectedReport(null);
        }
      }
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectReport = async (report: Report) => {
    setSelectedReport(report);
    setSelectedSnapshot(null);
    const snapRes = await CollaborationApiClient.listSnapshots(report.id);
    if (snapRes.success) {
      setSnapshots(snapRes.snapshots);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const kpis: ReportKPI[] = [
      { id: 'k1', title: kpi1Title, value: kpi1Val, change: kpi1Change, isPositive: true },
      { id: 'k2', title: kpi2Title, value: kpi2Val, change: kpi2Change, isPositive: true },
      { id: 'k3', title: kpi3Title, value: kpi3Val, change: kpi3Change, isPositive: true }
    ];

    const narrativeInsights = narrativeText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const res = await CollaborationApiClient.createReport({
      title: newTitle.trim(),
      description: newDescription.trim(),
      projectId: activeProject?.id,
      kpis,
      narrativeInsights
    });

    if (res.success && res.report) {
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      await loadReports();
      selectReport(res.report);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!selectedReport) return;
    const title = prompt(
      'Enter Snapshot Title (Point-in-Time Freeze):',
      `${selectedReport.title} — Snapshot ${new Date().toLocaleDateString()}`
    );
    if (!title) return;

    const res = await CollaborationApiClient.createSnapshot(selectedReport.id, title);
    if (res.success && res.snapshot) {
      const snapRes = await CollaborationApiClient.listSnapshots(selectedReport.id);
      if (snapRes.success) {
        setSnapshots(snapRes.snapshots);
        setSelectedSnapshot(res.snapshot);
      }
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    const res = await CollaborationApiClient.deleteReport(reportId);
    if (res.success) {
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
      await loadReports();
    }
  };

  const displayedKpis = selectedSnapshot?.metrics?.kpis || selectedReport?.kpis || [];
  const displayedNarratives = selectedSnapshot?.metrics?.narrativeInsights || selectedReport?.narrativeInsights || [];

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-950 text-slate-200">
      {/* Sidebar: Reports List */}
      <div className="w-72 border-r border-slate-800 bg-slate-900/60 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white">Executive Reports</span>
          </div>
          {can('report.create') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1 rounded-md bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs flex items-center space-x-1 transition-colors"
              title="Create new executive report"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {reports.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No reports yet.
            </div>
          ) : (
            reports.map(r => (
              <button
                key={r.id}
                onClick={() => selectReport(r)}
                className={`w-full p-2.5 rounded-lg text-left text-xs transition-colors flex items-center justify-between group ${
                  selectedReport?.id === r.id
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                    : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-white truncate">{r.title}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    By {r.generatedByName || 'User'} &bull; {new Date(r.generatedAt).toLocaleDateString()}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Report Viewer */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {!selectedReport ? (
          reports.length === 0 ? (
            <div id="reports-empty-state" className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
              <div className="max-w-lg w-full flex flex-col items-center">
                <ReportsEmptyStateIllustration className="w-full max-w-sm sm:max-w-md h-auto mb-6" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mb-2">
                  No Executive Reports Yet
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed mb-6">
                  Create your first report to turn your data into clear KPIs, insights, and snapshots.
                </p>
                {can('report.create') && (
                  <button
                    id="btn-create-first-report"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-cyan-600/25 transition-all cursor-pointer hover:scale-[1.02]"
                    title="Create your first executive report"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Create Report</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                <FileText className="w-5 h-5 stroke-[1.5]" />
              </div>
              <p className="text-slate-300 font-medium text-sm">Select an Executive Report</p>
              <p className="text-slate-500 max-w-xs text-xs">
                Choose a report from the sidebar to view KPIs, narrative insights, and point-in-time snapshots.
              </p>
            </div>
          )
        ) : (
          <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">{selectedReport.title}</h1>
                  {selectedSnapshot && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                      <Camera className="w-3 h-3" />
                      <span>Point-in-Time Snapshot</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Generated by <span className="text-slate-200">{selectedReport.generatedByName || user?.name}</span> &bull;{' '}
                  {new Date(selectedSnapshot?.snapshotTimestamp || selectedReport.generatedAt).toLocaleString()}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {can('report.create') && (
                  <button
                    onClick={handleCreateSnapshot}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors shadow-xs"
                    title="Freeze an immutable snapshot of this report"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Create Snapshot</span>
                  </button>
                )}

                {/* Export Dropdown / Buttons */}
                <a
                  href={`/api/reports/${selectedReport.id}/export?format=pdf&print=true`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Print / PDF</span>
                </a>

                <a
                  href={`/api/reports/${selectedReport.id}/export?format=markdown`}
                  download
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Markdown</span>
                </a>

                <a
                  href={`/api/reports/${selectedReport.id}/export?format=csv`}
                  download
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>CSV</span>
                </a>

                <button
                  onClick={() => setSharingReport(selectedReport)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  title="Share report with workspace members"
                >
                  <Share2 className="w-4 h-4 text-indigo-400" />
                </button>

                {can('report.create') && (
                  <button
                    onClick={() => handleDeleteReport(selectedReport.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                    title="Delete report"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Snapshot Selector Banner if snapshots exist */}
            {snapshots.length > 0 && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-slate-300 font-medium">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>Immutable Version History & Snapshots:</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedSnapshot(null)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      !selectedSnapshot ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Version
                  </button>
                  {snapshots.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSnapshot(s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        selectedSnapshot?.id === s.id
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {new Date(s.snapshotTimestamp).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {selectedReport.description && (
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                {selectedReport.description}
              </p>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayedKpis.map(kpi => (
                <div
                  key={kpi.id || kpi.title}
                  className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-2"
                >
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpi.title}</div>
                  <div className="text-2xl font-bold text-white">{kpi.value}</div>
                  {kpi.change && (
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{kpi.change}</span>
                      {kpi.subtitle && <span className="text-slate-500 text-[11px]">&bull; {kpi.subtitle}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Executive Narrative Insights */}
            <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Executive Findings & Narrative Insights</span>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed pl-2">
                {displayedNarratives.map((insight, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Create Report Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Generate Executive Report</span>
            </h3>

            <form onSubmit={handleCreateReport} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Report Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Q4 Growth & Revenue Analysis"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Executive Summary / Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="High-level background and summary..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500 resize-none"
                />
              </div>

              {/* KPI Builders */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300">Key Performance Indicators</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={kpi1Title}
                    onChange={e => setKpi1Title(e.target.value)}
                    className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                    placeholder="KPI 1 Title"
                  />
                  <input
                    type="text"
                    value={kpi1Val}
                    onChange={e => setKpi1Val(e.target.value)}
                    className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-bold"
                    placeholder="Value"
                  />
                  <input
                    type="text"
                    value={kpi1Change}
                    onChange={e => setKpi1Change(e.target.value)}
                    className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-emerald-400"
                    placeholder="Change"
                  />
                </div>
              </div>

              {/* Narrative Takeaways */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Narrative Takeaways (One per line)</label>
                <textarea
                  value={narrativeText}
                  onChange={e => setNarrativeText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  Create Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {sharingReport && (
        <ShareResourceModal
          isOpen={true}
          onClose={() => setSharingReport(null)}
          resourceType="report"
          resourceId={sharingReport.id}
          resourceTitle={sharingReport.title}
        />
      )}
    </div>
  );
};
