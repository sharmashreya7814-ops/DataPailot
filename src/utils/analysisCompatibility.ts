import { TableColumnInfo } from '../types/database';

export interface ColumnClassification {
  numericColumns: TableColumnInfo[];
  dateColumns: TableColumnInfo[];
  stringColumns: TableColumnInfo[];
  idColumns: TableColumnInfo[];
  allColumns: TableColumnInfo[];
}

export type SemanticRole =
  | 'monetary'
  | 'product'
  | 'customer'
  | 'date'
  | 'dimension'
  | 'event'
  | 'quantity'
  | 'id'
  | 'numeric';

export function classifyColumns(columns: TableColumnInfo[]): ColumnClassification {
  const numericTypes = new Set([
    'int', 'int2', 'int4', 'int8', 'integer', 'bigint', 'smallint',
    'decimal', 'numeric', 'real', 'double precision', 'float', 'float4', 'float8', 'money', 'number'
  ]);

  const dateTypes = new Set([
    'date', 'timestamp', 'timestamptz', 'timestamp without time zone',
    'timestamp with time zone', 'time', 'timetz', 'datetime'
  ]);

  const stringTypes = new Set([
    'varchar', 'character varying', 'text', 'char', 'character', 'citext', 'string', 'nvarchar', 'nchar'
  ]);

  const numericColumns: TableColumnInfo[] = [];
  const dateColumns: TableColumnInfo[] = [];
  const stringColumns: TableColumnInfo[] = [];
  const idColumns: TableColumnInfo[] = [];

  for (const col of columns) {
    const dt = (col.dataType || '').toLowerCase();
    const name = (col.name || '').toLowerCase();

    const isNum = numericTypes.has(dt) || dt.includes('int') || dt.includes('numeric') || dt.includes('decimal') || dt.includes('double') || dt.includes('real') || dt.includes('float') || dt.includes('money');
    const isDt = dateTypes.has(dt) || dt.includes('date') || dt.includes('timestamp') || dt.includes('time') || name.includes('date') || name.includes('timestamp') || name.endsWith('_at') || name.endsWith('_time');
    const isStr = stringTypes.has(dt) || dt.includes('char') || dt.includes('text') || dt.includes('string');

    if (isNum) numericColumns.push(col);
    if (isDt) dateColumns.push(col);
    if (isStr) stringColumns.push(col);

    if (
      col.isPrimaryKey ||
      col.isForeignKey ||
      name.endsWith('_id') ||
      name.startsWith('id_') ||
      name === 'id' ||
      dt.includes('uuid')
    ) {
      idColumns.push(col);
    }
  }

  return {
    numericColumns,
    dateColumns,
    stringColumns,
    idColumns,
    allColumns: columns
  };
}

/**
 * Smart Semantic Field Mapper for Analysis Toolkit
 * Scores and selects appropriate columns based on semantic roles and data types.
 */
