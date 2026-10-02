import { ExcelExportService } from './excelExportService';

export interface WorkbookSheetEntry {
  sheetName: string;
  columns: { name: string; dataType?: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columnCount: number;
  addedAt: number;
}

/**
 * Stateful singleton managing multi-sheet Excel workbook export sessions in the Analysis Toolkit.
 * Allows adding multiple analysis query results as separate worksheets into a single consolidated .xlsx workbook.
 */
export class ExcelWorkbookSession {
  private static instance: ExcelWorkbookSession;
  private sheets: WorkbookSheetEntry[] = [];
  private workbookName = 'DataPilot_Analysis.xlsx';

  private constructor() {}

  public static getInstance(): ExcelWorkbookSession {
    if (!ExcelWorkbookSession.instance) {
      ExcelWorkbookSession.instance = new ExcelWorkbookSession();
    }
    return ExcelWorkbookSession.instance;
  }

  /**
   * Returns a copy of all worksheets currently in the export session.
   */
  public getSheets(): WorkbookSheetEntry[] {
    return [...this.sheets];
  }

  /**
   * Returns list of sheet names currently in the workbook.
   */
  public getSheetNames(): string[] {
    return this.sheets.map(s => s.sheetName);
  }

  /**
   * Returns true if a worksheet with this name already exists (case-insensitive).
   */
  public hasSheet(name: string): boolean {
    const clean = ExcelExportService.sanitizeSheetName(name).toLowerCase();
    if (!clean) return false;
    return this.sheets.some(s => s.sheetName.toLowerCase() === clean);
  }

  /**
   * Generates a collision-free sheet name, e.g. "Gender Analysis (2)" if "Gender Analysis" exists.
   */
  public getUniqueSheetName(baseName: string): string {
    const cleanBase = ExcelExportService.sanitizeSheetName(baseName) || 'Analysis';
    if (!this.hasSheet(cleanBase)) {
      return cleanBase;
    }
    let counter = 2;
    while (this.hasSheet(`${cleanBase} (${counter})`)) {
      counter++;
    }
    return `${cleanBase} (${counter})`;
  }

  /**
   * Appends a new analysis result as a dedicated worksheet in the workbook.
   * Never overwrites or modifies existing sheets.
   * Preserves column order, row order, types, and values.
   */
  public addSheet(
    sheetName: string,
    columns: { name: string; dataType?: string }[],
    rows: Record<string, unknown>[]
  ): { success: boolean; sheetName: string; error?: string } {
    if (!sheetName || !sheetName.trim()) {
      return { success: false, sheetName: '', error: 'Worksheet name cannot be empty.' };
    }

    const cleanName = ExcelExportService.sanitizeSheetName(sheetName);
    if (!cleanName) {
      return { success: false, sheetName: '', error: 'Worksheet name contains invalid characters.' };
    }

    if (this.hasSheet(cleanName)) {
      const suggested = this.getUniqueSheetName(cleanName);
      return {
        success: false,
        sheetName: cleanName,
        error: `A worksheet named "${cleanName}" already exists. Suggested: "${suggested}"`
      };
    }

    if (!columns || columns.length === 0) {
      return { success: false, sheetName: cleanName, error: 'Cannot add a worksheet without columns.' };
    }

    // Preserve immutable copies of columns and rows
    const preservedColumns = columns.map(c => ({ ...c }));
    const preservedRows = (rows || []).map(r => ({ ...r }));

    this.sheets.push({
      sheetName: cleanName,
      columns: preservedColumns,
      rows: preservedRows,
      rowCount: preservedRows.length,
      columnCount: preservedColumns.length,
      addedAt: Date.now()
    });

    return { success: true, sheetName: cleanName };
  }

  /**
   * Removes a sheet by name.
   */
  public removeSheet(sheetName: string): boolean {
    const target = sheetName.trim().toLowerCase();
    const initialLen = this.sheets.length;
    this.sheets = this.sheets.filter(s => s.sheetName.toLowerCase() !== target);
    return this.sheets.length < initialLen;
  }

  /**
   * Clears the current export session so the user can start a fresh workbook.
   */
  public clearSession(): void {
    this.sheets = [];
    this.workbookName = 'DataPilot_Analysis.xlsx';
  }

  /**
   * Gets current workbook filename.
   */
  public getWorkbookName(): string {
    return this.workbookName;
  }

  /**
   * Updates workbook filename.
   */
  public setWorkbookName(name: string): void {
    if (name && name.trim()) {
      const sanitized = ExcelExportService.sanitizeFilename(name.trim());
      this.workbookName = sanitized.endsWith('.xlsx') ? sanitized : `${sanitized}.xlsx`;
    }
  }

  /**
   * Builds the multi-sheet Excel file and triggers a browser download.
   */
  public downloadWorkbook(filename?: string): Uint8Array {
    if (this.sheets.length === 0) {
      throw new Error('Workbook contains no sheets to download. Add at least one analysis result first.');
    }

    const outName = filename || this.workbookName || 'DataPilot_Analysis.xlsx';
    const exportResult = ExcelExportService.exportMultiSheetExcel(
      this.sheets.map(s => ({
        sheetName: s.sheetName,
        columns: s.columns,
        rows: s.rows
      })),
      { filename: outName }
    );

    ExcelExportService.triggerDownload(exportResult.buffer, exportResult.filename);
    return exportResult.buffer;
  }
}
