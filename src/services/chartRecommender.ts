import {
  DetectedColumn,
  ChartType,
  ChartRecommendation,
  ChartValidationResult,
  ChartConfig
} from '../types/visualization';

export class ChartRecommender {
  /**
   * Returns prioritized list of recommended charts for the dataset
   */
  public static getRecommendations(
    columns: DetectedColumn[],
    rowCount: number
  ): ChartRecommendation[] {
    const list: ChartRecommendation[] = [];
    if (columns.length === 0 || rowCount === 0) {
      return [{
        chartType: 'table',
        confidence: 'low',
        reason: 'No columns or records available for visualization.'
      }];
    }

    const numericCols = columns.filter(c => c.isNumeric);
    const dateCols = columns.filter(c => c.isDateOrTime);
    const categoricalCols = columns.filter(c => c.isCategorical && !c.isDateOrTime);

    // 1. KPI Card
    if (rowCount <= 2 && numericCols.length >= 1) {
      list.push({
        chartType: 'kpi',
        confidence: 'high',
        reason: 'Single numeric summary detected, ideal for high-impact metric presentation.',
        yAxis: numericCols[0].name,
        title: numericCols[0].name.replace(/_/g, ' ').toUpperCase()
      });
    }

    // 2. Date / Temporal Trends
    if (dateCols.length >= 1 && numericCols.length >= 1) {
      const dateCol = dateCols[0].name;
      const primaryMeasure = numericCols[0].name;
      const secondaryMeasures = numericCols.slice(1).map(c => c.name);

      list.push({
        chartType: 'line',
        confidence: 'high',
        reason: `Chronological series (${dateCol}) mapped to measure (${primaryMeasure}). Line Chart recommended.`,
        xAxis: dateCol,
        yAxis: primaryMeasure,
        secondaryMeasures,
        title: `${primaryMeasure.replace(/_/g, ' ')} over time`
      });

      list.push({
        chartType: 'area',
        confidence: 'high',
        reason: `Cumulative temporal trend across ${dateCol}. Area Chart provides volume context.`,
        xAxis: dateCol,
        yAxis: primaryMeasure,
        secondaryMeasures,
        title: `${primaryMeasure.replace(/_/g, ' ')} volume trend`
      });

      if (numericCols.length > 1) {
        list.push({
          chartType: 'stacked_area',
          confidence: 'medium',
          reason: 'Multiple metrics over time. Stacked Area shows composite volume.',
          xAxis: dateCol,
          yAxis: primaryMeasure,
          secondaryMeasures,
          title: `Combined volume over time`
        });
      }
    }

    // 3. Categorical + Numeric Measures
    if (categoricalCols.length >= 1 && numericCols.length >= 1) {
      const catCol = categoricalCols[0];
      const metricCol = numericCols[0];

      // Many categories (> 8) -> Horizontal Bar
      if (catCol.distinctCount > 8 || rowCount > 8) {
        list.push({
          chartType: 'horizontal_bar',
          confidence: 'high',
          reason: `High category cardinality (${catCol.distinctCount} items). Horizontal Bar ensures readability.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          title: `${metricCol.name.replace(/_/g, ' ')} by ${catCol.name.replace(/_/g, ' ')}`
        });
      }

      // Standard Bar
      list.push({
        chartType: 'bar',
        confidence: 'high',
        reason: `Categorical dimension (${catCol.name}) with numeric measure (${metricCol.name}). Bar Chart recommended.`,
        xAxis: catCol.name,
        yAxis: metricCol.name,
        title: `${metricCol.name.replace(/_/g, ' ')} by ${catCol.name.replace(/_/g, ' ')}`
      });

      // Part-to-whole (Pie / Donut)
      if (catCol.distinctCount <= 7 && catCol.distinctCount >= 2) {
        list.push({
          chartType: 'donut',
          confidence: 'high',
          reason: `Part-to-whole distribution with ${catCol.distinctCount} categories. Donut Chart recommended.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          title: `Share of ${metricCol.name.replace(/_/g, ' ')} by ${catCol.name.replace(/_/g, ' ')}`
        });
        list.push({
          chartType: 'pie',
          confidence: 'medium',
          reason: `Categorical share with ${catCol.distinctCount} categories.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          title: `${metricCol.name.replace(/_/g, ' ')} breakdown`
        });
      }

      // Multiple measures -> Grouped Bar & Stacked Bar & Composed
      if (numericCols.length > 1) {
        const secondary = numericCols.slice(1).map(c => c.name);
        list.push({
          chartType: 'grouped_bar',
          confidence: 'high',
          reason: `Multiple measures across ${catCol.name}. Grouped Bar compares metrics side-by-side.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          secondaryMeasures: secondary,
          title: `Comparison by ${catCol.name.replace(/_/g, ' ')}`
        });
        list.push({
          chartType: 'stacked_bar',
          confidence: 'high',
          reason: `Composition across categories. Stacked Bar shows aggregate totals.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          secondaryMeasures: secondary,
          title: `Total Composition by ${catCol.name.replace(/_/g, ' ')}`
        });
        list.push({
          chartType: 'percent_bar',
          confidence: 'medium',
          reason: `Relative share across categories. 100% Stacked Bar normalizes proportions.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          secondaryMeasures: secondary,
          title: `100% Proportions by ${catCol.name.replace(/_/g, ' ')}`
        });
        list.push({
          chartType: 'composed',
          confidence: 'medium',
          reason: 'Combines Bar and Line to showcase primary measure alongside secondary trends.',
          xAxis: catCol.name,
          yAxis: metricCol.name,
          secondaryMeasures: secondary,
          title: `Multi-metric Overview by ${catCol.name.replace(/_/g, ' ')}`
        });
      }

      // Treemap for category sizes
      if (catCol.distinctCount >= 3) {
        list.push({
          chartType: 'treemap',
          confidence: 'medium',
          reason: `Hierarchical / nested category breakdown. Treemap visualizes relative sizes.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          title: `${catCol.name.replace(/_/g, ' ')} Breakdown`
        });
      }

      // Funnel if sequential or status-like
      const isFunnelCandidate =
        catCol.name.toLowerCase().includes('stage') ||
        catCol.name.toLowerCase().includes('status') ||
        catCol.name.toLowerCase().includes('step') ||
        catCol.name.toLowerCase().includes('funnel');
      if (isFunnelCandidate) {
        list.push({
          chartType: 'funnel',
          confidence: 'high',
          reason: `Sequential process dimension (${catCol.name}). Funnel Chart illustrates conversion drops.`,
          xAxis: catCol.name,
          yAxis: metricCol.name,
          title: `Conversion Funnel: ${catCol.name.replace(/_/g, ' ')}`
        });
      }
    }

    // 4. Two Numeric Columns -> Scatter Plot
    if (numericCols.length >= 2) {
      list.push({
        chartType: 'scatter',
        confidence: 'high',
        reason: `Correlation between ${numericCols[0].name} and ${numericCols[1].name}. Scatter Plot recommended.`,
        xAxis: numericCols[0].name,
        yAxis: numericCols[1].name,
        title: `${numericCols[1].name.replace(/_/g, ' ')} vs ${numericCols[0].name.replace(/_/g, ' ')}`
      });
    }

    // 5. Distribution of Single Numeric Column -> Histogram
    if (numericCols.length >= 1 && rowCount > 5) {
      list.push({
        chartType: 'histogram',
        confidence: 'medium',
        reason: `Continuous distribution analysis on ${numericCols[0].name}. Histogram recommended.`,
        xAxis: numericCols[0].name,
        yAxis: numericCols[0].name,
        title: `Distribution of ${numericCols[0].name.replace(/_/g, ' ')}`
      });
    }

    // 6. Table fallback
    list.push({
      chartType: 'table',
      confidence: 'medium',
      reason: 'Standard tabular layout provides clearest representation for this dataset.',
      title: 'Query Data View'
    });

    return list;
  }

  /**
   * Intelligently selects the best default visualization based on result metadata
   */
  public static recommend(
    columns: DetectedColumn[],
    rowCount: number
  ): ChartRecommendation {
    const list = this.getRecommendations(columns, rowCount);
    return list[0];
  }

  /**
   * Validates whether the chosen chart configuration is mathematically and structurally valid
   */
  public static validateConfig(
    config: ChartConfig,
    columns: DetectedColumn[]
  ): ChartValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.chartType === 'table') {
      return { isValid: true, errors, warnings };
    }

    const colMap = new Map(columns.map(c => [c.name, c]));
    const xCol = config.xAxis ? colMap.get(config.xAxis) : undefined;
    const yCol = config.yAxis ? colMap.get(config.yAxis) : undefined;

    const isCount = config.aggregation === 'count' || config.aggregation === 'count_distinct';
    const isAllRows = config.yAxis === 'All Rows' || config.yAxis === '*';
    const isSum = config.aggregation === 'sum';
    const isAvg = config.aggregation === 'avg' || config.aggregation === 'median';
    const isMin = config.aggregation === 'min';
    const isMax = config.aggregation === 'max';

    // KPI Card validation
    if (config.chartType === 'kpi') {
      if (isCount) {
        if (!config.yAxis) {
          errors.push('KPI Card requires a metric column or "All Rows" to count.');
        } else if (!isAllRows && !yCol) {
          errors.push(`Metric column '${config.yAxis}' not found in dataset.`);
        }
      } else if (isSum || isAvg) {
        if (isAllRows) {
          errors.push(`${config.aggregation.toUpperCase()} aggregation requires a numeric column, not "All Rows".`);
        } else if (!config.yAxis) {
          errors.push(`KPI Card requires a numeric measure for ${config.aggregation.toUpperCase()} aggregation.`);
        } else if (!yCol) {
          errors.push(`Measure column '${config.yAxis}' not found in dataset.`);
        } else if (!yCol.isNumeric) {
          errors.push(`KPI metric '${config.yAxis}' must be numeric for ${config.aggregation.toUpperCase()} aggregation (detected as ${yCol.semanticType}).`);
        }
      } else if (isMin || isMax) {
        if (isAllRows) {
          errors.push(`${config.aggregation.toUpperCase()} aggregation requires a column, not "All Rows".`);
        } else if (!config.yAxis) {
          errors.push(`KPI Card requires a column for ${config.aggregation.toUpperCase()} aggregation.`);
        } else if (!yCol) {
          errors.push(`Measure column '${config.yAxis}' not found in dataset.`);
        } else if (!yCol.isNumeric && !yCol.isDateOrTime) {
          errors.push(`KPI metric '${config.yAxis}' must be numeric or date for ${config.aggregation.toUpperCase()} aggregation (detected as ${yCol.semanticType}).`);
        }
      } else {
        if (!config.yAxis) {
          errors.push('KPI Card requires a metric column.');
        } else if (yCol && !yCol.isNumeric) {
          errors.push(`KPI metric '${config.yAxis}' must be numeric (detected as ${yCol.semanticType}).`);
        }
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Histogram validation
    if (config.chartType === 'histogram') {
      const histCol = xCol || yCol;
      if (!histCol) {
        errors.push('Histogram requires a numeric column for binning.');
      } else if (!histCol.isNumeric) {
        errors.push(`Histogram column '${histCol.name}' must be numeric (detected as ${histCol.semanticType}).`);
      }
      return { isValid: errors.length === 0, errors, warnings };
    }

    // Scatter Plot validation
    if (config.chartType === 'scatter') {
      if (!xCol) {
        errors.push('Scatter plot requires an X-axis column.');
      } else if (!xCol.isNumeric) {
        errors.push(`Scatter plot X-axis '${config.xAxis}' must be numeric.`);
      }

      if (!yCol) {
        errors.push('Scatter plot requires a Y-axis column.');
      } else if (!yCol.isNumeric) {
        errors.push(`Scatter plot Y-axis '${config.yAxis}' must be numeric.`);
      }

      return { isValid: errors.length === 0, errors, warnings };
    }

    // Standard Charts & Analytical Charts (Bar, Grouped, Stacked, Line, Area, Pie, Donut, Funnel, Treemap, Radar, Radial)
    if (!xCol) {
      errors.push('Please select a dimension or category for the X-axis.');
    }

    if (isCount) {
      // COUNT aggregation: allows any column type (text, date, numeric, boolean) or "All Rows"
      if (!config.yAxis) {
        errors.push('Please select a column or "All Rows" for the Y-axis to count.');
      } else if (!isAllRows && !yCol) {
        errors.push(`Measure column '${config.yAxis}' not found in dataset.`);
      }
    } else if (isSum || isAvg) {
      // SUM and AVG strictly require numeric columns
      if (isAllRows) {
        errors.push(`${config.aggregation.toUpperCase()} aggregation cannot be performed on "All Rows". Please select a numeric column.`);
      } else if (!config.yAxis) {
        errors.push(`Please select a numeric measure for the Y-axis with ${config.aggregation.toUpperCase()} aggregation.`);
      } else if (!yCol) {
        errors.push(`Measure column '${config.yAxis}' not found in dataset.`);
      } else if (!yCol.isNumeric) {
        errors.push(`Measure column '${config.yAxis}' must be numeric for ${config.aggregation.toUpperCase()} aggregation (detected as ${yCol.semanticType}).`);
      }
    } else if (isMin || isMax) {
      // MIN and MAX require numeric or date columns
      if (isAllRows) {
        errors.push(`${config.aggregation.toUpperCase()} aggregation cannot be performed on "All Rows". Please select a column.`);
      } else if (!config.yAxis) {
        errors.push(`Please select a column for the Y-axis with ${config.aggregation.toUpperCase()} aggregation.`);
      } else if (!yCol) {
        errors.push(`Measure column '${config.yAxis}' not found in dataset.`);
      } else if (!yCol.isNumeric && !yCol.isDateOrTime) {
        errors.push(`Measure column '${config.yAxis}' must be numeric or date for ${config.aggregation.toUpperCase()} aggregation (detected as ${yCol.semanticType}).`);
      }
    } else {
      if (!config.yAxis) {
        errors.push('Please select a numeric measure for the Y-axis.');
      } else if (yCol && !yCol.isNumeric) {
        errors.push(`Measure column '${config.yAxis}' must be numeric (detected as ${yCol.semanticType}).`);
      }
    }

    // Pie / Donut specific checks
    if (config.chartType === 'pie' || config.chartType === 'donut') {
      if (xCol && xCol.distinctCount > 8) {
        warnings.push(
          `Pie charts work best with a small number of categories (selected '${xCol.name}' has ${xCol.distinctCount} distinct values). Consider a Bar Chart for clearer readability.`
        );
      }
    }

    // Treemap checks
    if (config.chartType === 'treemap') {
      if (yCol && !yCol.isNumeric) {
        errors.push(`Treemap requires a numeric measure for rectangle sizing.`);
      }
    }

    // Check secondary measures if multi-series
    if (config.secondaryMeasures && config.secondaryMeasures.length > 0) {
      for (const mName of config.secondaryMeasures) {
        const mCol = colMap.get(mName);
        if (!mCol) {
          errors.push(`Secondary measure '${mName}' not found in query results.`);
        } else if (!mCol.isNumeric) {
          errors.push(`Secondary measure '${mName}' must be numeric.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