export class SmartFieldMapper {
  /**
   * Computes a semantic match score for a column given a target semantic role.
   * Higher score indicates stronger semantic alignment.
   */
  public static scoreColumn(col: TableColumnInfo, role: SemanticRole): number {
    const name = (col.name || '').toLowerCase().trim();
    const dt = (col.dataType || '').toLowerCase().trim();

    const isNumericType =
      dt.includes('int') ||
      dt.includes('numeric') ||
      dt.includes('decimal') ||
      dt.includes('double') ||
      dt.includes('real') ||
      dt.includes('float') ||
      dt.includes('money') ||
      dt.includes('number');

    const isDateType =
      dt.includes('date') ||
      dt.includes('timestamp') ||
      dt.includes('datetime');

    const isStringType =
      dt.includes('char') ||
      dt.includes('text') ||
      dt.includes('string') ||
      dt.includes('varchar');

    const isIdColumn =
      col.isPrimaryKey ||
      col.isForeignKey ||
      name === 'id' ||
      name.endsWith('_id') ||
      name.startsWith('id_') ||
      (name.endsWith('id') && name.length <= 8 && !name.includes('paid') && !name.includes('valid')) ||
      dt.includes('uuid');

    switch (role) {
      case 'monetary': {
        if (!isNumericType && !dt.includes('money')) return -1000;
        let score = 0;

        // Severe penalty for ID columns so order_id / customer_id never beats a real metric
        if (isIdColumn) score -= 500;
        if (name.includes('id') && !name.includes('paid')) score -= 200;

        // Specific high-priority monetary terms
        if (/^(net_sales|total_sales|gross_sales|total_revenue|revenue|sales|total_amount|net_amount|grand_total|sales_amount|sales_total|lifetime_spend|total_spend|total_revenue)$/i.test(name)) {
          score += 150;
        } else if (name.includes('revenue') || name.includes('sales') || name.includes('spend')) {
          score += 120;
        } else if (name.includes('amount') || name.includes('price') || name.includes('cost') || name.includes('margin') || name.includes('profit') || name.includes('income')) {
          score += 100;
        } else if (name.includes('total') || name.includes('val') || name.includes('value') || name.includes('subtotal') || name.includes('fee')) {
          score += 60;
        }

        // Penalty for quantity / date parts masquerading as numeric
        if (name.includes('quantity') || name.includes('qty') || name.includes('count') || name.includes('units') || name.includes('pieces')) {
          score -= 80;
        }
        if (name.includes('year') || name.includes('month') || name.includes('day') || name.includes('zip') || name.includes('postal')) {
          score -= 100;
        }

        // Float / Decimal / Real types are much more likely to be monetary amounts than integer IDs
        if (dt.includes('real') || dt.includes('float') || dt.includes('double') || dt.includes('decimal') || dt.includes('numeric') || dt.includes('money')) {
          score += 20;
        }

        return score;
      }

      case 'product': {
        let score = 0;

        // Explicit product terms
        if (/^(product|product_name|product_title|item_name|item|sku)$/i.test(name)) {
          score += 160;
        } else if (name.includes('product') && (name.includes('name') || name.includes('title') || name.includes('desc'))) {
          score += 140;
        } else if (name.includes('product') || name.includes('sku') || name.includes('item')) {
          score += 100;
        } else if (name.includes('article') || name.includes('goods') || name.includes('model') || name.includes('merchandise')) {
          score += 70;
        } else if (name.includes('title') || name.includes('name')) {
          score += 40;
        }

        // Penalty for location / geography
        if (name.includes('city') || name.includes('state') || name.includes('country') || name.includes('region') || name.includes('postal') || name.includes('zip') || name.includes('address')) {
          score -= 200;
        }

        // Penalty for customer / user / order
        if (name.includes('customer') || name.includes('user') || name.includes('order') || name.includes('client') || name.includes('rep') || name.includes('employee')) {
          score -= 120;
        }

        // Penalty for category / taxonomy (prefer specific product over broad category)
        if (name === 'category' || name === 'department' || name === 'segment') {
          score -= 40;
        }

        // Type preference
        if (isStringType) score += 20;
        if (isNumericType && !name.includes('product')) score -= 60;

        return score;
      }

      case 'customer': {
        let score = 0;

        if (/^(customer_id|user_id|client_id|account_id|member_id|subscriber_id|cust_id)$/i.test(name)) {
          score += 180;
        } else if (name.includes('customer') || name.includes('user') || name.includes('client') || name.includes('account') || name.includes('member') || name.includes('subscriber')) {
          score += 140;
        } else if (name === 'id' || col.isPrimaryKey || name.endsWith('_id') || name.startsWith('id_')) {
          score += 60; // unique identifier fallback
        }

        // Slight adjustment for transaction / order IDs when looking for customer, but keep positive
        if (name.includes('order') || name.includes('transaction') || name.includes('invoice')) {
          score -= 15;
        }

        // Penalty for location, taxonomy, numeric metrics, or dates masquerading as customer
        if (
          name.includes('city') ||
          name.includes('state') ||
          name.includes('country') ||
          name.includes('region') ||
          name.includes('postal') ||
          name.includes('zip') ||
          name.includes('address') ||
          name.includes('category') ||
          name.includes('product') ||
          name.includes('item') ||
          name.includes('price') ||
          name.includes('sales') ||
          name.includes('revenue') ||
          name.includes('amount') ||
          name.includes('qty') ||
          name.includes('quantity') ||
          name.includes('date') ||
          name.includes('time') ||
          name.includes('status')
        ) {
          score -= 250;
        }

        return score;
      }

      case 'date': {
        let score = 0;
        if (isDateType) score += 50;

        if (/^(order_date|transaction_date|event_date|created_at|creation_date|signup_date|registered_at|activity_date|invoice_date|timestamp)$/i.test(name)) {
          score += 150;
        } else if (name.includes('date') || name.includes('time') || name.includes('created') || name.includes('timestamp')) {
          score += 100;
        } else if (name.includes('updated') || name.includes('period') || name.includes('day') || name.includes('month') || name.includes('year')) {
          score += 60;
        }

        if (!isDateType && !name.includes('date') && !name.includes('time') && !name.includes('at')) {
          score -= 200;
        }

        return score;
      }

      case 'dimension': {
        let score = 0;
        if (isStringType) score += 30;

        if (/^(category|category_name|region|city|segment|channel|department|country|brand|status|type|genre)$/i.test(name)) {
          score += 140;
        } else if (name.includes('category') || name.includes('region') || name.includes('city') || name.includes('segment') || name.includes('channel') || name.includes('department') || name.includes('country') || name.includes('brand') || name.includes('status') || name.includes('type') || name.includes('tier') || name.includes('group') || name.includes('zone') || name.includes('territory') || name.includes('gender')) {
          score += 100;
        }

        // Penalty for ID and numeric measures
        if (isIdColumn) score -= 150;
        if (isNumericType) score -= 100;
        if (name.includes('description') || name.includes('notes') || name.includes('comment') || name.includes('message')) score -= 60;

        return score;
      }

      case 'event': {
        let score = 0;
        if (isStringType) score += 20;

        if (/^(event|event_name|event_type|action|action_name|step|step_name|funnel_step|activity|activity_name|stage|stage_name|page_name|screen_name)$/i.test(name)) {
          score += 180;
        } else if (name.includes('event') || name.includes('action') || name.includes('step') || name.includes('activity') || name.includes('stage')) {
          score += 130;
        } else if (name.includes('status') || name.includes('state') || name.includes('milestone')) {
          score += 50;
        }

        // Heavy penalty for location, entity, or ID columns so city/country/order_id is never picked when an event exists
        if (name.includes('city') || name.includes('country') || name.includes('state') || name.includes('region') || name.includes('address') || name.includes('zip') || name.includes('postal')) {
          score -= 250;
        }
        if (name.includes('product') || name.includes('customer') || name.includes('user') || name.includes('category')) {
          score -= 100;
        }
        if (isIdColumn) score -= 150;

        return score;
      }

      case 'quantity': {
        if (!isNumericType) return -1000;
        let score = 0;

        if (/^(quantity|qty|units|units_sold|item_count|volume|pieces|items)$/i.test(name)) {
          score += 150;
        } else if (name.includes('quantity') || name.includes('qty') || name.includes('units') || name.includes('volume') || name.includes('pieces')) {
          score += 110;
        } else if (name.includes('count') && !name.includes('discount')) {
          score += 70;
        }

        if (dt.includes('int')) score += 20;
        if (isIdColumn) score -= 300;
        if (name.includes('price') || name.includes('revenue') || name.includes('amount') || name.includes('sales') || name.includes('cost') || name.includes('spend')) {
          score -= 80;
        }

        return score;
      }

      case 'numeric':
      default: {
        if (!isNumericType) return -1000;
        let score = 0;
        if (!isIdColumn) score += 50;
        if (name.includes('sales') || name.includes('revenue') || name.includes('amount') || name.includes('price') || name.includes('total') || name.includes('qty') || name.includes('quantity')) {
          score += 50;
        }
        return score;
      }
    }
  }

