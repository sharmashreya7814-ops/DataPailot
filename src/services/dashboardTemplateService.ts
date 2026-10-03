import { Dashboard, DashboardWidget } from '../types/dashboard';
import { DiscoveredTable } from '../types/database';
import { DashboardService } from './dashboardService';

export interface TemplateDefinition {
  id: 'sales' | 'customer' | 'product' | 'operations';
  name: string;
  description: string;
  icon: string;
  category: string;
  widgets: {
    title: string;
    description: string;
    chartType: DashboardWidget['chartType'];
    size: DashboardWidget['size'];
    suggestedTableKeywords: string[];
    suggestedMetricName: string;
    defaultSqlPlaceholder: string;
  }[];
}

export const DASHBOARD_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'sales',
    name: 'Sales Performance Dashboard',
    description: 'Executive overview tracking revenue, order volumes, average order value, regional sales, and top product lines.',
    icon: 'TrendingUp',
    category: 'Revenue & Growth',
    widgets: [
      {
        title: 'Total Revenue',
        description: 'Sum of monetary sales across all completed transactions',
        chartType: 'kpi',
        size: { colSpan: 3, height: 180 },
        suggestedTableKeywords: ['order', 'sale', 'payment', 'invoice'],
        suggestedMetricName: 'revenue',
        defaultSqlPlaceholder: 'SELECT SUM(amount) AS total_revenue FROM orders;'
      },
      {
        title: 'Total Orders',
        description: 'Count of unique order records',
        chartType: 'kpi',
        size: { colSpan: 3, height: 180 },
        suggestedTableKeywords: ['order', 'sale'],
        suggestedMetricName: 'order_count',
        defaultSqlPlaceholder: 'SELECT COUNT(*) AS total_orders FROM orders;'
      },
      {
        title: 'Average Order Value (AOV)',
        description: 'Mean monetary value per order transaction',
        chartType: 'kpi',
        size: { colSpan: 3, height: 180 },
        suggestedTableKeywords: ['order', 'sale'],
        suggestedMetricName: 'avg_order_value',
        defaultSqlPlaceholder: 'SELECT AVG(amount) AS average_order_value FROM orders;'
      },
      {
        title: 'Monthly Revenue Trend',
        description: 'Chronological sales progression over time',
        chartType: 'line',
        size: { colSpan: 6, height: 320 },
        suggestedTableKeywords: ['order', 'sale'],
        suggestedMetricName: 'monthly_revenue',
        defaultSqlPlaceholder: 'SELECT DATE_TRUNC(\'month\', created_at) AS month, SUM(amount) AS revenue FROM orders GROUP BY 1 ORDER BY 1;'
      },
      {
        title: 'Revenue by Region / Territory',
        description: 'Geographical sales contribution breakdown',
        chartType: 'bar',
        size: { colSpan: 6, height: 320 },
        suggestedTableKeywords: ['order', 'customer', 'region'],
        suggestedMetricName: 'regional_revenue',
        defaultSqlPlaceholder: 'SELECT region, SUM(amount) AS revenue FROM orders GROUP BY region ORDER BY revenue DESC LIMIT 10;'
      }
    ]
  },
  {
    id: 'customer',
    name: 'Customer Analytics Dashboard',
    description: 'Track customer counts, user acquisition, repeat buyer rates, and top customer lifetime values.',
    icon: 'Users',
    category: 'Customer Success',
    widgets: [
      {
        title: 'Total Customers',
        description: 'Total registered or active customer accounts',
        chartType: 'kpi',
        size: { colSpan: 4, height: 180 },
        suggestedTableKeywords: ['customer', 'user', 'account', 'client'],
        suggestedMetricName: 'customer_count',
        defaultSqlPlaceholder: 'SELECT COUNT(*) AS total_customers FROM customers;'
      },
      {
        title: 'New Customer Signups',
        description: 'Recent customer acquisition volume',
        chartType: 'kpi',
        size: { colSpan: 4, height: 180 },
        suggestedTableKeywords: ['customer', 'user'],
        suggestedMetricName: 'new_customers',
        defaultSqlPlaceholder: 'SELECT COUNT(*) AS new_customers FROM customers WHERE created_at >= NOW() - INTERVAL \'30 days\';'
      },
      {
        title: 'Top Customers by Spend',
        description: 'High-value customer concentration',
        chartType: 'bar',
        size: { colSpan: 8, height: 320 },
        suggestedTableKeywords: ['customer', 'order'],
        suggestedMetricName: 'top_customers',
        defaultSqlPlaceholder: 'SELECT customer_id, SUM(amount) AS total_spend FROM orders GROUP BY customer_id ORDER BY total_spend DESC LIMIT 10;'
      },
      {
        title: 'Customer Distribution by Segment',
        description: 'Breakdown of customer tier, status, or plan',
        chartType: 'pie',
        size: { colSpan: 4, height: 320 },
        suggestedTableKeywords: ['customer', 'user'],
        suggestedMetricName: 'segment_distribution',
        defaultSqlPlaceholder: 'SELECT status, COUNT(*) AS count FROM customers GROUP BY status;'
      }
    ]
  },
  {
    id: 'product',
    name: 'Product Catalog & Inventory',
    description: 'Measure product inventory counts, category distribution, top revenue generators, and catalog pricing.',
    icon: 'Package',
    category: 'Catalog & Inventory',
    widgets: [
      {
        title: 'Total Active Products',
        description: 'Count of distinct product SKUs available in catalog',
        chartType: 'kpi',
        size: { colSpan: 4, height: 180 },
        suggestedTableKeywords: ['product', 'item', 'inventory', 'sku'],
        suggestedMetricName: 'product_count',
        defaultSqlPlaceholder: 'SELECT COUNT(*) AS active_products FROM products;'
      },
      {
        title: 'Products by Category',
        description: 'Catalog depth across product classifications',
        chartType: 'donut',
        size: { colSpan: 4, height: 320 },
        suggestedTableKeywords: ['product', 'category'],
        suggestedMetricName: 'category_share',
        defaultSqlPlaceholder: 'SELECT category, COUNT(*) AS items FROM products GROUP BY category ORDER BY items DESC;'
      },
      {
        title: 'Top Products by Sales Volume',
        description: 'Best-selling product items ordered by quantity',
        chartType: 'bar',
        size: { colSpan: 8, height: 320 },
        suggestedTableKeywords: ['product', 'order_item'],
        suggestedMetricName: 'product_sales',
        defaultSqlPlaceholder: 'SELECT product_name, SUM(quantity) AS total_sold FROM order_items GROUP BY product_name ORDER BY total_sold DESC LIMIT 10;'
      }
    ]
  },
  {
    id: 'operations',
    name: 'Operations & Event Logs',
    description: 'Monitor event frequencies, status code distributions, error rates, and operational timeline metrics.',
    icon: 'Activity',
    category: 'Infrastructure & Ops',
    widgets: [
      {
        title: 'Total Events Logged',
        description: 'System event volume over observed period',
        chartType: 'kpi',
        size: { colSpan: 4, height: 180 },
        suggestedTableKeywords: ['log', 'event', 'audit', 'activity'],
        suggestedMetricName: 'total_events',
        defaultSqlPlaceholder: 'SELECT COUNT(*) AS total_events FROM audit_logs;'
      },
      {
        title: 'Events by Status / Severity',
        description: 'Breakdown of severity levels or completion statuses',
        chartType: 'bar',
        size: { colSpan: 4, height: 300 },
        suggestedTableKeywords: ['log', 'event', 'status'],
        suggestedMetricName: 'severity_breakdown',
        defaultSqlPlaceholder: 'SELECT severity, COUNT(*) AS count FROM event_logs GROUP BY severity;'
      },
      {
        title: 'Operational Event Timeline',
        description: 'Hourly or daily occurrence log frequencies',
        chartType: 'area',
        size: { colSpan: 8, height: 320 },
        suggestedTableKeywords: ['log', 'event', 'timestamp'],
        suggestedMetricName: 'event_timeline',
        defaultSqlPlaceholder: 'SELECT DATE_TRUNC(\'day\', timestamp) AS day, COUNT(*) AS count FROM event_logs GROUP BY 1 ORDER BY 1;'
      }
    ]
  }
];

