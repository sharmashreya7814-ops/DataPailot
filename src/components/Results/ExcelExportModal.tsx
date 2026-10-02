import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Layers,
  CheckCircle,
  AlertTriangle,
  X,
  FilePlus,
  ArrowLeft,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { ExcelExportService } from '../../services/excelExportService';
import { ExcelWorkbookSession, WorkbookSheetEntry } from '../../services/excelWorkbookSession';
import { QueryResultColumn } from '../../types/database';

export interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  sourceName?: string;
  sqlQuery?: string;
  analysisName?: string;
  onDownloadSingle: () => void;
}

type ModalStep = 'choice' | 'configure' | 'success';

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  columns,
  rows,
  sourceName,
  sqlQuery,
  analysisName,
  onDownloadSingle
}) => {
  const session = ExcelWorkbookSession.getInstance();

  const [step, setStep] = useState<ModalStep>('choice');
  const [sheetName, setSheetName] = useState<string>('');
  const [addedSheetName, setAddedSheetName] = useState<string>('');
  const [sessionSheets, setSessionSheets] = useState<WorkbookSheetEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloadingWorkbook, setIsDownloadingWorkbook] = useState(false);

  // Initialize or reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setSessionSheets(session.getSheets());
      setErrorMessage(null);
      setStep('choice');

      // Pre-fill a sensible worksheet name based on analysis, SQL, or source
      const suggestedBase = ExcelExportService.suggestSheetName({
        analysisName,
        sourceName,
        sql: sqlQuery,
        columns
      });
      const uniqueName = session.getUniqueSheetName(suggestedBase);
      setSheetName(uniqueName);
    }
  }, [isOpen, analysisName, sourceName, sqlQuery, columns]);

  // Handle keyboard Escape dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDuplicate = session.hasSheet(sheetName);
  const suggestedSafeName = session.getUniqueSheetName(sheetName || 'Analysis');

  const handleDownloadSingle = () => {
    onDownloadSingle();
    onClose();
  };

  const handleStartAddToWorkbook = () => {
    setErrorMessage(null);
    const suggestedBase = ExcelExportService.suggestSheetName({
      analysisName,
      sourceName,
      sql: sqlQuery,
      columns
    });
    setSheetName(session.getUniqueSheetName(suggestedBase));
    setStep('configure');
  };

  const handleConfirmAddSheet = () => {
    setErrorMessage(null);
    if (!sheetName.trim()) {
      setErrorMessage('Please enter a worksheet name.');
      return;
    }

    const addResult = session.addSheet(sheetName, columns, rows);
    if (!addResult.success) {
      setErrorMessage(addResult.error || 'Failed to add worksheet to workbook.');
      return;
    }

    setAddedSheetName(addResult.sheetName);
    setSessionSheets(session.getSheets());
    setStep('success');
  };

  const handleDownloadCompleteWorkbook = () => {
    try {
      setIsDownloadingWorkbook(true);
      session.downloadWorkbook();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download workbook.';
      setErrorMessage(msg);
    } finally {
      setIsDownloadingWorkbook(false);
    }
  };

  const handleResetSession = () => {
    session.clearSession();
    setSessionSheets([]);
    setStep('choice');
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-export-title"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-200 animate-in fade-in-50 zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 id="excel-export-title" className="text-sm font-bold text-white">
                {step === 'choice' && 'Export Result to Excel'}
                {step === 'configure' && 'Add Worksheet to Excel'}
                {step === 'success' && 'Workbook Updated'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'choice' && 'Choose your export mode for this query result.'}
                {step === 'configure' && 'Customize the worksheet name before adding.'}
                {step === 'success' && `Result added to ${session.getWorkbookName()}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* STEP 1: CHOICE SCREEN */}
          {step === 'choice' && (
            <div className="space-y-4">
              {/* Active Session Status Notice if sheets exist */}
              {sessionSheets.length > 0 && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Current Workbook Session:
                      </span>{' '}
                      <span className="font-mono text-slate-300">
                        {session.getWorkbookName()}
                      </span>{' '}
                      <span className="text-emerald-400 font-semibold">
                        ({sessionSheets.length} sheet{sessionSheets.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadCompleteWorkbook}
                    disabled={isDownloadingWorkbook}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-[11px] font-medium transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              )}

              {/* Two Clear Choices */}
              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: Download Excel */}
                <button
                  id="btn-excel-download-single"
                  type="button"
                  onClick={handleDownloadSingle}
                  className="flex items-start text-left p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/80 hover:border-emerald-500/40 transition-all group"
                >
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mr-3.5 group-hover:scale-105 transition-transform flex-shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                        1. Download Excel
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        New File (.xlsx)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Download the current query and analysis result immediately as a new standalone Excel spreadsheet.
                    </p>
                  </div>
                </button>

                {/* Option 2: Add to Existing Excel */}
                <button
                  id="btn-excel-add-to-workbook"
                  type="button"
                  onClick={handleStartAddToWorkbook}
                  className="flex items-start text-left p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/80 hover:border-indigo-500/40 transition-all group"
                >
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mr-3.5 group-hover:scale-105 transition-transform flex-shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        2. Add to Existing Excel
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {sessionSheets.length > 0
                          ? `${sessionSheets.length} sheet${sessionSheets.length !== 1 ? 's' : ''} in session`
                          : 'Multi-Sheet Workbook'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Build a consolidated Excel workbook containing multiple analysis results as separate sheets without losing original data.
                    </p>
                  </div>
                </button>
              </div>

              {/* Result Preview Summary */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 font-mono">
                <span>Result: {columns.length} columns, {rows.length} rows</span>
                <span>{sourceName ? `Source: ${sourceName}` : 'Analytical Query'}</span>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURE WORKSHEET NAME */}
          {step === 'configure' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="sheet-name-input"
                  className="text-xs font-semibold text-slate-300 block flex items-center justify-between"
                >
                  <span>Worksheet Name:</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {sheetName.length}/31 chars
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="sheet-name-input"
                    type="text"
                    maxLength={31}
                    value={sheetName}
                    onChange={e => {
                      setSheetName(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="e.g. Gender Analysis"
                    className={`w-full bg-slate-950 border ${
                      isDuplicate
                        ? 'border-amber-500/60 text-amber-200'
                        : 'border-slate-800 text-slate-200'
                    } rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors`}
                    autoFocus
                  />
                  {sheetName && (
                    <button
                      type="button"
                      onClick={() => setSheetName('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Duplicate Sheet Warning with One-Click Safe Alternative */}
                {isDuplicate && (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-amber-300 animate-in fade-in-50">
                    <div className="flex items-center space-x-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Worksheet name already exists in this workbook</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80">
                      To prevent accidental overwrite, please choose a unique name or use the suggestion below:
                    </p>
                    <button
                      type="button"
                      onClick={() => setSheetName(suggestedSafeName)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-mono transition-colors"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Use &quot;{suggestedSafeName}&quot;</span>
                    </button>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Workbook & Data Summary */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Target Workbook:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {session.getWorkbookName()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Current Workbook Sheets:</span>
                  <span className="font-mono text-indigo-300">
                    {sessionSheets.length === 0
                      ? 'First sheet'
                      : `${sessionSheets.length} sheet${sessionSheets.length !== 1 ? 's' : ''} (${sessionSheets.map(s => s.sheetName).join(', ')})`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Data to Append:</span>
                  <span className="font-mono text-emerald-400 font-medium">
                    {columns.length} columns, {rows.length} rows (original order preserved)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setStep('choice')}
                  className="flex items-center space-x-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg border border-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-confirm-add-sheet"
                    type="button"
                    onClick={handleConfirmAddSheet}
                    disabled={isDuplicate || !sheetName.trim()}
                    className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-md shadow-indigo-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Add to Workbook</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS & WORKBOOK OVERVIEW SCREEN */}
          {step === 'success' && (
            <div className="space-y-4">
              {/* Success Notification */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Added <strong className="font-semibold text-white">&quot;{addedSheetName}&quot;</strong> to workbook.
                </span>
              </div>

              {/* Workbook Sheets List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Workbook sheets:</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {sessionSheets.length} sheet{sessionSheets.length !== 1 ? 's' : ''} in total
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                  {sessionSheets.map((sh, idx) => (
                    <div
                      key={sh.sheetName}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-[10px] font-mono text-slate-500 w-4 text-center">
                          {idx + 1}.
                        </span>
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="font-medium text-slate-200 truncate">
                          {sh.sheetName}
                        </span>
                        {sh.sheetName === addedSheetName && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 ml-2 flex-shrink-0">
                        {sh.rowCount} rows · {sh.columnCount} cols
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleResetSession}
                  className="flex items-center space-x-1 text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                  title="Clear all sheets in session and start a new workbook"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Start New Workbook</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button
                    id="btn-add-another-result"
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg border border-slate-700 transition-colors"
                  >
                    Add Another Result
                  </button>
                  <button
                    id="btn-download-workbook"
                    type="button"
                    onClick={handleDownloadCompleteWorkbook}
                    disabled={isDownloadingWorkbook}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-md shadow-emerald-950/40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Workbook</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
