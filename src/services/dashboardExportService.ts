import { Dashboard } from '../types/dashboard';
import { QueryResult } from '../types/database';

export class DashboardExportService {
  /**
   * Exports dashboard configuration as a clean JSON file (without credentials)
   */
  public static exportDashboardJson(dashboard: Dashboard): void {
    // Sanitize to guarantee no secrets are included
    const sanitizedConfig = {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      widgets: dashboard.widgets.map(w => ({
        id: w.id,
        title: w.title,
        description: w.description,
        chartType: w.chartType,
        size: w.size,
        position: w.position,
        chartConfig: w.chartConfig,
        queryRef: {
          type: w.queryRef.type,
          sql: w.queryRef.sql,
          sourceTable: w.queryRef.sourceTable,
          referencedTables: w.queryRef.referencedTables,
          referencedColumns: w.queryRef.referencedColumns
        }
      })),
      filters: dashboard.filters,
      layout: dashboard.layout,
      autoRefreshInterval: dashboard.autoRefreshInterval,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt
    };

    const blob = new Blob([JSON.stringify(sanitizedConfig, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const filename = `${dashboard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_config.json`;
    this.triggerDownload(blob, filename);
  }

  /**
   * Exports all widget underlying query results as a structured CSV package
   */
  public static exportAllWidgetsCsv(dashboard: Dashboard, widgetResults: Map<string, QueryResult>): void {
    let fullContent = `# DataPilot Dashboard Export: ${dashboard.name}\n`;
    fullContent += `# Exported: ${new Date().toISOString()}\n\n`;

    for (const widget of dashboard.widgets) {
      const res = widgetResults.get(widget.id) || widget.cachedResult;
      fullContent += `\n=========================================\n`;
      fullContent += `WIDGET: ${widget.title} (${widget.chartType})\n`;
      fullContent += `QUERY: ${widget.queryRef.sql.replace(/\n/g, ' ')}\n`;
      fullContent += `=========================================\n`;

      if (!res || !res.rows || res.rows.length === 0) {
        fullContent += `(No rows returned)\n\n`;
        continue;
      }

      const colNames = res.columns.map(c => c.name);
      fullContent += colNames.join(',') + '\n';

      for (const row of res.rows) {
        const line = colNames
          .map(c => {
            const val = row[c];
            if (val === null || val === undefined) return '';
            return JSON.stringify(val);
          })
          .join(',');
        fullContent += line + '\n';
      }
      fullContent += '\n';
    }

    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8' });
    const filename = `${dashboard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data_export.csv`;
    this.triggerDownload(blob, filename);
  }

  /**
   * Exports single widget query result as CSV
   */
  public static exportWidgetCsv(widget: { title: string; chartType: string }, result?: QueryResult): void {
    if (!result || !result.rows || result.rows.length === 0) {
      alert('No data available to export for this widget.');
      return;
    }

    const colNames = result.columns.map(c => c.name);
    let csvContent = colNames.join(',') + '\n';

    for (const row of result.rows) {
      const line = colNames
        .map(c => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          return JSON.stringify(val);
        })
        .join(',');
      csvContent += line + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const filename = `${widget.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`;
    this.triggerDownload(blob, filename);
  }

  /**
   * Exports the SVG visualization inside a widget container as a high-res PNG image
   */
  public static async exportWidgetPng(widgetContainerId: string, widgetTitle: string): Promise<void> {
    try {
      const container = document.getElementById(widgetContainerId);
      if (!container) return;

      const svgElem = container.querySelector('svg');
      if (!svgElem) {
        alert('Could not find visualization SVG to export.');
        return;
      }

      // Clone SVG and set background
      const svgClone = svgElem.cloneNode(true) as SVGSVGElement;
      const width = svgElem.clientWidth || 800;
      const height = svgElem.clientHeight || 450;
      svgClone.setAttribute('width', `${width}`);
      svgClone.setAttribute('height', `${height}`);

      // Add dark background rect
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', '#0f172a');
      svgClone.insertBefore(rect, svgClone.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = window.URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2; // 2x for retina quality
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(2, 2);
        ctx.drawImage(image, 0, 0);

        canvas.toBlob(pngBlob => {
          if (pngBlob) {
            const filename = `${widgetTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_chart.png`;
            this.triggerDownload(pngBlob, filename);
          }
        }, 'image/png');
        window.URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error('Failed to export widget PNG:', err);
    }
  }

  /**
   * Triggers native browser print dialog formatted for PDF export
   */
  public static printDashboardAsPdf(): void {
    window.print();
  }

  private static triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
