/**
 * PDF: decision log + ingestion pipeline statistics. Client-side only.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import type { DecisionEntry } from '@/lib/store/decisionsStore';
import type { IngestionEvent } from '@/lib/store/ingestionLogStore';
import type { MetricKey } from '@/lib/symbolic/benchmarks';
import { METRIC_LABELS } from '@/lib/symbolic/benchmarks';

const FONT = 'helvetica';
const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;

function addFooter(doc: jsPDF, pageNum: number) {
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Koravo — Command centre report — ${new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    MARGIN,
    PAGE_H - 10
  );
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN - 15, PAGE_H - 10);
  doc.setTextColor(0, 0, 0);
}

export interface DecisionPipelineReportInput {
  restaurantName?: string;
  decisions: DecisionEntry[];
  ingestions: IngestionEvent[];
  metrics: Record<string, number>;
  avgDailyRevenue: number;
  wowPct: number;
}

export function generateDecisionPipelineReportPdf(input: DecisionPipelineReportInput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = MARGIN;

  doc.setFontSize(20);
  doc.setFont(FONT, 'bold');
  doc.text('Command centre — decisions & data pipeline', MARGIN, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont(FONT, 'normal');
  doc.text(input.restaurantName ?? 'Restaurant', MARGIN, y);
  y += 12;

  // —— Statistics ——
  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  doc.text('Summary statistics', MARGIN, y);
  y += 8;

  const open = input.decisions.filter((d) => d.status === 'open' || d.status === 'in_progress').length;
  const done = input.decisions.filter((d) => d.status === 'done').length;
  const ingRuns = input.ingestions.length;
  const lastIng = input.ingestions[0];
  const warnTotal = input.ingestions.reduce((s, e) => s + e.warnings.length, 0);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  const statLines = [
    `• Decisions logged: ${input.decisions.length} (open/in progress: ${open}, completed: ${done})`,
    `• CSV ingest runs (stored): ${ingRuns}; pipeline warnings across runs: ${warnTotal}`,
    lastIng
      ? `• Last ingest: ${lastIng.schema}, ${lastIng.dailyDays} day(s), ${lastIng.skippedRowCount} row(s) skipped`
      : '• Last ingest: —',
    `• Avg daily revenue: ${formatCurrency(input.avgDailyRevenue)}; WoW revenue: ${input.wowPct >= 0 ? '+' : ''}${input.wowPct.toFixed(1)}%`,
  ];
  statLines.forEach((line) => {
    doc.text(line, MARGIN + 2, y);
    y += 6;
  });
  y += 10;

  // —— KPI snapshot ——
  doc.setFont(FONT, 'bold');
  doc.setFontSize(12);
  doc.text('KPI snapshot (at export)', MARGIN, y);
  y += 8;

  const keys: MetricKey[] = ['food_cost', 'labor_cost', 'prime_cost', 'avg_check', 'bev_margin', 'table_turns'];
  const kpiRows = keys.map((key) => {
    const v = input.metrics[key];
    const label = METRIC_LABELS[key];
    let val = '—';
    if (v != null && Number.isFinite(v)) {
      if (key === 'avg_check') val = formatCurrency(v);
      else val = formatPercent(v);
    }
    return [label, val];
  });

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: kpiRows,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: MARGIN },
    tableWidth: PAGE_W - 2 * MARGIN,
  });
  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 14;

  // —— Ingestion log ——
  if (input.ingestions.length > 0) {
    if (y > PAGE_H - 60) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(12);
    doc.setFont(FONT, 'bold');
    doc.text('Ingestion log (recent)', MARGIN, y);
    y += 8;

    const ingBody = input.ingestions.slice(0, 15).map((e) => [
      new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      e.fileName ?? '—',
      e.schema,
      String(e.rowCount),
      String(e.skippedRowCount),
      String(e.warnings.length),
      e.dateRange ? `${e.dateRange.start} → ${e.dateRange.end}` : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['When', 'File', 'Schema', 'Rows', 'Skipped', 'Warn', 'Date range']],
      body: ingBody,
      theme: 'grid',
      headStyles: { fillColor: [45, 55, 72], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      margin: { left: MARGIN },
      tableWidth: PAGE_W - 2 * MARGIN,
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 14;
  }

  // —— Decisions ——
  if (input.decisions.length > 0) {
    if (y > PAGE_H - 50) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(12);
    doc.setFont(FONT, 'bold');
    doc.text('Decision log', MARGIN, y);
    y += 8;

    const decBody = input.decisions.slice(0, 25).map((d) => [
      new Date(d.createdAt).toLocaleDateString('en-IN'),
      d.title.slice(0, 48) + (d.title.length > 48 ? '…' : ''),
      d.priority,
      d.status,
      d.source.replace(/_/g, ' '),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Title', 'Priority', 'Status', 'Source']],
      body: decBody,
      theme: 'grid',
      headStyles: { fillColor: [45, 55, 72], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: MARGIN },
      tableWidth: PAGE_W - 2 * MARGIN,
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 10;

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    for (const d of input.decisions.slice(0, 8)) {
      if (y > PAGE_H - 35) {
        doc.addPage();
        y = MARGIN;
      }
      doc.setFont(FONT, 'bold');
      doc.text(d.title, MARGIN, y);
      y += 5;
      doc.setFont(FONT, 'normal');
      const rationale = doc.splitTextToSize(d.rationale || '—', PAGE_W - 2 * MARGIN - 4);
      rationale.forEach((line: string) => {
        doc.text(line, MARGIN + 2, y);
        y += 4.5;
      });
      y += 4;
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }

  doc.save(`Koravo-Command-Centre-${new Date().toISOString().slice(0, 10)}.pdf`);
}