export class DashboardTemplateService {
  /**
   * Instantiates a template into a live Dashboard.
   * Crucially, template widgets are created with placeholder state requiring real schema mapping.
   */
  public static instantiateTemplate(
    templateId: 'sales' | 'customer' | 'product' | 'operations',
    discoveredTables: DiscoveredTable[]
  ): Dashboard {
    const template = DASHBOARD_TEMPLATES.find(t => t.id === templateId) || DASHBOARD_TEMPLATES[0];
    const now = new Date().toISOString();

    const widgets: DashboardWidget[] = template.widgets.map((w, idx) => {
      // Look for a table that matches any of the suggested keywords
      const matchedTable = discoveredTables.find(t =>
        w.suggestedTableKeywords.some(kw => t.name.toLowerCase().includes(kw))
      );

      const tableName = matchedTable ? matchedTable.name : (discoveredTables[0]?.name || 'your_table');
      const initialSql = matchedTable
        ? `SELECT * FROM "${tableName}" LIMIT 50;`
        : `-- Configure data source: map to an existing table in your database\nSELECT * FROM "${tableName}" LIMIT 50;`;

      return {
        id: `widget-tmpl-${Date.now()}-${idx}`,
        title: w.title,
        description: w.description,
        chartType: w.chartType,
        size: w.size,
        position: {
          order: idx,
          col: 0,
          row: idx
        },
        queryRef: {
          type: 'raw_sql',
          sql: initialSql,
          sourceTable: matchedTable ? tableName : undefined,
          referencedTables: matchedTable ? [tableName] : []
        },
        chartConfig: {
          chartType: w.chartType,
          xAxis: '',
          yAxis: '',
          secondaryMeasures: [],
          aggregation: 'none',
          sortOrder: 'none',
          sortBy: 'x',
          limit: 'all',
          title: w.title,
          subtitle: w.description,
          showLegend: true,
          showDataLabels: false,
          showGrid: true,
          binCount: 20,
          treatNullAsZero: false,
          samplingEnabled: false
        },
        status: matchedTable ? 'idle' : 'schema_changed',
        schemaChangeDetails: matchedTable
          ? undefined
          : {
              description: `This template widget requires mapping to a table in your database (${w.suggestedTableKeywords.join(', ')}). Click 'Configure Data' to select your table.`
            }
      };
    });

    const created: Dashboard = {
      id: `dash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: template.name,
      description: template.description,
      widgets,
      filters: [],
      layout: {
        columns: 12,
        gap: 'md',
        theme: 'dark'
      },
      createdAt: now,
      updatedAt: now,
      permissions: { role: 'owner' },
      autoRefreshInterval: 0
    };

    return DashboardService.saveDashboard(created);
  }
}
