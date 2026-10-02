import { SqlDialect } from './SqlDialect';
import {
  FilterCondition,
  AggregationItem,
  HavingCondition,
  CaseCategoryConfig,
  CalculatedColumnConfig,
  DateAnalysisConfig,
  WindowFunctionConfig,
  TopNPerGroupConfig,
  MultiTableJoinConfig,
  FunnelConfig,
  CohortConfig,
  RetentionConfig,
  GeneratedAnalysisQuery
} from '../../src/types/analysis';

/**
 * PostgreSQL-compatible SQL Generator for the Easy Data Analysis Toolkit.
 * Kept completely decoupled from backend network adapters to support future dialects.
 */
export class AnalysisSqlGenerator {
  constructor(private dialect: SqlDialect) {}
  /**
   * Safely quotes a PostgreSQL identifier (schema, table, column)
   */
  public quoteIdentifier(id: string): string {
    return this.dialect.quoteIdentifier(id);
  }

  /**
   * Safely formats a human-readable table identifier: "schema.table" for external databases, or "table" for imported datasets
   */
  public formatTableDisplay(schema: string, tableName: string): string {
    if (schema === 'imported' || !schema) {
      return tableName;
    }
    return `${schema}.${tableName}`;
  }

  /**
   * Safely quotes a full table name: "schema"."table" for external databases, or "table" for imported datasets
   */
  public quoteTable(schema: string, tableName: string): string {
    if (schema === 'imported' || !schema) {
      return this.quoteIdentifier(tableName);
    }
    return this.dialect.qualifyTable(schema, tableName);
  }

