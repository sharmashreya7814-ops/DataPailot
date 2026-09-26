import { ChartConfig, DetectedColumn } from '../types/visualization';
import { VisualizationQueryBuilder } from './visualizationQueryBuilder';

export interface ProcessedDataPoint {
  [key: string]: unknown;
  xLabel: string;
  rawValue?: number | null;
}

export interface HistogramBin {
  binRange: string;
  binStart: number;
  binEnd: number;
  count: number;
}

export interface KpiMetricSummary {
  currentValue: number | null;
  formattedCurrent: string;
  previousValue: number | null;
  formattedPrevious: string;
  change: number | null;
  changePercent: number | null;
  hasComparison: boolean;
  metricLabel: string;
}

export class VisualizationDataProcessor {
  /**
   * Main transformer pipeline: handles NULL values, sorts, limits, and pivots series
   */
  public static process(
    rows: Record<string, unknown>[],
    config: ChartConfig,
    columns: DetectedColumn[]
  ): ProcessedDataPoint[] {
    if (!rows || rows.length === 0) return [];

    const xKey = config.xAxis;
    const yKey = config.yAxis;
    const secondaryKeys = config.secondaryMeasures || [];
    const seriesGroupKey = config.seriesGroup;

    // Expected query alias when measure is aggregated (e.g. total_orders, total_sales)
    const expectedAlias = VisualizationQueryBuilder.generateMeasureAlias(
      yKey,
      config.aggregation || 'none'
    );

    // 1. Map raw rows into points with safe NULL handling
    let data: ProcessedDataPoint[] = rows.map((row, idx) => {
      const rawX = row[xKey];
      
      // Resolve raw Y value:
      // 1. Exact match by yKey (e.g. Order_ID or raw column)
      // 2. Alias match from query generator (e.g. total_orders, total_customers)
      // 3. Fallback: first non-X column containing a numeric value
      let rawY = row[yKey];
      if (rawY === undefined && expectedAlias && row[expectedAlias] !== undefined) {
        rawY = row[expectedAlias];
      }
      if (rawY === undefined) {
        const candidateKey = Object.keys(row).find(
          k => k !== xKey && k !== 'id' && (typeof row[k] === 'number' || (!isNaN(Number(row[k])) && row[k] !== ''))
        );
        if (candidateKey) {
          rawY = row[candidateKey];
        }
      }

      // Format X label
      let xLabel = '';
      if (rawX === null || rawX === undefined) {
        xLabel = '(Missing)';
      } else if (rawX instanceof Date) {
        xLabel = rawX.toLocaleDateString();
      } else if (typeof rawX === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawX)) {
        // Pretty format date string
        xLabel = rawX.substring(0, 10);
      } else {
        xLabel = String(rawX);
      }

      // Safe Y parsing
      let yVal: number | null = null;
      if (rawY === null || rawY === undefined) {
        yVal = config.treatNullAsZero ? 0 : null;
      } else {
        const num = typeof rawY === 'number' ? rawY : parseFloat(String(rawY));
        yVal = isNaN(num) ? (config.treatNullAsZero ? 0 : null) : num;
      }

      const point: ProcessedDataPoint = {
        id: `pt-${idx}`,
        ...row,
        xLabel,
        [yKey]: yVal,
        rawValue: yVal
      };

      if (expectedAlias && expectedAlias !== yKey) {
        point[expectedAlias] = yVal;
      }

      // Process secondary numeric measures
      for (const sKey of secondaryKeys) {
        const rawSec = row[sKey];
        if (rawSec === null || rawSec === undefined) {
          point[sKey] = config.treatNullAsZero ? 0 : null;
        } else {
          const num = typeof rawSec === 'number' ? rawSec : parseFloat(String(rawSec));
          point[sKey] = isNaN(num) ? (config.treatNullAsZero ? 0 : null) : num;
        }
      }

      if (seriesGroupKey && row[seriesGroupKey] !== undefined) {
        point[seriesGroupKey] = String(row[seriesGroupKey] ?? '(None)');
      }

      return point;
    });

