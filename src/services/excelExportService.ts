import * as XLSX from 'xlsx';

export interface ExportExcelOptions {
  filename?: string;
  sourceName?: string;
  sheetName?: string;
}

export interface ExportExcelResult {
  buffer: Uint8Array;
  filename: string;
  rowCount: number;
  columnCount: number;
}

/**
 * Service for securely generating and exporting query results as professional Excel (.xlsx) workbooks.
 */
export class ExcelExportService {
  public static exportMultiSheetExcel(
    sheets: { sheetName: string; columns: any[]; rows: any[] }[],
    options: { filename?: string; sourceName?: string } = {}
  ): ExportExcelResult {
    const filename = options.filename
      ? (options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`)
      : this.generateExcelFilename(options.sourceName);

    const workbook = XLSX.utils.book_new();
    let totalRowCount = 0;
    let totalColCount = 0;

    sheets.forEach((sheet, idx) => {
      const sanitizedSheetName = this.sanitizeSheetName(sheet.sheetName) || `Sheet${idx + 1}`;
      const headerRow = sheet.columns.map(c => c.name || c.columnName || String(c));
      const bodyRows = sheet.rows.map(row => 
        sheet.columns.map(col => {
          const key = col.name || col.columnName || String(col);
          return this.sanitizeCellForExcel(row[key]);
        })
      );

      const worksheetData = [headerRow, ...bodyRows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      const colWidths = sheet.columns.map((col, cIdx) => {
        let maxLen = (col.name || col.columnName || String(col)).length;
        for (let rIdx = 0; rIdx < bodyRows.length; rIdx++) {
          if (maxLen >= 60) break;
          const cellStr = String(bodyRows[rIdx][cIdx] || '');
          if (cellStr.length > maxLen) {
            maxLen = Math.min(cellStr.length, 60);
          }
        }
        return { wch: Math.max(maxLen + 2, 8) };
      });
      worksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedSheetName);
      
      totalRowCount += sheet.rows.length;
      totalColCount += sheet.columns.length;
    });

    const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const buffer = new Uint8Array(arrayBuffer);

    return {
      buffer,
      filename,
      rowCount: totalRowCount,
      columnCount: totalColCount
    };
  }

  /**
   * Sanitizes sheet names to Excel constraints (max 31 chars, no invalid chars : \ / ? * [ ]).
   */
  public static sanitizeSheetName(name: string): string {
    if (!name) return '';
    let clean = name.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
    clean = clean.replace(/^'+|'+$/g, '');
    return clean.substring(0, 31).trim();
  }

  /**
   * Generates a sensible worksheet name based on analysis metadata, query text, or table source.
   */
  public static suggestSheetName(params: {
    analysisName?: string;
    sourceName?: string;
    sql?: string;
    columns?: { name: string }[];
  } = {}): string {
    const { analysisName, sourceName, sql } = params;

    // 1. If explicit analysis name is given
    if (analysisName && analysisName.trim()) {
      const rawName = analysisName.trim();
      const catMatch = rawName.match(/Category Column \(([^)]+)\)/i);
      if (catMatch) {
        return this.sanitizeSheetName(`${this.formatName(catMatch[1])} Category`);
      }
      const calcMatch = rawName.match(/Calculated Column \(([^)]+)\)/i);
      if (calcMatch) {
        return this.sanitizeSheetName(`${this.formatName(calcMatch[1])} Analysis`);
      }
      if (rawName.toLowerCase() === 'filtered query') {
        const whereColMatch = sql?.match(/WHERE\s+["`\[]?([a-zA-Z0-9_]+)["`\]]?/i);
        if (whereColMatch) {
          return this.sanitizeSheetName(`${this.formatName(whereColMatch[1])} Analysis`);
        }
        return this.sanitizeSheetName(sourceName ? `${this.formatName(sourceName)} Filtered` : 'Filtered Data');
      }
      return this.sanitizeSheetName(rawName);
    }

    // 2. Inspect SQL Query for aggregations / groups / filters
    if (sql) {
      const groupByMatch = sql.match(/GROUP\s+BY\s+(?:["`\[]?[\w]+["`\]]?\.)?["`\[]?([a-zA-Z0-9_]+)["`\]]?/i);
      if (groupByMatch) {
        const groupCol = groupByMatch[1].toLowerCase();
        if (groupCol === 'gender') return 'Gender Analysis';
        if (groupCol === 'city') return 'City Analysis';
        if (groupCol === 'product') return 'Product Analysis';
        if (groupCol === 'region') return 'Regional Analysis';
        if (groupCol === 'category') return 'Category Analysis';
        if (groupCol === 'month' || groupCol === 'order_date') return 'Revenue by Month';
        return this.sanitizeSheetName(`${this.formatName(groupCol)} Analysis`);
      }

      const whereMatch = sql.match(/WHERE\s+(?:["`\[]?[\w]+["`\]]?\.)?["`\[]?([a-zA-Z0-9_]+)["`\]]?/i);
      if (whereMatch) {
        const whereCol = whereMatch[1].toLowerCase();
        if (whereCol === 'city') return 'City Analysis';
        if (whereCol === 'gender') return 'Gender Analysis';
        if (whereCol === 'product') return 'Product Analysis';
        return this.sanitizeSheetName(`${this.formatName(whereCol)} Analysis`);
      }

      if (/date_trunc|period|monthly|order_date/i.test(sql)) {
        return 'Revenue by Month';
      }
    }

    // 3. Fallback to Source Table Name
    if (sourceName && sourceName.trim()) {
      const lower = sourceName.toLowerCase();
      if (lower.includes('sales')) return 'Sales';
      if (lower.includes('order')) return 'Orders';
      if (lower.includes('customer')) return 'Customers';
      if (lower.includes('product')) return 'Products';
      return this.sanitizeSheetName(this.formatName(sourceName));
    }

    // 4. Default generic
    return 'Analysis Results';
  }

  private static formatName(str: string): string {
    return str
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  /**
   * Triggers a browser download of the supplied Excel binary buffer.
   */
  public static triggerDownload(buffer: Uint8Array, filename: string): void {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = safeFilename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  /**
   * Spreadsheet Formula Injection Protection (CWE-1236)
   * Values beginning with =, +, -, @, \t, or \r are prefixed with a single quote
   * so spreadsheet applications (Excel, LibreOffice, Google Sheets) treat them
   * strictly as text literals and never execute them as formulas or macros.
   */
  public static sanitizeCellForExcel(value: unknown): unknown {
    if (value === null || value === undefined) {
      return '';
    }

    // Number preservation (float/integer)
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return String(value); // 'NaN', 'Infinity', '-Infinity'
      }
      return value;
    }

    // Boolean preservation
    if (typeof value === 'boolean') {
      return value;
    }

    // BigInt preservation
    if (typeof value === 'bigint') {
      if (value >= -BigInt(Number.MAX_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(value);
      }
      return value.toString();
    }

    // Date preservation
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
    }

    // Object / Array representation
    if (typeof value === 'object') {
      try {
        const jsonStr = JSON.stringify(value);
        if (/^[=+\-@\t\r]/.test(jsonStr)) {
          return `'${jsonStr}`;
        }
        return jsonStr;
      } catch {
        return String(value);
      }
    }

    // String handling with formula injection protection
    const strVal = String(value);
    if (/^[=+\-@\t\r]/.test(strVal)) {
      return `'${strVal}`;
    }

    return strVal;
  }

  /**
   * Sanitizes a string for safe filesystem and filename use.
   * Strips path traversals, control characters, and illegal filename tokens.
   */
  public static sanitizeFilename(name: string): string {
    if (!name || typeof name !== 'string') return '';
    return name
      .replace(/[\x00-\x1f\x7f]/g, '') // remove control chars
      .replace(/[\\/:*?"<>|]/g, '_')   // remove Windows/Unix forbidden filename chars
      .replace(/\.{2,}/g, '_')          // prevent directory traversal (..)
      .replace(/[^\w.-]/g, '_')         // replace non-alphanumeric/dot/dash chars
      .replace(/_{2,}/g, '_')           // collapse consecutive underscores
      .replace(/^_+|_+$/g, '')          // trim leading and trailing underscores
      .slice(0, 60);                    // cap length
  }

  /**
   * Extracts primary table name from a SQL query string if present.
   */
  public static extractTableFromSql(sql?: string): string | null {
    if (!sql || typeof sql !== 'string') return null;
    // Matches: FROM "tableName", FROM [tableName], FROM `tableName`, FROM schema.tableName, FROM tableName
    const match = sql.match(/\bfrom\s+(?:["`\[]?[\w]+["`\]]?\.)?["`\[]?([a-zA-Z0-9_]+)["`\]]?/i);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  /**
   * Generates a safe filename for Excel export.
   * e.g., 'datapilot_query_results.xlsx' or '<source>_query_results.xlsx'
   */
  public static generateExcelFilename(source?: string): string {
    const cleanSource = this.sanitizeFilename(source || '');
    if (cleanSource) {
      return `${cleanSource}_query_results.xlsx`;
    }
    return 'datapilot_query_results.xlsx';
  }

  /**
   * Builds an in-memory XLSX Workbook from columns and rows.
   */
  public static buildWorkbook(
    columns: { name: string; dataType?: string }[],
    rows: Record<string, unknown>[],
    sheetName = 'Query Results'
  ): XLSX.WorkBook {
    if (!columns || columns.length === 0) {
      throw new Error('Cannot generate Excel workbook without column definitions.');
    }

    // Header row
    const headers = columns.map(c => c.name);

    // Data rows
    const dataRows = (rows || []).map(row => {
      return columns.map(col => {
        const rawVal = row[col.name];
        return this.sanitizeCellForExcel(rawVal);
      });
    });

    // Build worksheet with AoA (Array of Arrays)
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Calculate ergonomic column widths
    const colWidths = columns.map((col, cIdx) => {
      let maxLen = col.name.length;
      const sampleLimit = Math.min(dataRows.length, 100);
      for (let rIdx = 0; rIdx < sampleLimit; rIdx++) {
        const val = dataRows[rIdx][cIdx];
        if (val !== null && val !== undefined && val !== '') {
          const s = String(val);
          if (s.length > maxLen) {
            maxLen = Math.min(s.length, 45);
          }
        }
      }
      return { wch: Math.max(maxLen + 3, 10) };
    });
    worksheet['!cols'] = colWidths;

    // Create workbook and append sheet
    const workbook = XLSX.utils.book_new();
    const safeSheetName = (sheetName || 'Results')
      .replace(/[\\/*?[\]:]/g, '_')
      .slice(0, 31) || 'Results';
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

    return workbook;
  }

  /**
   * Generates .xlsx binary buffer and triggers browser download if in browser environment.
   */
  public static exportQueryResultToExcel(
    columns: { name: string; dataType?: string }[],
    rows: Record<string, unknown>[],
    options: ExportExcelOptions = {}
  ): ExportExcelResult {
    if (!rows || rows.length === 0) {
      throw new Error('No rows to export.');
    }
    if (!columns || columns.length === 0) {
      throw new Error('No columns defined for export.');
    }

    const safeFilename = options.filename
      ? (options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`)
      : this.generateExcelFilename(options.sourceName);

    const sheetName = options.sheetName || options.sourceName || 'Query Results';
    const workbook = this.buildWorkbook(columns, rows, sheetName);
    const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const buffer = new Uint8Array(arrayBuffer);

    // Browser download trigger
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = safeFilename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
      buffer,
      filename: safeFilename,
      rowCount: rows.length,
      columnCount: columns.length
    };
  }
}