  /**
   * Resolves the dialect type (sqlite, postgresql, mysql, sqlserver, oracle)
   */
  public getDialectType(schema?: string): 'sqlite' | 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' {
    if (schema === 'imported') {
      return 'sqlite';
    }
    if (this.dialect.dialectType) {
      return this.dialect.dialectType;
    }
    const testId = this.dialect.quoteIdentifier('x');
    if (testId === '[x]') return 'sqlserver';
    if (testId === '`x`') return 'mysql';
    if (this.dialect.formatExplain && this.dialect.formatExplain('x').includes('EXPLAIN QUERY PLAN')) {
      return 'sqlite';
    }
    const testDate = this.dialect.formatDate(new Date());
    if (testDate.startsWith('TIMESTAMP')) return 'oracle';
    return 'postgresql';
  }

  /**
   * Formats a date period truncation expression tailored for the active dialect
   */
  public formatDateTrunc(
    dateCol: string,
    period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month',
    schema?: string
  ): string {
    const dialectType = this.getDialectType(schema);
    switch (dialectType) {
      case 'sqlite': {
        switch (period) {
          case 'year':
            return `strftime('%Y', ${dateCol})`;
          case 'day':
            return `strftime('%Y-%m-%d', ${dateCol})`;
          case 'week':
            return `strftime('%Y-%W', ${dateCol})`;
          case 'quarter':
            return `(strftime('%Y', ${dateCol}) || '-Q' || ((CAST(strftime('%m', ${dateCol}) AS INTEGER) + 2) / 3))`;
          case 'month':
          default:
            return `strftime('%Y-%m', ${dateCol})`;
        }
      }
      case 'mysql': {
        switch (period) {
          case 'year':
            return `DATE_FORMAT(${dateCol}, '%Y')`;
          case 'day':
            return `DATE_FORMAT(${dateCol}, '%Y-%m-%d')`;
          case 'week':
            return `DATE_FORMAT(${dateCol}, '%Y-%u')`;
          case 'quarter':
            return `CONCAT(YEAR(${dateCol}), '-Q', QUARTER(${dateCol}))`;
          case 'month':
          default:
            return `DATE_FORMAT(${dateCol}, '%Y-%m')`;
        }
      }
      case 'sqlserver': {
        switch (period) {
          case 'year':
            return `FORMAT(${dateCol}, 'yyyy')`;
          case 'day':
            return `FORMAT(${dateCol}, 'yyyy-MM-dd')`;
          case 'week':
            return `DATEPART(week, ${dateCol})`;
          case 'quarter':
            return `CONCAT(YEAR(${dateCol}), '-Q', DATEPART(quarter, ${dateCol}))`;
          case 'month':
          default:
            return `FORMAT(${dateCol}, 'yyyy-MM')`;
        }
      }
      case 'oracle': {
        switch (period) {
          case 'year':
            return `TRUNC(${dateCol}, 'YYYY')`;
          case 'day':
            return `TRUNC(${dateCol}, 'DD')`;
          case 'week':
            return `TRUNC(${dateCol}, 'IW')`;
          case 'quarter':
            return `TRUNC(${dateCol}, 'Q')`;
          case 'month':
          default:
            return `TRUNC(${dateCol}, 'MM')`;
        }
      }
      case 'postgresql':
      default:
        return `DATE_TRUNC('${period}', ${dateCol})`;
    }
  }

  /**
   * Safely escapes string literals for SQL values
   */
  public static escapeLiteral(val: string): string {
    if (val === null || val === undefined) return 'NULL';
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  /**
   * Validates that generated SQL contains no placeholder text or unrendered templates
   */
  public static validateNoPlaceholders(sql: string, context: string = 'query'): void {
    // Strip string literals '...' so user values like 'first clause' aren't falsely flagged
    const sqlWithoutLiterals = sql.replace(/'(?:''|[^'])*'/g, "''");

    const placeholderPatterns: { pattern: RegExp; name: string }[] = [
      { pattern: /\bclause\b/i, name: 'Clause' },
      { pattern: /\bfilter_condition\b/i, name: 'filter_condition' },
      { pattern: /\bundefined\b/, name: 'undefined' },
      { pattern: /\[object Object\]/, name: '[object Object]' },
      { pattern: /\bNaN\b/, name: 'NaN' },
      { pattern: /\bmeasureExpr\b/, name: 'measureExpr' },
      { pattern: /\bdateExpr\b/, name: 'dateExpr' },
      { pattern: /\bcolumnExpr\b/, name: 'columnExpr' },
      { pattern: /\bperiodExpr\b/, name: 'periodExpr' },
      { pattern: /\bwindowSize\b/, name: 'windowSize' },
      { pattern: /\brevCol\b/, name: 'revCol' },
      { pattern: /\bdimCol\b/, name: 'dimCol' },
      { pattern: /\bamountCol\b/, name: 'amountCol' },
      { pattern: /\bcustId\b/, name: 'custId' },
      { pattern: /\bprodCol\b/, name: 'prodCol' },
      { pattern: /\bmeasureCol\b/, name: 'measureCol' },
      { pattern: /\buserCol\b/, name: 'userCol' },
      { pattern: /\bfirstDateCol\b/, name: 'firstDateCol' },
      { pattern: /\bactDateCol\b/, name: 'actDateCol' },
      { pattern: /\breturnDateCol\b/, name: 'returnDateCol' },
      { pattern: /\brecencyExpr\b/, name: 'recencyExpr' },
      { pattern: /\bmonetaryExpr\b/, name: 'monetaryExpr' },
      { pattern: /\baovExpr\b/, name: 'aovExpr' },
      { pattern: /\bgroupCol\b/, name: 'groupCol' },
      { pattern: /\brankCol\b/, name: 'rankCol' },
      { pattern: /\bconfig\.[a-zA-Z0-9_]+\b/, name: 'config.property' }
    ];

    for (const { pattern, name } of placeholderPatterns) {
      if (pattern.test(sqlWithoutLiterals)) {
        throw new Error(`Invalid placeholder '${name}' detected in generated SQL (${context})`);
      }
    }

    if (/\bWHERE\s+condition\b/i.test(sqlWithoutLiterals) || /\bAND\s+condition\b/i.test(sqlWithoutLiterals) || /\bOR\s+condition\b/i.test(sqlWithoutLiterals)) {
      throw new Error(`Invalid placeholder 'condition' detected in generated SQL (${context})`);
    }
  }

  /**
   * Safely escapes values, distinguishing numeric values, dates, booleans from strings
   */
  public static formatValue(val: any): string {
    if (val === null || val === undefined) return 'NULL';

    if (typeof val === 'number') {
      if (isNaN(val)) return 'NULL';
      return String(val);
    }

    if (typeof val === 'boolean') {
      return val ? 'true' : 'false';
    }

    if (val instanceof Date) {
      if (isNaN(val.getTime())) return 'NULL';
      return AnalysisSqlGenerator.escapeLiteral(val.toISOString().slice(0, 19).replace('T', ' '));
    }

    const trimmed = String(val).trim();
    if (trimmed === '') return "''";

    // If enclosed in single or double quotes, strip outer quotes cleanly
    let clean = trimmed;
    if ((clean.startsWith("'") && clean.endsWith("'") && clean.length >= 2) ||
        (clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2)) {
      clean = clean.slice(1, -1);
    }

    // Check if cleanly numeric (standard integer or decimal, no leading zeroes unless '0' or '0.x')
    if (/^[+-]?(?:0|[1-9]\d*)(\.\d+)?$/.test(clean)) {
      return clean;
    }

    // Check if boolean
    if (clean.toLowerCase() === 'true' || clean.toLowerCase() === 'false') {
      return clean.toLowerCase();
    }

    // Check if literal NULL
    if (clean.toUpperCase() === 'NULL') {
      return 'NULL';
    }

    return AnalysisSqlGenerator.escapeLiteral(clean);
  }

  /**
   * Builds SQL for Basic Operations
   */
  public generateBasic(
    schema: string,
    tableName: string,
    operation:
      | 'preview'
      | 'select_columns'
      | 'distinct'
      | 'count_rows'
      | 'count_distinct'
      | 'sort_asc'
      | 'sort_desc'
      | 'top_n'
      | 'bottom_n'
      | 'limit_rows',
    options: {
      columns?: string[];
      column?: string;
      limit?: number;
    } = {}
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const tableDisplay = this.formatTableDisplay(schema, tableName);
    const limit = options.limit || 50;

    switch (operation) {
      case 'preview':
        return {
          name: 'Preview Data',
          category: 'BASIC',
          description: `Preview the first ${limit} rows of ${tableDisplay}`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.columns || ['*'],
          sql: this.dialect.formatLimit(`SELECT *\nFROM ${fullTable}`, limit) + ';'
        };

      case 'select_columns': {
        const cols = (options.columns && options.columns.length > 0)
          ? options.columns.map(c => this.quoteIdentifier(c)).join(',\n    ')
          : '*';
        return {
          name: 'Select Columns',
          category: 'BASIC',
          description: `Retrieve specific columns from ${tableDisplay}`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.columns || [],
          sql: this.dialect.formatLimit(`SELECT\n    ${cols}\nFROM ${fullTable}`, limit) + ';'
        };
      }

      case 'distinct': {
        const col = options.column ? this.quoteIdentifier(options.column) : '*';
        return {
          name: 'Select Distinct Values',
          category: 'BASIC',
          description: `List unique values for ${options.column || ''}`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.column ? [options.column] : [],
          sql: this.dialect.formatLimit(`SELECT DISTINCT\n    ${col}\nFROM ${fullTable}\nWHERE ${col} IS NOT NULL\nORDER BY ${col} ASC`, limit) + ';'
        };
      }

      case 'count_rows':
        return {
          name: 'Count Rows',
          category: 'BASIC',
          description: `Count total row records in ${tableDisplay}`,
          tablesUsed: [tableDisplay],
          columnsUsed: [],
          sql: `SELECT COUNT(*) AS total_rows\nFROM ${fullTable};`
        };

      case 'count_distinct': {
        const col = options.column ? this.quoteIdentifier(options.column) : 'id';
        return {
          name: 'Count Distinct Values',
          category: 'BASIC',
          description: `Count distinct non-null values in ${options.column}`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.column ? [options.column] : [],
          sql: `SELECT COUNT(DISTINCT ${col}) AS distinct_count\nFROM ${fullTable};`
        };
      }

      case 'sort_asc': {
        const col = options.column ? this.quoteIdentifier(options.column) : '1';
        return {
          name: 'Sort Ascending',
          category: 'BASIC',
          description: `Sort rows by ${options.column} in ascending`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.column ? [options.column] : [],
          sql: this.dialect.formatLimit(`SELECT *\nFROM ${fullTable}\nORDER BY ${col} ASC`, limit) + ';'
        };
      }

      case 'sort_desc': {
        const col = options.column ? this.quoteIdentifier(options.column) : '1';
        return {
          name: 'Sort Descending',
          category: 'BASIC',
          description: `Sort rows by ${options.column} in descending`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.column ? [options.column] : [],
          sql: this.dialect.formatLimit(`SELECT *\nFROM ${fullTable}\nORDER BY ${col} DESC`, limit) + ';'
        };
      }

      case 'top_n': {
        const col = options.column ? this.quoteIdentifier(options.column) : '1';
        return {
          name: `Top ${limit} Rows`,
          category: 'BASIC',
          description: `Highest ${limit} records sorted by ${options.column}`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.column ? [options.column] : [],
          sql: this.dialect.formatLimit(`SELECT *\nFROM ${fullTable}\nORDER BY ${col} DESC`, limit) + ';'
        };
      }

      case 'bottom_n': {
        const col = options.column ? this.quoteIdentifier(options.column) : '1';
        return {
          name: `Bottom ${limit} Rows`,
          category: 'BASIC',
          description: `Lowest ${limit} records sorted by ${options.column}`,
          tablesUsed: [tableDisplay],
          columnsUsed: options.column ? [options.column] : [],
          sql: this.dialect.formatLimit(`SELECT *\nFROM ${fullTable}\nORDER BY ${col} ASC`, limit) + ';'
        };
      }

      case 'limit_rows':
      default:
        return {
          name: `Limit to ${limit} Rows`,
          category: 'BASIC',
          description: `Fetch limited records from ${tableDisplay}`,
          tablesUsed: [tableDisplay],
          columnsUsed: [],
          sql: this.dialect.formatLimit(`SELECT *\nFROM ${fullTable}`, limit) + ';'
        };
    }
  }

  /**
   * Builds SQL for Filter Builder
   */
  public generateFilterQuery(
    schema: string,
    tableName: string,
    filters: FilterCondition[],
    selectedColumns: string[] = [],
    limit: number = 100
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const tableDisplay = this.formatTableDisplay(schema, tableName);
    const cols = selectedColumns.length > 0
      ? selectedColumns.map(c => this.quoteIdentifier(c)).join(', ')
      : '*';

    if (!filters || filters.length === 0) {
      return {
        name: 'Filtered Data',
        category: 'FILTERING',
        description: `Unfiltered data from ${tableDisplay}`,
        tablesUsed: [tableDisplay],
        columnsUsed: selectedColumns,
        sql: this.dialect.formatLimit(`SELECT ${cols}\nFROM ${fullTable}`, limit) + ';'
      };
    }

    const whereClauses: string[] = [];
    const usedColumns = new Set<string>(selectedColumns);

    filters.forEach((f, idx) => {
      if (!f || !f.column) return;
      usedColumns.add(f.column);
      const col = this.quoteIdentifier(f.column);
      let clause = '';

      const op = (f.operator || '=').toUpperCase().trim();

      switch (op) {
        case '=':
        case '!=':
        case '<>':
        case '>':
        case '>=':
        case '<':
        case '<=':
          clause = `${col} ${op === '<>' ? '!=' : op} ${AnalysisSqlGenerator.formatValue(f.value)}`;
          break;
        case 'LIKE':
        case 'CONTAINS':
        case 'LIKE / CONTAINS':
        case 'ILIKE': {
          const rawVal = (f.value !== undefined && f.value !== null ? String(f.value) : '').trim();
          const pattern = rawVal.includes('%') ? rawVal : `%${rawVal}%`;
          clause = `${col} LIKE ${AnalysisSqlGenerator.escapeLiteral(pattern)}`;
          break;
        }
        case 'IS NULL':
          clause = `${col} IS NULL`;
          break;
        case 'IS NOT NULL':
          clause = `${col} IS NOT NULL`;
          break;
        case 'IN':
        case 'NOT IN': {
          const rawItems = (f.value !== undefined && f.value !== null ? String(f.value) : '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          const formattedItems = rawItems.map(s => {
            let clean = s;
            if ((clean.startsWith("'") && clean.endsWith("'") && clean.length >= 2) ||
                (clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2)) {
              clean = clean.slice(1, -1);
            }
            return AnalysisSqlGenerator.formatValue(clean);
          });
          const listStr = formattedItems.length > 0 ? formattedItems.join(', ') : "''";
          clause = `${col} ${op === 'NOT IN' ? 'NOT IN' : 'IN'} (${listStr})`;
          break;
        }
        case 'BETWEEN': {
          let lower = f.value !== undefined && f.value !== null ? String(f.value).trim() : '';
          let upper = f.value2 !== undefined && f.value2 !== null ? String(f.value2).trim() : '';
          if (!upper && lower && (lower.includes(' AND ') || lower.includes(' and '))) {
            const parts = lower.split(/\s+AND\s+/i);
            lower = parts[0].trim();
            upper = (parts[1] || '').trim();
          } else if (!upper && lower && lower.includes(',')) {
            const parts = lower.split(',');
            lower = parts[0].trim();
            upper = (parts[1] || '').trim();
          }
          const val1 = AnalysisSqlGenerator.formatValue(lower);
          const val2 = AnalysisSqlGenerator.formatValue(upper !== '' ? upper : lower);
          clause = `${col} BETWEEN ${val1} AND ${val2}`;
          break;
        }
        default:
          clause = `${col} = ${AnalysisSqlGenerator.formatValue(f.value)}`;
      }

      if (idx === 0) {
        whereClauses.push(clause);
      } else {
        const logic = (f.logic || 'AND').toUpperCase();
        whereClauses.push(`${logic} ${clause}`);
      }
    });

    if (whereClauses.length === 0) {
      return {
        name: 'Filtered Data',
        category: 'FILTERING',
        description: `Unfiltered data from ${tableDisplay}`,
        tablesUsed: [tableDisplay],
        columnsUsed: selectedColumns,
        sql: this.dialect.formatLimit(`SELECT ${cols}\nFROM ${fullTable}`, limit) + ';'
      };
    }

    const whereSection = whereClauses.length === 1
      ? `WHERE ${whereClauses[0]}`
      : `WHERE\n  ${whereClauses.join('\n  ')}`;

    const sql = this.dialect.formatLimit(`SELECT ${cols}\nFROM ${fullTable}\n${whereSection}`, limit) + ';';

    AnalysisSqlGenerator.validateNoPlaceholders(sql, 'generateFilterQuery');

    return {
      name: 'Filtered Query',
      category: 'FILTERING',
      description: `Data from ${tableDisplay} matching ${filters.length} filter condition(s)`,
      tablesUsed: [tableDisplay],
      columnsUsed: Array.from(usedColumns),
      sql
    };
  }

  /**
   * Builds SQL for Aggregations
   */
  public generateAggregation(
    schema: string,
    tableName: string,
    aggregations: AggregationItem[]
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const usedCols: string[] = [];

    const selectItems = aggregations.map(agg => {
      const alias = agg.alias.trim() ? this.quoteIdentifier(agg.alias.trim()) : undefined;
      let expr = '';

      if (agg.func === 'COUNT DISTINCT') {
        usedCols.push(agg.column);
        expr = `COUNT(DISTINCT ${this.quoteIdentifier(agg.column)})`;
      } else if (agg.func === 'COUNT' && (!agg.column || agg.column === '*')) {
        expr = 'COUNT(*)';
      } else {
        usedCols.push(agg.column);
        expr = `${agg.func}(${this.quoteIdentifier(agg.column)})`;
      }

      return alias ? `${expr} AS ${alias}` : expr;
    });

    const sql = `SELECT\n    ${selectItems.join(',\n    ')}\nFROM ${fullTable};`;

    return {
      name: 'Summary Aggregation',
      category: 'AGGREGATION',
      description: `Aggregated summary metrics across ${schema}.${tableName}`,
      tablesUsed: [`${schema}.${tableName}`],
      columnsUsed: usedCols,
      sql
    };
  }

  /**
   * Builds SQL for Group By + Having
   */
  public generateGroupBy(
    schema: string,
    tableName: string,
    groupColumns: string[],
    aggregations: AggregationItem[],
    having?: HavingCondition,
    limit: number = 100
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const usedCols = new Set<string>(groupColumns);

    const groupExpressions = groupColumns.map(c => this.quoteIdentifier(c));
    const selectItems: string[] = [...groupExpressions];

    let orderTarget = '';

    aggregations.forEach((agg, idx) => {
      usedCols.add(agg.column);
      const aliasName = agg.alias.trim() || `${agg.func.toLowerCase()}_${agg.column.replace(/\*/g, 'all')}`;
      const safeAlias = this.quoteIdentifier(aliasName);

      let expr = '';
      if (agg.func === 'COUNT DISTINCT') {
        expr = `COUNT(DISTINCT ${this.quoteIdentifier(agg.column)})`;
      } else if (agg.func === 'COUNT' && (!agg.column || agg.column === '*')) {
        expr = 'COUNT(*)';
      } else {
        expr = `${agg.func}(${this.quoteIdentifier(agg.column)})`;
      }

      selectItems.push(`${expr} AS ${safeAlias}`);
      if (idx === 0) {
        orderTarget = safeAlias;
      }
    });

    let havingClause = '';
    if (having && having.enabled && having.column) {
      usedCols.add(having.column);
      let havingExpr = '';
      if (having.func === 'COUNT DISTINCT') {
        havingExpr = `COUNT(DISTINCT ${this.quoteIdentifier(having.column)})`;
      } else if (having.func === 'COUNT' && (!having.column || having.column === '*')) {
        havingExpr = 'COUNT(*)';
      } else {
        havingExpr = `${having.func}(${this.quoteIdentifier(having.column)})`;
      }
      havingClause = `\nHAVING ${havingExpr} ${having.operator} ${AnalysisSqlGenerator.formatValue(having.value)}`;
    }

    const orderClause = orderTarget ? `\nORDER BY ${orderTarget} DESC` : `\nORDER BY 1 ASC`;

    const sql = this.dialect.formatLimit(`SELECT\n    ${selectItems.join(',\n    ')}\nFROM ${fullTable}\nGROUP BY\n    ${groupExpressions.join(',\n    ')}${havingClause}${orderClause}`, limit) + ';';

    const tableDisplay = this.formatTableDisplay(schema, tableName);

    return {
      name: `Group By (${groupColumns.join(', ')})`,
      category: 'GROUPING',
      description: `Grouped metrics by ${groupColumns.join(', ')}`,
      tablesUsed: [tableDisplay],
      columnsUsed: Array.from(usedCols),
      sql
    };
  }

  /**
   * Builds SQL for Multi-Table Join Builder
   */
  public generateJoin(config: MultiTableJoinConfig, limit: number = 100): GeneratedAnalysisQuery {
    const baseTableFull = this.quoteTable(config.baseTable.schema, config.baseTable.name);
    const joinTableFull = this.quoteTable(config.joinTable.schema, config.joinTable.name);

    const baseAlias = 't1';
    const joinAlias = 't2';

    const outputNames = new Set<string>();
    const duplicateNames = new Set<string>();

    for (const sc of config.selectedColumns) {
      const name = sc.alias || sc.column;
      if (outputNames.has(name)) {
        duplicateNames.add(name);
      }
      outputNames.add(name);
    }

    const usedFinalAliases = new Set<string>();

    const selectItems = config.selectedColumns.map(sc => {
      const alias = sc.tableKey === 'base' ? baseAlias : joinAlias;
      const colQuoted = this.quoteIdentifier(sc.column);
      
      let finalAlias = sc.alias;
      if (!finalAlias && duplicateNames.has(sc.column)) {
        finalAlias = `${sc.tableName}_${sc.column}`;
      }
      
      let uniqueAlias = finalAlias || sc.column;
      let counter = 1;
      while (usedFinalAliases.has(uniqueAlias)) {
        uniqueAlias = `${finalAlias || sc.column}_${counter}`;
        counter++;
      }
      usedFinalAliases.add(uniqueAlias);

      const customAlias = (uniqueAlias !== sc.column) ? ` AS ${this.quoteIdentifier(uniqueAlias)}` : '';
      return `    ${alias}.${colQuoted}${customAlias}`;
    });

    const projection = selectItems.length > 0 ? selectItems.join(',\n') : `    ${baseAlias}.*,\n    ${joinAlias}.*`;

    const onCondition = `${baseAlias}.${this.quoteIdentifier(config.baseColumn)} = ${joinAlias}.${this.quoteIdentifier(config.joinColumn)}`;

    let orderClause = '';
    if (this.dialect.requiresOrderByForLimit) {
        orderClause = `\nORDER BY ${baseAlias}.${this.quoteIdentifier(config.baseColumn)} ASC`;
    }
    const sql = this.dialect.formatLimit(`SELECT\n${projection}\nFROM ${baseTableFull} ${baseAlias}\n${config.joinType} ${joinTableFull} ${joinAlias}\n    ON ${onCondition}${orderClause}`, limit) + ';';

    return {
      name: `${config.joinType} (${config.baseTable.name} + ${config.joinTable.name})`,
      category: 'JOIN',
      description: `Join between ${config.baseTable.name} and ${config.joinTable.name} via ${config.baseColumn} = ${config.joinColumn}`,
      tablesUsed: [
        `${config.baseTable.schema}.${config.baseTable.name}`,
        `${config.joinTable.schema}.${config.joinTable.name}`
      ],
      columnsUsed: [config.baseColumn, config.joinColumn, ...config.selectedColumns.map(c => c.column)],
      sql
    };
  }

  /**
   * Builds SQL for CASE / Conditional Categories
   */
  public generateCaseCategory(
    schema: string,
    tableName: string,
    config: CaseCategoryConfig,
    limit: number = 100
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const col = this.quoteIdentifier(config.column);

    const whenClauses = config.rules.map(r => {
      return `        WHEN ${col} ${r.operator} ${AnalysisSqlGenerator.formatValue(r.value)} THEN ${AnalysisSqlGenerator.escapeLiteral(r.resultLabel)}`;
    });

    const elseClause = `        ELSE ${AnalysisSqlGenerator.escapeLiteral(config.fallbackLabel || 'Other')}`;
    const alias = this.quoteIdentifier(config.alias.trim() || `${config.column}_category`);

    const sql = this.dialect.formatLimit(`SELECT\n    *,\n    CASE\n${whenClauses.join('\n')}\n${elseClause}\n    END AS ${alias}\nFROM ${fullTable}`, limit) + ';';

    const tableDisplay = this.formatTableDisplay(schema, tableName);

    return {
      name: `Category Column (${config.alias || 'category'})`,
      category: 'CUSTOM_COLUMNS',
      description: `Segment ${config.column} into categorical tiers using CASE`,
      tablesUsed: [tableDisplay],
      columnsUsed: [config.column],
      sql
    };
  }

  /**
   * Builds SQL for Calculated Expression (col1 math operator col2)
   */
  public generateCalculatedColumn(
    schema: string,
    tableName: string,
    config: CalculatedColumnConfig,
    limit: number = 100
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const col1 = this.quoteIdentifier(config.col1);
    const col2 = this.quoteIdentifier(config.col2);
    const alias = this.quoteIdentifier(config.alias.trim() || 'calculated_value');

    let expr = '';
    if (config.operator === '/') {
      // Safe division preventing division-by-zero error in Postgres
      expr = `(${col1} / NULLIF(${col2}, 0))`;
    } else {
      expr = `(${col1} ${config.operator} ${col2})`;
    }

    const sql = this.dialect.formatLimit(`SELECT\n    *,\n    ${expr} AS ${alias}\nFROM ${fullTable}`, limit) + ';';

    AnalysisSqlGenerator.validateNoPlaceholders(sql);

    const tableDisplay = this.formatTableDisplay(schema, tableName);

    return {
      name: `Calculated Column (${config.alias})`,
      category: 'CALCULATIONS',
      description: `Compute ${config.col1} ${config.operator} ${config.col2} as ${config.alias}`,
      tablesUsed: [tableDisplay],
      columnsUsed: [config.col1, config.col2],
      sql
    };
  }

  /**
   * Builds SQL for Date Analysis (Trend, MoM, YoY, Running Total, Rolling Avg)
   */
  public generateDateAnalysis(
    schema: string,
    tableName: string,
    config: DateAnalysisConfig,
    limit: number = 200
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const dateCol = this.quoteIdentifier(config.dateColumn);
    const period = config.period || 'month';

    const measureExpr = config.measureColumn === '*'
      ? 'COUNT(*)'
      : `${config.measureFunction || 'SUM'}(${this.quoteIdentifier(config.measureColumn)})`;

    let sql = '';
    let name = '';
    let description = '';

    switch (config.mode) {
      case 'mom': {
        const periodExpr = this.formatDateTrunc(dateCol, 'month', schema);
        sql = `WITH monthly_data AS (
    SELECT
        ${periodExpr} AS period,
        ${measureExpr} AS current_value
    FROM ${fullTable}
    WHERE ${dateCol} IS NOT NULL
    GROUP BY ${periodExpr}
)
SELECT
    period,
    current_value,
    LAG(current_value, 1) OVER (ORDER BY period) AS previous_month_value,
    ROUND(
        ((current_value - LAG(current_value, 1) OVER (ORDER BY period)) /
        NULLIF(LAG(current_value, 1) OVER (ORDER BY period), 0)) * 100.0,
        2
    ) AS growth_percent
FROM monthly_data
ORDER BY period ASC;`;

        name = 'Month-over-Month (MoM) Growth';
        description = `Compute Month-over-Month percentage growth using LAG()`;
        break;
      }

      case 'yoy': {
        const periodExpr = this.formatDateTrunc(dateCol, 'year', schema);
        sql = `WITH yearly_data AS (
    SELECT
        ${periodExpr} AS period,
        ${measureExpr} AS current_value
    FROM ${fullTable}
    WHERE ${dateCol} IS NOT NULL
    GROUP BY ${periodExpr}
)
SELECT
    period,
    current_value,
    LAG(current_value, 1) OVER (ORDER BY period) AS previous_year_value,
    ROUND(
        ((current_value - LAG(current_value, 1) OVER (ORDER BY period)) /
        NULLIF(LAG(current_value, 1) OVER (ORDER BY period), 0)) * 100.0,
        2
    ) AS growth_percent
FROM yearly_data
ORDER BY period ASC;`;

        name = 'Year-over-Year (YoY) Growth';
        description = `Compute Year-over-Year growth comparison using LAG()`;
        break;
      }

      case 'running_sum': {
        const valCol = config.measureColumn !== '*' ? this.quoteIdentifier(config.measureColumn) : '1';
        const selectEntry = config.measureColumn !== '*' ? valCol : '1 AS entry';
        sql = this.dialect.formatLimit(`SELECT
    ${dateCol},
    ${selectEntry},
    SUM(${valCol}) OVER (
        ORDER BY ${dateCol} ASC
    ) AS running_total
FROM ${fullTable}
WHERE ${dateCol} IS NOT NULL
ORDER BY ${dateCol} ASC`, limit) + ';';

        name = 'Running Total (Cumulative SUM)';
        description = `Cumulative running SUM ordered by ${config.dateColumn}`;
        break;
      }

      case 'running_count': {
        sql = this.dialect.formatLimit(`SELECT
    ${dateCol},
    COUNT(*) OVER (
        ORDER BY ${dateCol} ASC
    ) AS running_count
FROM ${fullTable}
WHERE ${dateCol} IS NOT NULL
ORDER BY ${dateCol} ASC`, limit) + ';';

        name = 'Running Count (Cumulative Transactions)';
        description = `Cumulative event counter over time`;
        break;
      }

      case 'rolling_avg': {
        const windowSize = config.rollingWindow || 3;
        const periodExpr = this.formatDateTrunc(dateCol, period, schema);
        sql = `WITH aggregated AS (
    SELECT
        ${periodExpr} AS period,
        ${measureExpr} AS metric_value
    FROM ${fullTable}
    WHERE ${dateCol} IS NOT NULL
    GROUP BY ${periodExpr}
)
SELECT
    period,
    metric_value,
    ROUND(
        AVG(metric_value) OVER (
            ORDER BY period ASC
            ROWS BETWEEN ${windowSize - 1} PRECEDING AND CURRENT ROW
        ),
        2
    ) AS rolling_${windowSize}_${period}_avg
FROM aggregated
ORDER BY period ASC;`;

        name = `Rolling Average (${windowSize}-${period})`;
        description = `Moving window average of ${config.measureColumn} over ${period}ly intervals`;
        break;
      }

      case 'trend':
      default: {
        const periodExpr = this.formatDateTrunc(dateCol, period, schema);
        sql = this.dialect.formatLimit(`SELECT
    ${periodExpr} AS period,
    ${measureExpr} AS total_metric,
    COUNT(*) AS event_count
FROM ${fullTable}
WHERE ${dateCol} IS NOT NULL
GROUP BY ${periodExpr}
ORDER BY period ASC`, limit) + ';';

        name = `${period.toUpperCase()} Trend Analysis`;
        description = `Aggregated time-series trend by ${period}`;
        break;
      }
    }

    AnalysisSqlGenerator.validateNoPlaceholders(sql, `Date Analysis: ${name}`);

    const tableDisplay = this.formatTableDisplay(schema, tableName);
    const columnsUsed = config.measureColumn && config.measureColumn !== '*'
      ? [config.dateColumn, config.measureColumn]
      : [config.dateColumn];

    return {
      name,
      category: 'DATE_ANALYSIS',
      description,
      tablesUsed: [tableDisplay],
      columnsUsed,
      sql
    };
  }

  /**
   * Builds SQL for Window Functions
   */
  public generateWindowFunction(
    schema: string,
    tableName: string,
    config: WindowFunctionConfig,
    limit: number = 100
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const partitionClause = config.partitionColumns && config.partitionColumns.length > 0
      ? `PARTITION BY ${config.partitionColumns.map(c => this.quoteIdentifier(c)).join(', ')} `
      : '';

    const orderCol = config.orderColumn ? this.quoteIdentifier(config.orderColumn) : '1';
    const orderClause = `ORDER BY ${orderCol} ${config.orderDirection}`;

    const overClause = `OVER (${partitionClause}${orderClause})`;
    const alias = this.quoteIdentifier(config.alias.trim() || 'window_result');

    let funcExpr = '';
    const target = config.targetColumn ? this.quoteIdentifier(config.targetColumn) : orderCol;

    switch (config.func) {
      case 'ROW_NUMBER':
        funcExpr = `ROW_NUMBER() ${overClause}`;
        break;
      case 'RANK':
        funcExpr = `RANK() ${overClause}`;
        break;
      case 'DENSE_RANK':
        funcExpr = `DENSE_RANK() ${overClause}`;
        break;
      case 'NTILE':
        funcExpr = `NTILE(${config.ntileBuckets || 4}) ${overClause}`;
        break;
      case 'LAG':
        funcExpr = `LAG(${target}, ${config.offset || 1}) ${overClause}`;
        break;
      case 'LEAD':
        funcExpr = `LEAD(${target}, ${config.offset || 1}) ${overClause}`;
        break;
      case 'FIRST_VALUE':
        funcExpr = `FIRST_VALUE(${target}) ${overClause}`;
        break;
      case 'LAST_VALUE':
        funcExpr = `LAST_VALUE(${target}) ${overClause}`;
        break;
      case 'SUM OVER':
        funcExpr = `SUM(${target}) ${overClause}`;
        break;
      case 'AVG OVER':
        funcExpr = `ROUND(AVG(${target}) ${overClause}, 2)`;
        break;
      case 'COUNT OVER':
        funcExpr = `COUNT(*) ${overClause}`;
        break;
    }

    const sql = this.dialect.formatLimit(`SELECT\n    *,\n    ${funcExpr} AS ${alias}\nFROM ${fullTable}`, limit) + ';';

    const tableDisplay = this.formatTableDisplay(schema, tableName);

    return {
      name: `Window Function (${config.func})`,
      category: 'WINDOW_FUNCTIONS',
      description: `Compute ${config.func} over partitions`,
      tablesUsed: [tableDisplay],
      columnsUsed: [
        ...(config.partitionColumns || []),
        config.orderColumn,
        ...(config.targetColumn ? [config.targetColumn] : [])
      ],
      sql
    };
  }

  /**
   * Builds SQL for Top N per Group
   */
  public generateTopNPerGroup(
    schema: string,
    tableName: string,
    config: TopNPerGroupConfig
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const groupCol = this.quoteIdentifier(config.groupColumn);
    const rankCol = this.quoteIdentifier(config.rankingColumn);
    const n = Math.max(1, Number(config.n) || 5);
    const direction = (config.direction && String(config.direction).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
    const validMethods = ['ROW_NUMBER', 'DENSE_RANK', 'RANK'];
    const func = config.rankingMethod && validMethods.includes(String(config.rankingMethod).toUpperCase())
      ? String(config.rankingMethod).toUpperCase()
      : 'ROW_NUMBER';

    const sql = `WITH ranked AS (
    SELECT
        *,
        ${func}() OVER (
            PARTITION BY ${groupCol}
            ORDER BY ${rankCol} ${direction}
        ) AS rank
    FROM ${fullTable}
)
SELECT *
FROM ranked
WHERE rank <= ${n}
ORDER BY ${groupCol} ASC, rank ASC;`;

    AnalysisSqlGenerator.validateNoPlaceholders(sql, `Top N per ${config.groupColumn}`);

    const tableDisplay = this.formatTableDisplay(schema, tableName);

    return {
      name: `Top ${n} per ${config.groupColumn}`,
      category: 'RANKING',
      description: `Retrieve the top ${n} rows within each ${config.groupColumn} ranked by ${config.rankingColumn} (${direction})`,
      tablesUsed: [tableDisplay],
      columnsUsed: [config.groupColumn, config.rankingColumn],
      sql
    };
  }

  /**
   * Builds SQL for Data Quality Operations
   */
  public generateDataQuality(
    schema: string,
    tableName: string,
    operation: 'null_analysis' | 'duplicate_analysis' | 'column_profiling' | 'numeric_summary' | 'row_count',
    options: {
      column?: string;
      columns?: string[];
      limit?: number;
    } = {}
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);

    switch (operation) {
      case 'null_analysis': {
        const col = options.column ? this.quoteIdentifier(options.column) : 'id';
        const sql = `SELECT
    COUNT(*) AS total_rows,
    COUNT(${col}) AS non_null_count,
    COUNT(*) - COUNT(${col}) AS null_count,
    ROUND(
        (((COUNT(*) - COUNT(${col})) * 1.0) / NULLIF(COUNT(*), 0)) * 100.0,
        2
    ) AS null_percentage
FROM ${fullTable};`;

        return {
          name: `NULL Analysis (${options.column})`,
          category: 'DATA_QUALITY',
          description: `Measure missing values and null percentage for ${options.column}`,
          tablesUsed: [`${schema}.${tableName}`],
          columnsUsed: options.column ? [options.column] : [],
          sql
        };
      }

      case 'duplicate_analysis': {
        const cols = (options.columns && options.columns.length > 0)
          ? options.columns.map(c => this.quoteIdentifier(c))
          : [options.column ? this.quoteIdentifier(options.column) : '1'];

        const sql = this.dialect.formatLimit(`SELECT
    ${cols.join(',\n    ')},
    COUNT(*) AS duplicate_count
FROM ${fullTable}
GROUP BY
    ${cols.join(',\n    ')}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC`, options.limit || 100) + ';';

        return {
          name: `Duplicate Detection (options.columns?.join(', ') || ${options.column})`,
          category: 'DATA_QUALITY',
          description: `Find duplicate groups and frequency counts`,
          tablesUsed: [`${schema}.${tableName}`],
          columnsUsed: options.columns || (options.column ? [options.column] : []),
          sql
        };
      }

      case 'column_profiling': {
        const col = options.column ? this.quoteIdentifier(options.column) : '1';
        const sql = `SELECT
    '${options.column || 'column'}' AS column_name,
    COUNT(*) AS total_rows,
    COUNT(${col}) AS non_null_count,
    COUNT(*) - COUNT(${col}) AS null_count,
    COUNT(DISTINCT ${col}) AS distinct_count,
    CAST(MIN(${col}) AS CHAR(255)) AS min_value,
    CAST(MAX(${col}) AS CHAR(255)) AS max_value
FROM ${fullTable};`;

        return {
          name: `Column Profiling (${options.column})`,
          category: 'DATA_QUALITY',
          description: `Comprehensive data profile (cardinality, nulls, bounds) for ${options.column}`,
          tablesUsed: [`${schema}.${tableName}`],
          columnsUsed: options.column ? [options.column] : [],
          sql
        };
      }

      case 'numeric_summary': {
        const col = options.column ? this.quoteIdentifier(options.column) : 'amount';
        const sql = `SELECT
    COUNT(${col}) AS valid_count,
    MIN(${col}) AS min_val,
    MAX(${col}) AS max_val,
    ROUND((AVG(${col})) * 1.0, 2) AS average_val,
    ROUND((STDDEV(${col})) * 1.0, 2) AS std_deviation
FROM ${fullTable};`;

        return {
          name: `Numeric Summary (${options.column})`,
          category: 'DATA_QUALITY',
          description: `Statistical distribution (min, max, avg, stddev) for ${options.column}`,
          tablesUsed: [`${schema}.${tableName}`],
          columnsUsed: options.column ? [options.column] : [],
          sql
        };
      }

      case 'row_count':
      default:
        return {
          name: 'Row Count',
          category: 'DATA_QUALITY',
          description: `Total records in ${schema}.${tableName}`,
          tablesUsed: [`${schema}.${tableName}`],
          columnsUsed: [],
          sql: `SELECT COUNT(*) AS total_rows FROM ${fullTable};`
        };
    }
  }

  /**
   * Builds SQL for Cohort Analysis
   */
  public generateCohortAnalysis(
    schema: string,
    tableName: string,
    config: CohortConfig
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const userCol = this.quoteIdentifier(config.userIdColumn);
    const firstDateCol = this.quoteIdentifier(config.firstActivityDateColumn);
    const actDateCol = this.quoteIdentifier(config.activityDateColumn);
    const cohortTrunc = this.formatDateTrunc(`MIN(${firstDateCol})`, 'month', schema);
    const actTrunc = this.formatDateTrunc(`t.${actDateCol}`, 'month', schema);

    const dialectType = this.getDialectType(schema);
    let monthDiffExpr = `(DATE_PART('year', t.${actDateCol}) - DATE_PART('year', c.cohort_month)) * 12 + (DATE_PART('month', t.${actDateCol}) - DATE_PART('month', c.cohort_month))`;
    if (dialectType === 'sqlite') {
      monthDiffExpr = `((CAST(strftime('%Y', t.${actDateCol}) AS INTEGER) - CAST(strftime('%Y', c.cohort_month) AS INTEGER)) * 12 + (CAST(strftime('%m', t.${actDateCol}) AS INTEGER) - CAST(strftime('%m', c.cohort_month) AS INTEGER)))`;
    } else if (dialectType === 'mysql') {
      monthDiffExpr = `TIMESTAMPDIFF(MONTH, c.cohort_month, t.${actDateCol})`;
    } else if (dialectType === 'sqlserver') {
      monthDiffExpr = `DATEDIFF(month, c.cohort_month, t.${actDateCol})`;
    } else if (dialectType === 'oracle') {
      monthDiffExpr = `MONTHS_BETWEEN(TRUNC(t.${actDateCol}, 'MM'), c.cohort_month)`;
    }

    const sql = `WITH user_cohorts AS (
    SELECT
        ${userCol},
        ${cohortTrunc} AS cohort_month
    FROM ${fullTable}
    WHERE ${firstDateCol} IS NOT NULL
    GROUP BY ${userCol}
),
user_activities AS (
    SELECT
        t.${userCol},
        c.cohort_month,
        ${actTrunc} AS activity_month,
        ${monthDiffExpr} AS month_number
    FROM ${fullTable} t
    JOIN user_cohorts c ON t.${userCol} = c.${userCol}
    WHERE t.${actDateCol} IS NOT NULL
)
SELECT
    cohort_month,
    month_number,
    COUNT(DISTINCT ${userCol}) AS active_users
FROM user_activities
GROUP BY cohort_month, month_number
ORDER BY cohort_month ASC, month_number ASC;`;

    AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Cohort Retention Matrix');

    return {
      name: 'Cohort Retention Matrix',
      category: 'ADVANCED_ANALYTICS',
      description: `Cohort analysis measuring monthly retention by cohort group`,
      tablesUsed: [this.formatTableDisplay(schema, tableName)],
      columnsUsed: [config.userIdColumn, config.firstActivityDateColumn, config.activityDateColumn],
      sql
    };
  }

  /**
   * Builds SQL for Retention Analysis
   */
  public generateRetentionAnalysis(
    schema: string,
    tableName: string,
    config: RetentionConfig
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const userCol = this.quoteIdentifier(config.userIdColumn);
    const firstDateCol = this.quoteIdentifier(config.firstActivityDateColumn);
    const returnDateCol = this.quoteIdentifier(config.returnDateColumn);
    const unit = config.periodUnit || 'month';
    const periodTrunc = this.formatDateTrunc(`MIN(${firstDateCol})`, unit as any, schema);

    const sql = `WITH first_events AS (
    SELECT
        ${userCol},
        ${periodTrunc} AS cohort_period
    FROM ${fullTable}
    WHERE ${firstDateCol} IS NOT NULL
    GROUP BY ${userCol}
)
SELECT
    f.cohort_period,
    COUNT(DISTINCT f.${userCol}) AS total_cohort_users,
    COUNT(DISTINCT t.${userCol}) AS returning_users,
    ROUND(
        (COUNT(DISTINCT t.${userCol}) * 100.0) / NULLIF(COUNT(DISTINCT f.${userCol}), 0),
        2
    ) AS retention_rate_percent
FROM first_events f
LEFT JOIN ${fullTable} t
    ON f.${userCol} = t.${userCol}
    AND t.${returnDateCol} > f.cohort_period
GROUP BY f.cohort_period
ORDER BY f.cohort_period ASC;`;

    AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Retention Analysis');

    return {
      name: `User Retention (${unit.toUpperCase()})`,
      category: 'ADVANCED_ANALYTICS',
      description: `Track return rates and retention percentages by ${unit}`,
      tablesUsed: [this.formatTableDisplay(schema, tableName)],
      columnsUsed: [config.userIdColumn, config.firstActivityDateColumn, config.returnDateColumn],
      sql
    };
  }

  /**
   * Builds SQL for Funnel Analysis
   */
  public generateFunnelAnalysis(
    schema: string,
    tableName: string,
    config: FunnelConfig
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const userCol = this.quoteIdentifier(config.userIdColumn);
    const eventCol = this.quoteIdentifier(config.eventColumn);

    const stepCases = config.steps.map((step, idx) => {
      const stepNum = idx + 1;
      const alias = this.quoteIdentifier(`step_${stepNum}_${step.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
      return `    COUNT(DISTINCT CASE WHEN ${eventCol} = ${AnalysisSqlGenerator.escapeLiteral(step.eventValue)} THEN ${userCol} END) AS ${alias}`;
    });

    const step1Alias = `step_1_${config.steps[0]?.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'step1'}`;
    const lastStepAlias = `step_${config.steps.length}_${config.steps[config.steps.length - 1]?.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'last'}`;

    const overallConversion = `    ROUND(
        (COUNT(DISTINCT CASE WHEN ${eventCol} = ${AnalysisSqlGenerator.escapeLiteral(config.steps[config.steps.length - 1]?.eventValue || '')} THEN ${userCol} END) * 100.0) /
        NULLIF(COUNT(DISTINCT CASE WHEN ${eventCol} = ${AnalysisSqlGenerator.escapeLiteral(config.steps[0]?.eventValue || '')} THEN ${userCol} END), 0),
        2
    ) AS overall_conversion_rate_percent`;

    const sql = `SELECT\n${stepCases.join(',\n')},\n${overallConversion}\nFROM ${fullTable};`;

    AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Funnel Analysis');

    return {
      name: 'Event Funnel Analysis',
      category: 'ADVANCED_ANALYTICS',
      description: `Track conversion rates across ${config.steps.length} funnel steps`,
      tablesUsed: [this.formatTableDisplay(schema, tableName)],
      columnsUsed: [config.userIdColumn, config.eventColumn],
      sql
    };
  }

  /**
   * Builds SQL for Customer Analysis Templates
   */
  public generateCustomerTemplate(
    schema: string,
    tableName: string,
    template: 'rfm' | 'order_summary' | 'repeat_customers' | 'aov' | 'ranking',
    mapping: {
      customerId: string;
      amountColumn?: string;
      dateColumn?: string;
    }
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const custId = this.quoteIdentifier(mapping.customerId);
    const amountCol = mapping.amountColumn ? this.quoteIdentifier(mapping.amountColumn) : null;
    const dateCol = mapping.dateColumn ? this.quoteIdentifier(mapping.dateColumn) : null;

    switch (template) {
      case 'rfm': {
        const recencyExpr = dateCol
          ? (this.getDialectType(schema) === 'sqlite'
              ? `ROUND((julianday('now') - julianday(MAX(${dateCol}))), 0) AS recency_days`
              : `ROUND((EXTRACT(DAY FROM (NOW() - MAX(${dateCol})))) * 1.0, 0) AS recency_days`)
          : `'N/A' AS recency_days`;
        const monetaryExpr = amountCol
          ? `ROUND((SUM(${amountCol})) * 1.0, 2) AS monetary_total`
          : `COUNT(*) AS monetary_total`;

        const sql = this.dialect.formatLimit(`SELECT
    ${custId},
    ${recencyExpr},
    COUNT(*) AS frequency_orders,
    ${monetaryExpr}
FROM ${fullTable}
GROUP BY ${custId}
ORDER BY frequency_orders DESC`, 100) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Customer RFM');

        return {
          name: 'Customer RFM Analysis',
          category: 'CUSTOMER_ANALYSIS',
          description: `Recency, Frequency, and Monetary distribution per customer`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.customerId, mapping.amountColumn, mapping.dateColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'repeat_customers': {
        const spendExpr = amountCol ? `, ROUND((SUM(${amountCol})) * 1.0, 2) AS lifetime_spend` : '';
        const sql = this.dialect.formatLimit(`SELECT
    ${custId},
    COUNT(*) AS order_count${spendExpr}
FROM ${fullTable}
GROUP BY ${custId}
HAVING COUNT(*) > 1
ORDER BY order_count DESC`, 100) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Repeat Customers');

        return {
          name: 'Repeat Customers (> 1 Purchase)',
          category: 'CUSTOMER_ANALYSIS',
          description: `Identify returning customers with repeat transaction volume`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.customerId, mapping.amountColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'aov': {
        const aovExpr = amountCol
          ? `ROUND(((SUM(${amountCol}) / NULLIF(COUNT(*), 0))) * 1.0, 2) AS average_order_value`
          : `COUNT(*) AS order_count`;

        const baseSql = `SELECT
    ${custId},
    COUNT(*) AS total_orders,
    ${amountCol ? `ROUND((SUM(${amountCol})) * 1.0, 2) AS total_spend,` : ''}
    ${aovExpr}
FROM ${fullTable}
GROUP BY ${custId}
ORDER BY total_orders DESC`;
        const sql = this.dialect.formatLimit(baseSql, 100) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Customer AOV');

        return {
          name: 'Customer Average Order Value (AOV)',
          category: 'CUSTOMER_ANALYSIS',
          description: `Average order value and spend per customer`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.customerId, mapping.amountColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'ranking': {
        const orderMetric = amountCol ? `SUM(${amountCol})` : 'COUNT(*)';
        const baseSql = `SELECT
    ${custId},
    COUNT(*) AS total_orders,
    ${amountCol ? `ROUND((SUM(${amountCol})) * 1.0, 2) AS total_spend,` : ''}
    DENSE_RANK() OVER (ORDER BY ${orderMetric} DESC) AS customer_rank
FROM ${fullTable}
GROUP BY ${custId}
ORDER BY customer_rank ASC`;
        const sql = this.dialect.formatLimit(baseSql, 100) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Customer Ranking');

        return {
          name: 'Customer Value Ranking',
          category: 'CUSTOMER_ANALYSIS',
          description: `Rank customers by total value/orders using DENSE_RANK()`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.customerId, mapping.amountColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'order_summary':
      default: {
        const baseSql = `SELECT
    ${custId},
    COUNT(*) AS total_orders,
    ${amountCol ? `ROUND((SUM(${amountCol})) * 1.0, 2) AS total_spend,` : ''}
    ${dateCol ? `MIN(${dateCol}) AS first_order_date, MAX(${dateCol}) AS last_order_date,` : ''}
    COUNT(*) AS order_count
FROM ${fullTable}
GROUP BY ${custId}
ORDER BY total_orders DESC`;
        const sql = this.dialect.formatLimit(baseSql, 100) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Customer Order Summary');

        return {
          name: 'Customer Order Summary',
          category: 'CUSTOMER_ANALYSIS',
          description: `Aggregate order metrics and lifetime dates per customer`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.customerId, mapping.amountColumn, mapping.dateColumn].filter(Boolean) as string[],
          sql
        };
      }
    }
  }

  /**
   * Builds SQL for Sales Analysis Templates
   */
  public generateSalesTemplate(
    schema: string,
    tableName: string,
    template: 'total_sales' | 'sales_by_month' | 'sales_by_dimension' | 'aov',
    mapping: {
      revenueColumn: string;
      dateColumn?: string;
      dimensionColumn?: string;
      quantityColumn?: string;
    }
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const revCol = this.quoteIdentifier(mapping.revenueColumn);

    switch (template) {
      case 'sales_by_month': {
        const dateCol = mapping.dateColumn ? this.quoteIdentifier(mapping.dateColumn) : 'created_at';
        const periodExpr = this.formatDateTrunc(dateCol, 'month', schema);
        const sql = `SELECT
    ${periodExpr} AS sales_month,
    ROUND((SUM(${revCol})) * 1.0, 2) AS total_revenue,
    COUNT(*) AS order_count,
    ROUND((AVG(${revCol})) * 1.0, 2) AS avg_order_value
FROM ${fullTable}
WHERE ${dateCol} IS NOT NULL
GROUP BY ${periodExpr}
ORDER BY sales_month ASC;`;

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Sales by Month');

        return {
          name: 'Monthly Sales Performance',
          category: 'SALES_ANALYSIS',
          description: `Monthly total sales, order count, and average order value`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.revenueColumn, mapping.dateColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'sales_by_dimension': {
        const dimCol = mapping.dimensionColumn ? this.quoteIdentifier(mapping.dimensionColumn) : 'category';
        const sql = this.dialect.formatLimit(`SELECT
    ${dimCol} AS category_or_region,
    ROUND((SUM(${revCol})) * 1.0, 2) AS total_revenue,
    COUNT(*) AS transaction_count,
    ROUND(
        (SUM(${revCol}) * 100.0) / NULLIF(SUM(SUM(${revCol})) OVER (), 0),
        2
    ) AS contribution_percent
FROM ${fullTable}
GROUP BY ${dimCol}
ORDER BY total_revenue DESC`, 50) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Sales by Dimension');

        return {
          name: `Sales by ${mapping.dimensionColumn || 'Category'}`,
          category: 'SALES_ANALYSIS',
          description: `Breakdown of sales revenue and contribution % by dimension`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.revenueColumn, mapping.dimensionColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'total_sales':
      default: {
        const sql = `SELECT
    COUNT(*) AS total_transactions,
    ROUND((SUM(${revCol})) * 1.0, 2) AS total_revenue,
    ROUND((AVG(${revCol})) * 1.0, 2) AS average_order_value,
    MIN(${revCol}) AS min_transaction,
    MAX(${revCol}) AS max_transaction
FROM ${fullTable};`;

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Total Sales Overview');

        return {
          name: 'Total Sales Overview',
          category: 'SALES_ANALYSIS',
          description: `High-level sales revenue metrics and averages`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.revenueColumn],
          sql
        };
      }
    }
  }

  /**
   * Builds SQL for Product Analysis Templates
   */
  public generateProductTemplate(
    schema: string,
    tableName: string,
    template: 'product_revenue' | 'product_ranking' | 'product_contribution' | 'top_products',
    mapping: {
      productColumn: string;
      measureColumn?: string;
    }
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const prodCol = this.quoteIdentifier(mapping.productColumn);
    const measureCol = mapping.measureColumn ? this.quoteIdentifier(mapping.measureColumn) : null;
    const metricExpr = measureCol ? `SUM(${measureCol})` : 'COUNT(*)';

    switch (template) {
      case 'product_contribution': {
        const sql = this.dialect.formatLimit(`SELECT
    ${prodCol} AS product_identifier,
    ${metricExpr} AS metric_volume,
    ROUND(
        (${metricExpr} * 100.0) / NULLIF(SUM(${metricExpr}) OVER (), 0),
        2
    ) AS revenue_contribution_percent
FROM ${fullTable}
GROUP BY ${prodCol}
ORDER BY metric_volume DESC`, 50) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Product Contribution');

        return {
          name: 'Product Revenue Contribution %',
          category: 'PRODUCT_ANALYSIS',
          description: `Percentage share of total revenue per product using window functions`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.productColumn, mapping.measureColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'product_ranking': {
        const sql = this.dialect.formatLimit(`SELECT
    ${prodCol} AS product_identifier,
    ${metricExpr} AS total_metric,
    DENSE_RANK() OVER (ORDER BY ${metricExpr} DESC) AS product_rank
FROM ${fullTable}
GROUP BY ${prodCol}
ORDER BY product_rank ASC`, 50) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Product Ranking');

        return {
          name: 'Product Performance Ranking',
          category: 'PRODUCT_ANALYSIS',
          description: `Rank products by volume/revenue using DENSE_RANK()`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.productColumn, mapping.measureColumn].filter(Boolean) as string[],
          sql
        };
      }

      case 'product_revenue':
      case 'top_products':
      default: {
        const baseSql = `SELECT
    ${prodCol} AS product_identifier,
    COUNT(*) AS units_or_orders${measureCol ? `,\n    ROUND((SUM(${measureCol})) * 1.0, 2) AS total_revenue,\n    ROUND((AVG(${measureCol})) * 1.0, 2) AS avg_price` : ''}
FROM ${fullTable}
GROUP BY ${prodCol}
ORDER BY units_or_orders DESC`;
        const sql = this.dialect.formatLimit(baseSql, 50) + ';';

        AnalysisSqlGenerator.validateNoPlaceholders(sql, 'Product Revenue');

        return {
          name: 'Product Revenue & Volume',
          category: 'PRODUCT_ANALYSIS',
          description: `Sales revenue and transaction quantity per product`,
          tablesUsed: [this.formatTableDisplay(schema, tableName)],
          columnsUsed: [mapping.productColumn, mapping.measureColumn].filter(Boolean) as string[],
          sql
        };
      }
    }
  }

  /**
   * Data Quality: Exact Row Count
   */
  public generateRowCount(schema: string, tableName: string): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const sql = `SELECT COUNT(*) AS total_rows FROM ${fullTable};`;
    return {
      name: 'Table Row Count',
      category: 'DATA_QUALITY',
      description: `Exact table row count for ${tableName}`,
      tablesUsed: [`${schema}.${tableName}`],
      columnsUsed: [],
      sql
    };
  }

  /**
   * Data Quality: NULL Analysis
   */
  public generateNullAnalysis(
    schema: string,
    tableName: string,
    column: string
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const col = this.quoteIdentifier(column);
    const sql = `SELECT
    COUNT(*) AS total_records,
    COUNT(${col}) AS non_null_count,
    COUNT(*) - COUNT(${col}) AS null_count,
    ROUND(
        ((COUNT(*) - COUNT(${col})) * 100.0) / NULLIF(COUNT(*), 0),
        2
    ) AS null_percentage
FROM ${fullTable};`;

    return {
      name: `NULL Analysis (${column})`,
      category: 'DATA_QUALITY',
      description: `Count missing NULL values and percentage for ${column} ${column}`,
      tablesUsed: [`${schema}.${tableName}`],
      columnsUsed: [column],
      sql
    };
  }

  /**
   * Data Quality: Duplicate Detection
   */
  public generateDuplicateDetection(
    schema: string,
    tableName: string,
    columns: string[],
    limit: number = 50
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const quotedCols = columns.map(c => this.quoteIdentifier(c)).join(', ');
    const sql = this.dialect.formatLimit(`SELECT
    ${quotedCols},
    COUNT(*) AS duplicate_count
FROM ${fullTable}
GROUP BY ${quotedCols}
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC`, limit) + ';';

    return {
      name: `Duplicate Detection (${columns.join(', ')})`,
      category: 'DATA_QUALITY',
      description: `Find duplicate composite rows on (${columns.join(', ')}) with COUNT(*) > 1`,
      tablesUsed: [`${schema}.${tableName}`],
      columnsUsed: columns,
      sql
    };
  }

  /**
   * Data Quality: Column Health Profile
   */
  public generateColumnProfile(
    schema: string,
    tableName: string,
    column: string
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const col = this.quoteIdentifier(column);
    const sql = `SELECT
    '${column}' AS column_name,
    COUNT(*) AS total_rows,
    COUNT(${col}) AS non_null_count,
    COUNT(*) - COUNT(${col}) AS null_count,
    COUNT(DISTINCT ${col}) AS distinct_values,
    CAST(MIN(${col}) AS CHAR(255)) AS min_value,
    CAST(MAX(${col}) AS CHAR(255)) AS max_value
FROM ${fullTable};`;

    return {
      name: `Column Profile (${column})`,
      category: 'DATA_QUALITY',
      description: `Deep ${column} health profiling for ${column}`,
      tablesUsed: [`${schema}.${tableName}`],
      columnsUsed: [column],
      sql
    };
  }

  /**
   * Data Quality: Statistical Summary (Numeric)
   */
  public generateNumericSummary(
    schema: string,
    tableName: string,
    column: string
  ): GeneratedAnalysisQuery {
    const fullTable = this.quoteTable(schema, tableName);
    const col = this.quoteIdentifier(column);
    const sql = `SELECT
    COUNT(${col}) AS count_valid,
    ROUND((AVG(${col})) * 1.0, 4) AS average,
    ROUND((STDDEV(${col})) * 1.0, 4) AS std_deviation,
    ROUND((VARIANCE(${col})) * 1.0, 4) AS variance,
    MIN(${col}) AS minimum,
    MAX(${col}) AS maximum
FROM ${fullTable};`;

    return {
      name: `Numeric Summary (${column})`,
      category: 'DATA_QUALITY',
      description: `Statistical distribution and spread metrics for ${column}`,
      tablesUsed: [`${schema}.${tableName}`],
      columnsUsed: [column],
      sql
    };
  }
}
