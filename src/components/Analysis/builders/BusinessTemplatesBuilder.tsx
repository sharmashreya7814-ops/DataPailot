import React, { useState } from 'react';
import { Users, DollarSign, Package, Play, AlertCircle, Sparkles, Check } from 'lucide-react';
import { DatabaseApiClient } from '../../../services/databaseApi';
import { TableDetailsResult } from '../../../types/database';
import { GeneratedAnalysisQuery, AnalysisCategory } from '../../../types/analysis';
import { AnalysisCompatibility, classifyColumns, SmartFieldMapper } from '../../../utils/analysisCompatibility';

interface BusinessTemplatesBuilderProps {
  table: TableDetailsResult;
  category: 'CUSTOMER_ANALYSIS' | 'SALES_ANALYSIS' | 'PRODUCT_ANALYSIS';
  onPreviewQuery: (query: GeneratedAnalysisQuery) => void;
}

export const BusinessTemplatesBuilder: React.FC<BusinessTemplatesBuilderProps> = ({
  table,
  category,
  onPreviewQuery
}) => {
  const { numericColumns, dateColumns, stringColumns } = classifyColumns(table.columns);

  // 1. Customer Analysis State
  const custCompat = AnalysisCompatibility.checkCustomerAnalysis(table.columns);
  const [custTemplate, setCustTemplate] = useState<'order_summary' | 'rfm' | 'repeat_customers' | 'aov' | 'ranking'>('order_summary');
  const [custCustomerId, setCustCustomerId] = useState<string>(
    custCompat.suggestions.customerId || SmartFieldMapper.suggestColumn(table.columns, 'customer') || table.columns[0]?.name || ''
  );
  const [custAmountCol, setCustAmountCol] = useState<string>(
    custCompat.suggestions.amountColumn || SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || ''
  );
  const [custDateCol, setCustDateCol] = useState<string>(
    custCompat.suggestions.dateColumn || SmartFieldMapper.suggestColumn(table.columns, 'date') || dateColumns[0]?.name || ''
  );

  // 2. Sales Analysis State
  const salesCompat = AnalysisCompatibility.checkSalesAnalysis(table.columns);
  const [salesTemplate, setSalesTemplate] = useState<'total_sales' | 'sales_by_month' | 'sales_by_dimension'>('total_sales');
  const [salesRevenueCol, setSalesRevenueCol] = useState<string>(
    salesCompat.suggestions.revenueColumn || SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || ''
  );
  const [salesDateCol, setSalesDateCol] = useState<string>(
    salesCompat.suggestions.dateColumn || SmartFieldMapper.suggestColumn(table.columns, 'date') || dateColumns[0]?.name || ''
  );
  const [salesDimCol, setSalesDimCol] = useState<string>(
    salesCompat.suggestions.categoryColumn || SmartFieldMapper.suggestColumn(table.columns, 'dimension') || stringColumns[0]?.name || ''
  );

  // 3. Product Analysis State
  const prodCompat = AnalysisCompatibility.checkProductAnalysis(table.columns);
  const [prodTemplate, setProdTemplate] = useState<'top_products' | 'product_ranking' | 'product_contribution'>('top_products');
  const [prodProductCol, setProdProductCol] = useState<string>(
    prodCompat.suggestions.productColumn || SmartFieldMapper.suggestColumn(table.columns, 'product') || stringColumns[0]?.name || table.columns[0]?.name || ''
  );
  const [prodMeasureCol, setProdMeasureCol] = useState<string>(
    prodCompat.suggestions.measureColumn || SmartFieldMapper.suggestColumn(table.columns, 'monetary') || numericColumns[0]?.name || ''
  );

  // Handle Customer Preview
  const handlePreviewCustomer = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateCustomerTemplate', table.schema, table.name, custTemplate, {
      customerId: custCustomerId,
      amountColumn: custAmountCol || undefined,
      dateColumn: custDateCol || undefined
    });
    onPreviewQuery(query);
  };

  // Handle Sales Preview
  const handlePreviewSales = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateSalesTemplate', table.schema, table.name, salesTemplate, {
      revenueColumn: salesRevenueCol,
      dateColumn: salesDateCol || undefined,
      dimensionColumn: salesDimCol || undefined
    });
    onPreviewQuery(query);
  };

  // Handle Product Preview
  const handlePreviewProduct = async () => {
    const query = await DatabaseApiClient.generateAnalysis('generateProductTemplate', table.schema, table.name, prodTemplate, {
      productColumn: prodProductCol,
      measureColumn: prodMeasureCol || undefined
    });
    onPreviewQuery(query);
  };

  // CUSTOMER ANALYSIS
  if (category === 'CUSTOMER_ANALYSIS') {
    if (!custCompat.isCompatible) {
      return (
        <div className="p-6 rounded-xl bg-amber-950/20 border border-amber-500/30 text-slate-200 space-y-3">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Customer Analysis Incompatible with {table.name}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {custCompat.missingMessage}
          </p>
          <p className="text-[11px] text-slate-500">
            Customer templates require an entity identifier (such as customer_id, user_id, or account_id). Please select an orders, customers, or transactions table from the explorer.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <Users className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span>
            Explore customer lifetime metrics, RFM segmentation (Recency, Frequency, Monetary), returning buyer frequencies, and average order value.
          </span>
        </div>

        {/* Template Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-2 block">
            Select Customer Analysis Template:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'order_summary', title: 'Customer Lifetime Summary', desc: 'Order counts, lifetime spend, first & last order dates' },
              { id: 'rfm', title: 'Customer RFM Preparation', desc: 'Recency days, purchase frequency, monetary totals' },
              { id: 'repeat_customers', title: 'Repeat Customers (> 1 Purchase)', desc: 'Filter loyal buyers with multiple transactions' },
              { id: 'aov', title: 'Average Order Value (AOV)', desc: 'Average transaction ticket size per customer' },
              { id: 'ranking', title: 'Customer Value Ranking', desc: 'Rank top customer accounts using DENSE_RANK()' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setCustTemplate(t.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  custTemplate === t.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold mb-1">{t.title}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Semantic Field Mapping */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Smart Field Mapping (Suggestions from Schema):</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Customer / User ID Column:
              </label>
              <select
                value={custCustomerId}
                onChange={e => setCustCustomerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none"
              >
                {table.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {custCompat.suggestions.customerId === c.name ? '(Suggested)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Amount / Spend Column:
              </label>
              <select
                value={custAmountCol}
                onChange={e => setCustAmountCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
              >
                <option value="">None (Count Orders Only)</option>
                {numericColumns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {custCompat.suggestions.amountColumn === c.name ? '(Suggested)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Date / Timestamp Column:
              </label>
              <select
                value={custDateCol}
                onChange={e => setCustDateCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
              >
                <option value="">None</option>
                {dateColumns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {custCompat.suggestions.dateColumn === c.name ? '(Suggested)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={handlePreviewCustomer}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-950/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Preview Customer Analysis SQL</span>
          </button>
        </div>
      </div>
    );
  }

  // SALES ANALYSIS
  if (category === 'SALES_ANALYSIS') {
    if (!salesCompat.isCompatible) {
      return (
        <div className="p-6 rounded-xl bg-amber-950/20 border border-amber-500/30 text-slate-200 space-y-3">
          <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Sales Analysis Incompatible with {table.name}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {salesCompat.missingMessage}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            Analyze financial and commercial metrics, monthly revenue trends, average ticket sizes, and category share breakdowns.
          </span>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 mb-2 block">
            Select Sales Analysis Template:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'total_sales', title: 'Total Sales Overview', desc: 'Total revenue, transaction count, average order value, min/max' },
              { id: 'sales_by_month', title: 'Monthly Sales Trend', desc: 'Revenue, monthly transaction counts, and AOV over time' },
              { id: 'sales_by_dimension', title: 'Sales by Dimension & Share %', desc: 'Breakdown of revenue and contribution % by category/region' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setSalesTemplate(t.id as any)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  salesTemplate === t.id
                    ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold mb-1">{t.title}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Semantic Field Mapping:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Revenue / Amount Column:
              </label>
              <select
                value={salesRevenueCol}
                onChange={e => setSalesRevenueCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
              >
                {numericColumns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {salesCompat.suggestions.revenueColumn === c.name ? '(Suggested)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Date Column (For Time Trends):
              </label>
              <select
                value={salesDateCol}
                onChange={e => setSalesDateCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
              >
                <option value="">None</option>
                {dateColumns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {salesCompat.suggestions.dateColumn === c.name ? '(Suggested)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Category / Region Dimension:
              </label>
              <select
                value={salesDimCol}
                onChange={e => setSalesDimCol(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none"
              >
                <option value="">None</option>
                {stringColumns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} {salesCompat.suggestions.categoryColumn === c.name ? '(Suggested)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={handlePreviewSales}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-950/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Preview Sales Analysis SQL</span>
          </button>
        </div>
      </div>
    );
  }

  // PRODUCT ANALYSIS
  if (!prodCompat.isCompatible) {
    return (
      <div className="p-6 rounded-xl bg-amber-950/20 border border-amber-500/30 text-slate-200 space-y-3">
        <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
          <AlertCircle className="w-5 h-5" />
          <span>Product Analysis Incompatible with {table.name}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {prodCompat.missingMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <Package className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span>
          Evaluate product catalog velocity, top performers, dense rankings, and revenue contribution percentages.
        </span>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 block">
          Select Product Analysis Template:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'top_products', title: 'Top Products Overview', desc: 'Order volume, units sold, and aggregate product performance' },
            { id: 'product_ranking', title: 'Product Ranking', desc: 'Rank catalog items by performance using DENSE_RANK()' },
            { id: 'product_contribution', title: 'Revenue Contribution %', desc: 'Calculate percentage share of total revenue per item' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setProdTemplate(t.id as any)}
              className={`p-3 rounded-xl border text-left transition-all ${
                prodTemplate === t.id
                  ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-semibold mb-1">{t.title}</div>
              <div className="text-[11px] text-slate-400 leading-snug">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Product Field Mapping:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Product Identifier / Name Column:
            </label>
            <select
              value={prodProductCol}
              onChange={e => setProdProductCol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none"
            >
              {table.columns.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} {prodCompat.suggestions.productColumn === c.name ? '(Suggested)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Performance Measure (Revenue / Quantity):
            </label>
            <select
              value={prodMeasureCol}
              onChange={e => setProdMeasureCol(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none"
            >
              <option value="">None (Count Transactions)</option>
              {numericColumns.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} {prodCompat.suggestions.measureColumn === c.name ? '(Suggested)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handlePreviewProduct}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-950/40"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Preview Product Analysis SQL</span>
        </button>
      </div>
    </div>
  );
};