    // 1b. Percent Bar 100% normalization
    if (config.chartType === 'percent_bar') {
      const allMeasures = [yKey, ...secondaryKeys];
      data = data.map(pt => {
        const total = allMeasures.reduce((sum, m) => sum + (typeof pt[m] === 'number' ? (pt[m] as number) : 0), 0);
        const normalized = { ...pt };
        if (total > 0) {
          for (const m of allMeasures) {
            const raw = typeof pt[m] === 'number' ? (pt[m] as number) : 0;
            normalized[m] = Math.round((raw / total) * 1000) / 10; // e.g. 45.2%
          }
        }
        return normalized;
      });
    }

    // 2. Filter out null points if not treating as 0 and chart requires continuous measure
    if (!config.treatNullAsZero && config.chartType !== 'table') {
      data = data.filter(d => d[yKey] !== null);
    }

    // 3. Sorting
    if (config.sortOrder !== 'none') {
      const isAsc = config.sortOrder === 'asc';
      data.sort((a, b) => {
        if (config.sortBy === 'y') {
          const valA = (a[yKey] as number) ?? 0;
          const valB = (b[yKey] as number) ?? 0;
          return isAsc ? valA - valB : valB - valA;
        } else {
          const strA = a.xLabel.toLowerCase();
          const strB = b.xLabel.toLowerCase();
          return isAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      });
    }

    // 4. Limiting
    if (config.limit !== 'all') {
      data = data.slice(0, config.limit);
    }

    return data;
  }

  /**
   * Generates mathematical bins client-side for Histograms
   */
  public static computeHistogram(
    rows: Record<string, unknown>[],
    numericCol: string,
    binCount: number = 20,
    treatNullAsZero = false
  ): HistogramBin[] {
    if (!rows || rows.length === 0 || !numericCol) return [];

    const values: number[] = [];
    for (const r of rows) {
      const v = r[numericCol];
      if (v === null || v === undefined) {
        if (treatNullAsZero) values.push(0);
      } else {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        if (!isNaN(n)) values.push(n);
      }
    }

    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Edge case: all values are identical
    if (min === max) {
      return [
        {
          binRange: `${min.toFixed(2)}`,
          binStart: min,
          binEnd: max,
          count: values.length
        }
      ];
    }

    const bins: HistogramBin[] = [];
    const step = (max - min) / binCount;

    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * step;
      const binEnd = i === binCount - 1 ? max : min + (i + 1) * step;
      const rangeLabel = `${binStart.toFixed(1)} - ${binEnd.toFixed(1)}`;
      bins.push({
        binRange: rangeLabel,
        binStart,
        binEnd,
        count: 0
      });
    }

    for (const val of values) {
      // Find bin
      let index = Math.floor((val - min) / step);
      if (index >= binCount) index = binCount - 1;
      if (index < 0) index = 0;
      bins[index].count++;
    }