  /**
   * Suggests the best matching column for a given semantic role with robust fallbacks.
   */
  public static suggestColumn(columns: TableColumnInfo[], role: SemanticRole): string {
    if (!columns || columns.length === 0) return '';

    const scored = columns
      .map(col => ({ col, score: this.scoreColumn(col, role) }))
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > -150) {
      return scored[0].col.name;
    }

    // Role-specific fallback
    const { numericColumns, dateColumns, stringColumns, idColumns } = classifyColumns(columns);

    switch (role) {
      case 'monetary': {
        const nonIdNum = numericColumns.find(c => !c.name.toLowerCase().endsWith('_id') && c.name.toLowerCase() !== 'id');
        return nonIdNum?.name || numericColumns[0]?.name || columns[0]?.name || '';
      }
      case 'product':
        return stringColumns[0]?.name || columns[0]?.name || '';
      case 'customer':
        return idColumns[0]?.name || columns.find(c => c.name.toLowerCase().includes('id'))?.name || columns[0]?.name || '';
      case 'date':
        return dateColumns[0]?.name || columns.find(c => c.name.toLowerCase().includes('date'))?.name || '';
      case 'dimension':
        return stringColumns[0]?.name || columns[0]?.name || '';
      case 'event':
        return stringColumns[0]?.name || columns[0]?.name || '';
      case 'quantity':
        return numericColumns.find(c => c.name.toLowerCase().includes('qty') || c.name.toLowerCase().includes('quantity'))?.name || numericColumns[0]?.name || '';
      default:
        return columns[0]?.name || '';
    }
  }
}

export interface CompatibilityCheckResult {
  isCompatible: boolean;
  missingMessage?: string;
  suggestions: Record<string, string>;
}

/**
 * Checks compatibility for specific analysis operations and generates smart suggestions
 */
export class AnalysisCompatibility {
  public static checkDateAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { dateColumns } = classifyColumns(columns);

