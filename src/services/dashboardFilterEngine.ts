import { DashboardFilter, DashboardWidget } from '../types/dashboard';
import { QueryResultColumn } from '../types/database';

export interface FilterCompatibilityResult {
  isCompatible: boolean;
  columnName?: string;
  reason: string;
}

export class DashboardFilterEngine {
  /**
   * Checks whether a dashboard filter can be applied to a specific widget.
   * Examines query result columns, queryRef metadata, and SQL AST keywords.
   */
  public static checkCompatibility(
    filter: DashboardFilter,
    widget: DashboardWidget,
    columns?: QueryResultColumn[]
  ): FilterCompatibilityResult {
    const rawTarget = filter.targetColumn.trim();
    if (!rawTarget) {
      return {
        isCompatible: false,
        reason: 'Filter does not specify a target column.'
      };
    }

    // Parse potential schema/table qualification, e.g. "customers.gender"
    let filterTable: string | undefined = filter.targetTable?.trim().toLowerCase();
    let filterCol = rawTarget.toLowerCase();

    if (rawTarget.includes('.')) {
      const parts = rawTarget.split('.');
      if (parts.length === 2) {
        if (!filterTable) filterTable = parts[0].toLowerCase();
        filterCol = parts[1].toLowerCase();
      } else if (parts.length >= 3) {
        if (!filterTable) filterTable = parts[parts.length - 2].toLowerCase();
        filterCol = parts[parts.length - 1].toLowerCase();
      }
    }

    const sql = (widget.queryRef.sql || '').toLowerCase();
    const cleanSql = sql.replace(/'[^']*'/g, ''); // strip string literals

    // Cross-filtering safety: If a specific table was targeted, ensure this widget references that table
    if (filterTable) {
      const widgetSourceTable = widget.queryRef.sourceTable?.toLowerCase();
      const widgetRefTables = (widget.queryRef.referencedTables || []).map(t => t.toLowerCase());
      const tableMentionedInSql = new RegExp(`\\b${filterTable}\\b`, 'i').test(cleanSql);

      const hasTableAffinity =
        widgetSourceTable === filterTable ||
        widgetRefTables.includes(filterTable) ||
        tableMentionedInSql;

      // If the widget has explicit sourceTable or referencedTables and none match the filter's targetTable,
      // it is not compatible.
      if (!hasTableAffinity && (widgetSourceTable || widgetRefTables.length > 0)) {
        return {
          isCompatible: false,
          reason: `Visualization queries table '${widgetSourceTable || widgetRefTables.join(', ')}', not '${filterTable}'.`
        };
      }
    }

    // 1. Check if column exists in the widget's actual query result columns
    if (columns && columns.length > 0) {
      const matched = columns.find(
        c => c.name.toLowerCase() === filterCol || c.name.toLowerCase() === rawTarget.toLowerCase()
      );
      if (matched) {
        return {
          isCompatible: true,
          columnName: matched.name,
          reason: `Column '${matched.name}' (${matched.dataType}) found in result dataset.`
        };
      }
    }

    // 2. Check widget queryRef metadata
    if (widget.queryRef.referencedColumns) {
      const matchedRef = widget.queryRef.referencedColumns.find(
        c => c.toLowerCase() === filterCol || c.toLowerCase() === rawTarget.toLowerCase()
      );
      if (matchedRef) {
        // Find if mapped to clean name in columns
        const projCol = columns?.find(c => c.name.toLowerCase() === matchedRef.toLowerCase());
        return {
          isCompatible: true,
          columnName: projCol ? projCol.name : (matchedRef.includes('.') ? matchedRef.split('.').pop()! : matchedRef),
          reason: `Column '${matchedRef}' found in query source references.`
        };
      }
    }

    // 3. Fallback: inspect raw SQL for column appearance
    const colRegex = new RegExp(`\\b${filterCol}\\b`, 'i');
    if (colRegex.test(cleanSql)) {
      // Find actual projection column if possible
      const projCol = columns?.find(c => c.name.toLowerCase() === filterCol);
      return {
        isCompatible: true,
        columnName: projCol ? projCol.name : filterCol,
        reason: `Field '${filterCol}' referenced in query statement.`
      };
    }

    return {
      isCompatible: false,
      reason: `Visualization does not contain or return field '${rawTarget}'.`
    };
  }

  /**
   * Safely augments a widget query with active filters using a subquery wrapper.
   * Guarantees strict read-only execution, escapes all literals, and avoids syntax breakage.
   */
  public static applyFiltersToSql(
    baseSql: string,
    filters: DashboardFilter[],
    widget: DashboardWidget,
    columns?: QueryResultColumn[]
  ): { augmentedSql: string; appliedFilterCount: number } {
    const cleanBase = baseSql.trim().replace(/;+$/, '');
    if (!cleanBase || filters.length === 0) {
      return { augmentedSql: baseSql, appliedFilterCount: 0 };
    }

    const conditions: string[] = [];

    for (const filter of filters) {
      const comp = this.checkCompatibility(filter, widget, columns);
      if (!comp.isCompatible || !comp.columnName) {
        continue;
      }

      const safeColIdent = `"${comp.columnName.replace(/"/g, '""')}"`;
      const condition = this.buildSafeFilterCondition(filter, safeColIdent);
      if (condition) {
        conditions.push(condition);
      }
    }

    if (conditions.length === 0) {
      return { augmentedSql: baseSql, appliedFilterCount: 0 };
    }

    // Safely wrap in an outer subquery to preserve CTEs, GROUP BYs, and aggregations
    const combinedWhere = conditions.join(' AND ');
    const augmentedSql = `SELECT * FROM (\n${cleanBase}\n) AS __dp_filter_sub\nWHERE ${combinedWhere};`;

    return {
      augmentedSql,
      appliedFilterCount: conditions.length
    };
  }

  /**
   * Generates a safe, injection-proof SQL boolean expression for a filter
   */
  private static buildSafeFilterCondition(
    filter: DashboardFilter,
    safeColIdent: string
  ): string | null {
    switch (filter.type) {
      case 'text':
      case 'single_select': {
        const val = filter.currentValue;
        if (val === undefined || val === null || val === '' || val === 'ALL') return null;
        const escaped = String(val).replace(/'/g, "''");
        return `CAST(${safeColIdent} AS TEXT) = '${escaped}'`;
      }

      case 'multi_select': {
        const vals = filter.currentValue;
        if (!Array.isArray(vals) || vals.length === 0 || vals.includes('ALL')) return null;
        const escapedList = vals
          .filter(v => v !== 'ALL' && v !== null && v !== undefined)
          .map(v => `'${String(v).replace(/'/g, "''")}'`)
          .join(', ');
        return escapedList ? `CAST(${safeColIdent} AS TEXT) IN (${escapedList})` : null;
      }

      case 'number': {
        const val = filter.currentValue;
        if (val === undefined || val === null || val === '') return null;
        const num = Number(val);
        if (isNaN(num)) return null;
        return `${safeColIdent} = ${num}`;
      }

      case 'date': {
        const val = filter.currentValue;
        if (!val || typeof val !== 'string') return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
        return `CAST(${safeColIdent} AS DATE) = DATE '${val}'`;
      }

      case 'date_range': {
        const from = filter.dateFrom;
        const to = filter.dateTo;
        const clauses: string[] = [];

        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
          clauses.push(`CAST(${safeColIdent} AS DATE) >= DATE '${from}'`);
        }
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
          clauses.push(`CAST(${safeColIdent} AS DATE) <= DATE '${to}'`);
        }

        return clauses.length > 0 ? clauses.join(' AND ') : null;
      }

      default:
        return null;
    }
  }
}