    return bins;
  }

  /**
   * Computes KPI summary using chart config and detected column metadata
   */
  public static computeKpiSummary(
    rows: Record<string, unknown>[],
    config: ChartConfig,
    columns: DetectedColumn[]
  ): KpiMetricSummary {
    const metricCol = config.yAxis || columns.find(c => c.isNumeric)?.name || (rows[0] ? Object.keys(rows[0])[0] : '');
    return this.computeKpi(rows, metricCol);
  }

  /**
   * Computes single KPI and optional delta comparison with division-by-zero protection
   */
  public static computeKpi(
    rows: Record<string, unknown>[],
    metricCol: string
  ): KpiMetricSummary {
    const isAllRows = !metricCol || metricCol === '*' || metricCol === 'All Rows';
    const metricLabel = isAllRows ? 'ALL ROWS' : metricCol.replace(/_/g, ' ').toUpperCase();
    const defaultRes: KpiMetricSummary = {
      currentValue: null,
      formattedCurrent: '—',
      previousValue: null,
      formattedPrevious: '—',
      change: null,
      changePercent: null,
      hasComparison: false,
      metricLabel
    };

    if (!rows || rows.length === 0) return defaultRes;

    // Check if result has 1 row with current and previous columns
    const firstRow = rows[0];
    const expectedAlias = VisualizationQueryBuilder.generateMeasureAlias(metricCol, 'count');
    const targetMetricCol = (metricCol && firstRow[metricCol] !== undefined)
      ? metricCol
      : (expectedAlias && firstRow[expectedAlias] !== undefined)
      ? expectedAlias
      : Object.keys(firstRow).find(k => typeof firstRow[k] === 'number' || (!isNaN(Number(firstRow[k])) && firstRow[k] !== '')) || Object.keys(firstRow)[0];

    if (!targetMetricCol) return defaultRes;

    const prevColCandidate = Object.keys(firstRow).find(
      k =>
        k !== targetMetricCol &&
        (k.toLowerCase().includes('prev') ||
          k.toLowerCase().includes('prior') ||
          k.toLowerCase().includes('last') ||
          k.toLowerCase().includes('target'))
    );

    let currentVal: number | null = null;
    let prevVal: number | null = null;

    if (prevColCandidate && firstRow[prevColCandidate] !== undefined) {
      currentVal = this.parseNumeric(firstRow[targetMetricCol]);
      prevVal = this.parseNumeric(firstRow[prevColCandidate]);
    } else if (rows.length >= 2) {
      // 2 rows: row 0 is current, row 1 is previous
      currentVal = this.parseNumeric(rows[0][targetMetricCol]);
      prevVal = this.parseNumeric(rows[1][targetMetricCol]);
    } else {
      currentVal = this.parseNumeric(firstRow[targetMetricCol]);
    }

    let change: number | null = null;
    let changePercent: number | null = null;

    if (currentVal !== null && prevVal !== null) {
      change = currentVal - prevVal;
      if (prevVal === 0) {
        changePercent = currentVal === 0 ? 0 : 100;
      } else {
        changePercent = ((currentVal - prevVal) / Math.abs(prevVal)) * 100;
      }
    }

    return {
      currentValue: currentVal,
      formattedCurrent: this.formatNumber(currentVal),
      previousValue: prevVal,
      formattedPrevious: this.formatNumber(prevVal),
      change,
      changePercent,
      hasComparison: prevVal !== null,
      metricLabel: metricCol.replace(/_/g, ' ').toUpperCase()
    };
  }

  private static parseNumeric(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const num = parseFloat(String(val));
    return isNaN(num) ? null : num;
  }

  public static formatNumber(val: number | null, config?: Partial<ChartConfig>): string {
    if (val === null || val === undefined || isNaN(val)) return '—';

    const precision = config?.decimalPrecision !== undefined ? config.decimalPrecision : 2;
    const format = config?.numberFormat || 'standard';
    const currency = config?.currencySymbol || '$';

    if (format === 'percent') {
      const pctVal = Math.abs(val) <= 1 ? val * 100 : val;
      return `${pctVal.toLocaleString(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      })}%`;
    }

    if (format === 'currency') {
      if (Math.abs(val) >= 1_000_000_000) {
        return `${currency}${(val / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: precision })}B`;
      }
      if (Math.abs(val) >= 1_000_000) {
        return `${currency}${(val / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: precision })}M`;
      }
      if (Math.abs(val) >= 1_000) {
        return `${currency}${(val / 1_000).toLocaleString(undefined, { maximumFractionDigits: precision })}k`;
      }
      return `${currency}${val.toLocaleString(undefined, {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      })}`;
    }

    if (format === 'compact') {
      if (Math.abs(val) >= 1_000_000_000) {
        return `${(val / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: precision })}B`;
      }
      if (Math.abs(val) >= 1_000_000) {
        return `${(val / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: precision })}M`;
      }
      if (Math.abs(val) >= 1_000) {
        return `${(val / 1_000).toLocaleString(undefined, { maximumFractionDigits: precision })}k`;
      }
    }

    // Default standard formatting
    if (Math.abs(val) >= 1_000_000) {
      return `${(val / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: precision })}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${(val / 1_000).toLocaleString(undefined, { maximumFractionDigits: precision })}k`;
    }

    return Number.isInteger(val) && precision === 0
      ? val.toLocaleString()
      : val.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
  }
}