    if (dateColumns.length === 0) {
      return {
        isCompatible: false,
        missingMessage: 'Requires at least one DATE or TIMESTAMP column in this table.',
        suggestions: {}
      };
    }

    const suggestedDate = SmartFieldMapper.suggestColumn(columns, 'date');
    const suggestedMeasure = SmartFieldMapper.suggestColumn(columns, 'monetary');

    return {
      isCompatible: true,
      suggestions: {
        dateColumn: suggestedDate,
        measureColumn: suggestedMeasure || '*'
      }
    };
  }

  public static checkCustomerAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { idColumns } = classifyColumns(columns);

    const customerIdCol = SmartFieldMapper.suggestColumn(columns, 'customer');

    if (!customerIdCol && idColumns.length === 0 && columns.length > 0) {
      const fallbackId = columns.find(c => c.name.toLowerCase().includes('id'));
      if (!fallbackId) {
        return {
          isCompatible: false,
          missingMessage: 'No Customer or User Identifier column (e.g. customer_id, user_id, id) found in this table.',
          suggestions: {}
        };
      }
    }

    const suggestedAmount = SmartFieldMapper.suggestColumn(columns, 'monetary');
    const suggestedDate = SmartFieldMapper.suggestColumn(columns, 'date');

    return {
      isCompatible: true,
      suggestions: {
        customerId: customerIdCol || idColumns[0]?.name || 'id',
        amountColumn: suggestedAmount || '',
        dateColumn: suggestedDate || ''
      }
    };
  }

  public static checkSalesAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { numericColumns } = classifyColumns(columns);

    if (numericColumns.length === 0) {
      return {
        isCompatible: false,
        missingMessage: 'No NUMERIC column (amount, revenue, quantity, price) found in this table for sales calculations.',
        suggestions: {}
      };
    }

    const suggestedRevenue = SmartFieldMapper.suggestColumn(columns, 'monetary');
    const suggestedQty = SmartFieldMapper.suggestColumn(columns, 'quantity');
    const suggestedDate = SmartFieldMapper.suggestColumn(columns, 'date');
    const suggestedCategory = SmartFieldMapper.suggestColumn(columns, 'dimension');

    return {
      isCompatible: true,
      suggestions: {
        revenueColumn: suggestedRevenue || numericColumns[0]?.name || '',
        quantityColumn: suggestedQty || '',
        dateColumn: suggestedDate || '',
        categoryColumn: suggestedCategory || ''
      }
    };
  }

  public static checkProductAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const productIdentifier = SmartFieldMapper.suggestColumn(columns, 'product');

    if (!productIdentifier) {
      return {
        isCompatible: false,
        missingMessage: 'Requires a product name, title, SKU, or category column in this table.',
        suggestions: {}
      };
    }

    const suggestedMeasure = SmartFieldMapper.suggestColumn(columns, 'monetary');

    return {
      isCompatible: true,
      suggestions: {
        productColumn: productIdentifier,
        measureColumn: suggestedMeasure || ''
      }
    };
  }

  public static checkCohortAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const { idColumns, dateColumns } = classifyColumns(columns);

    if (idColumns.length === 0 && !columns.some(c => c.name.toLowerCase().includes('id') || c.name.toLowerCase().includes('user'))) {
      return {
        isCompatible: false,
        missingMessage: 'Cohort analysis requires a User/Customer Identifier column (e.g. user_id, customer_id, id).',
        suggestions: {}
      };
    }

    if (dateColumns.length < 1 && !columns.some(c => c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time'))) {
      return {
        isCompatible: false,
        missingMessage: 'Cohort analysis requires at least one DATE or TIMESTAMP column (activity date or signup date).',
        suggestions: {}
      };
    }

    const userCol = SmartFieldMapper.suggestColumn(columns, 'customer');
    const firstDateCol = SmartFieldMapper.suggestColumn(columns, 'date');
    const activityDateCol = dateColumns.find(c => c.name !== firstDateCol)?.name || firstDateCol;

    return {
      isCompatible: true,
      suggestions: {
        userIdColumn: userCol,
        firstActivityDateColumn: firstDateCol,
        activityDateColumn: activityDateCol
      }
    };
  }

  public static checkFunnelAnalysis(columns: TableColumnInfo[]): CompatibilityCheckResult {
    const suggestedUser = SmartFieldMapper.suggestColumn(columns, 'customer');
    const suggestedEvent = SmartFieldMapper.suggestColumn(columns, 'event');

    return {
      isCompatible: true,
      suggestions: {
        userIdColumn: suggestedUser,
        eventColumn: suggestedEvent
      }
    };
  }
}
