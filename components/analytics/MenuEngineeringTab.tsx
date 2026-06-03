'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Tooltip,
  CartesianGrid,
  LabelList,
} from 'recharts';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Download, Flag, MessageCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { useMetricsStore } from '@/lib/store/metricsStore';
import type { MenuItemForEngineering, QuadrantKey } from '@/lib/store/metricsStore';
import { classifyItem, QUADRANT_STRATEGY, QUAD_COLOR } from '@/lib/utils/menuEngineering';
import type { MenuItem } from '@/lib/utils/menuEngineering';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { safeDivide } from '@/lib/utils/math';
import { callSAGE, SAGEError } from '@/lib/api/sage';
import { useMetricsStore as useMetricsStoreForMetrics } from '@/lib/store/metricsStore';
import { Sparkline } from '@/components/ui/Sparkline';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils/cn';
import { truncate } from '@/lib/utils/truncate';

const CATEGORY_OPTIONS = ['All', 'Mains', 'Starters', 'Desserts', 'Beverages', 'Specials'] as const;
const PERIOD_OPTIONS = ['This Week', 'This Month', 'Last 90 Days'] as const;
const SORT_OPTIONS = ['Revenue ↓', 'Margin ↓', 'Covers ↓', 'Trend ↓'] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number];
type SortKey = (typeof SORT_OPTIONS)[number];

// ----- Section: Item detail slide-over panel -----
function ItemDetailPanel({
  item,
  onClose,
}: {
  item: MenuItemForEngineering | null;
  onClose: () => void;
}) {
  const setFlagForReview = useMetricsStore((s) => s.setFlagForReview);
  const flaggedItemIds = useMetricsStore((s) => s.flaggedItemIds);
  const [sageSuggestion, setSageSuggestion] = useState<string>('');
  const metrics = useMetricsStoreForMetrics((s) => s.metrics);
  const handleFetchSage = useCallback(() => {
    if (!item) return;
    setSageSuggestion('Loading…');
    let accumulated = '';
    callSAGE(
      {
        messages: [
          {
            role: 'user',
            content: `Suggest one action for menu item: ${item.name}. Category: ${item.category}. Covers: ${item.covers}, Margin: ${item.marginPct}%, Revenue: ${formatCurrency(item.revenue)}. Quadrant: ${item.quadrant}.`,
          },
        ],
        metrics: { ...metrics },
        sessionId: `menu-${item.id}`,
      },
      {
        onToken: (token) => {
          accumulated += token;
          setSageSuggestion(accumulated);
        },
        onDone: () => setSageSuggestion((s) => s || accumulated || 'Done.'),
        onError: (err: SAGEError) => setSageSuggestion(err.message || 'Error loading suggestion.'),
      }
    ).catch(() => setSageSuggestion('Error loading suggestion.'));
  }, [item, metrics]);

  if (!item) return null;

  const isFlagged = flaggedItemIds.includes(item.id);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed right-0 top-0 z-50 h-full w-[320px] border-l border-[var(--border-default)] bg-[var(--bg-surface)] shadow-xl"
        role="dialog"
        aria-label="Item detail"
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.name}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              ×
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <p className="text-[var(--text-muted)]">Category: {item.category}</p>
            <p>Covers: {item.covers} · Revenue: {formatCurrency(item.revenue)}</p>
            <p>Margin: {formatPercent(item.marginPct)} · Food cost: {formatPercent(item.foodCostPct)}</p>
            <p>Quadrant: <span style={{ color: QUAD_COLOR[item.quadrant] }}>{item.quadrant}</span></p>
          </div>
          <div className="mt-4">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">7-day sales</p>
            <Sparkline data={item.sparkline7} height={40} color="var(--green)" />
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleFetchSage}
              className="rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              Get SAGE suggestion
            </button>
            {sageSuggestion && (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{sageSuggestion}</p>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFlagForReview(item.id, !isFlagged)}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs',
                isFlagged ? 'bg-[var(--red)]/20 text-[var(--red)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              )}
            >
              <Flag className="h-3 w-3" />
              {isFlagged ? 'Flagged' : 'Flag for review'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const BAR_CHART_LEFT_AXIS_WIDTH = 200;
const BAR_CHART_RIGHT_MARGIN = 120;
const BAR_END_LABEL_GAP = 22;

// Custom end-of-bar label: bar end + gap so labels never overlap bars
function BarEndLabel(props: {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  value?: string | number;
  payload?: MenuItemForEngineering & { marginPctScaled?: number };
  dataKey?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value, payload, dataKey } = props;
  const numX = Number(x);
  const numY = Number(y);
  const numW = Number(width);
  const numH = Number(height);
  const textX = numX + numW + BAR_END_LABEL_GAP;
  const textY = numY + numH / 2;
  const display =
    dataKey === 'marginPctScaled' && payload != null
      ? formatPercent(payload.marginPct)
      : value != null
        ? String(value)
        : '—';
  return (
    <text x={textX} y={textY} dy={4} textAnchor="start" fill="var(--text-muted)" fontSize={11}>
      {display}
    </text>
  );
}

// ----- Section 2: Menu ranking — horizontal bar chart with correct % labels -----
function MenuRankingChart({
  items,
  sortBy,
  onItemClick,
}: {
  items: MenuItemForEngineering[];
  sortBy: SortKey;
  onItemClick: (item: MenuItemForEngineering) => void;
}) {
  const sorted = useMemo(() => {
    const arr = [...items];
    if (sortBy === 'Revenue ↓') arr.sort((a, b) => b.revenue - a.revenue);
    else if (sortBy === 'Margin ↓') arr.sort((a, b) => b.marginPct - a.marginPct);
    else if (sortBy === 'Covers ↓') arr.sort((a, b) => b.covers - a.covers);
    else arr.sort((a, b) => b.trendWoW - a.trendWoW);
    return arr;
  }, [items, sortBy]);

  const maxCovers = useMemo(() => Math.max(1, ...items.map((i) => i.covers)), [items]);
  const chartData = useMemo(
    () =>
      sorted.map((i) => ({
        ...i,
        marginPctScaled: safeDivide(i.marginPct, 100, 0) * maxCovers,
      })),
    [sorted, maxCovers]
  );

  const height = Math.max(220, chartData.length * 44 + 32);

  if (!chartData.length) {
    return <EmptyState message="No items" height={200} className="min-h-[12rem]" />;
  }

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 pr-6">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Ranked by {sortBy}
      </h3>
      <ResponsiveContainer width="100%" height={height} className="min-w-0">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 16, right: BAR_CHART_RIGHT_MARGIN, left: BAR_CHART_LEFT_AXIS_WIDTH, bottom: 16 }}
          barCategoryGap={10}
          barGap={10}
          onClick={(state) => {
            const active = state?.activePayload?.[0]?.payload as MenuItemForEngineering | undefined;
            if (active) onItemClick(active);
          }}
        >
          <XAxis type="number" hide domain={[0, maxCovers * 1.45]} />
          <YAxis
            type="category"
            dataKey="name"
            width={BAR_CHART_LEFT_AXIS_WIDTH}
            tickLine={false}
            axisLine={false}
            tick={({ payload, x, y }) => {
              const row = chartData.find((d) => d.name === payload.value);
              const t = row?.trendWoW ?? 0;
              return (
                <g transform={`translate(${x},${y})`}>
                  <text x={-8} y={4} textAnchor="end" fill="var(--text-muted)" fontSize={10}>
                    {t > 0 ? '▲' : t < 0 ? '▼' : '—'}
                  </text>
                  <text
                    x={0}
                    y={4}
                    fill="var(--text-secondary)"
                    fontSize={12}
                    className="truncate"
                    style={{ maxWidth: BAR_CHART_LEFT_AXIS_WIDTH - 16 }}
                  >
                    {truncate(payload.value ?? '', 22)}
                  </text>
                </g>
              );
            }}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-elevated)' }}
            content={({ payload }) =>
              payload?.[0] ? (
                <div className="rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-2 text-xs shadow-lg">
                  <div className="font-medium text-[var(--text-primary)]">
                    {(payload[0].payload as MenuItemForEngineering).name}
                  </div>
                  <div className="mt-1 text-[var(--text-secondary)]">
                    Covers: {(payload[0].payload as MenuItemForEngineering).covers} · Margin:{' '}
                    {formatPercent((payload[0].payload as MenuItemForEngineering).marginPct)} · Revenue:{' '}
                    {formatCurrency((payload[0].payload as MenuItemForEngineering).revenue)}
                  </div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="covers" fill="var(--blue)" fillOpacity={0.7} barSize={12} radius={[0, 3, 3, 0]} name="Covers">
            <LabelList
              content={(p) => (
                <BarEndLabel
                  {...(p as Parameters<typeof BarEndLabel>[0])}
                  dataKey="covers"
                  value={(p as { payload?: { covers?: number } }).payload?.covers != null ? String((p as { payload: { covers: number } }).payload.covers) : undefined}
                />
              )}
              position="right"
            />
            {chartData.map((entry) => (
              <Cell
                key={entry.id}
                fill={entry.quadrant === 'dogs' ? 'var(--red)' : 'var(--blue)'}
                fillOpacity={entry.quadrant === 'dogs' ? 0.5 : 0.7}
              />
            ))}
          </Bar>
          <Bar
            dataKey="marginPctScaled"
            fill="var(--green)"
            barSize={12}
            radius={[0, 3, 3, 0]}
            name="Margin %"
          >
            <LabelList
              content={(p) => <BarEndLabel {...(p as Parameters<typeof BarEndLabel>[0])} dataKey="marginPctScaled" />}
              position="right"
            />
            {chartData.map((entry) => (
              <Cell
                key={entry.id}
                fill={entry.quadrant === 'dogs' ? 'var(--red)' : 'var(--green)'}
                fillOpacity={entry.quadrant === 'dogs' ? 0.5 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ----- Section 3: Menu matrix 2x2 — collapsible cards, no overlap -----
function MenuMatrixGrid({
  itemsByQuadrant,
  onItemClick,
}: {
  itemsByQuadrant: Record<QuadrantKey, MenuItemForEngineering[]>;
  onItemClick: (item: MenuItemForEngineering) => void;
}) {
  const quadrants: QuadrantKey[] = ['stars', 'plowhorses', 'puzzles', 'dogs'];
  const [open, setOpen] = useState<Record<QuadrantKey, boolean>>(() =>
    quadrants.reduce((acc, q) => ({ ...acc, [q]: true }), {} as Record<QuadrantKey, boolean>)
  );
  const toggle = (q: QuadrantKey) => setOpen((prev) => ({ ...prev, [q]: !prev[q] }));

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {quadrants.map((q) => {
        const list = itemsByQuadrant[q] ?? [];
        const color = QUAD_COLOR[q];
        const isOpen = open[q];
        return (
          <div
            key={q}
            className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <button
              type="button"
              onClick={() => toggle(q)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="text-[11px] font-medium uppercase tracking-[0.1em] shrink-0"
                  style={{ color }}
                >
                  {q}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {list.length}
                </span>
                <span className="truncate text-[10px] text-[var(--text-muted)]">
                  {QUADRANT_STRATEGY[q]}
                </span>
              </div>
              <span className="shrink-0 text-[var(--text-muted)]">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                <ul className="space-y-1 overflow-y-auto max-h-48">
                  {list.length === 0 ? (
                    <li className="text-[11px] text-[var(--text-muted)]">No items</li>
                  ) : (
                    list.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onItemClick(item)}
                          className="w-full text-left text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          {item.name} · {formatPercent(item.marginPct)} · {item.covers}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----- Insights: tabs with recommendations (lightbulb) + stats -----
const INSIGHT_TAB_IDS = ['recommendations', 'quadrants'] as const;
type InsightTabId = (typeof INSIGHT_TAB_IDS)[number];

function MenuEngineeringInsights({
  itemsByQuadrant,
  onItemClick,
}: {
  itemsByQuadrant: Record<QuadrantKey, MenuItemForEngineering[]>;
  onItemClick: (item: MenuItemForEngineering) => void;
}) {
  const [tab, setTab] = useState<InsightTabId>('recommendations');
  const quadrants: QuadrantKey[] = ['stars', 'plowhorses', 'puzzles', 'dogs'];

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex border-b border-[var(--border-default)]">
        {INSIGHT_TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium capitalize transition-colors',
              tab === id
                ? 'border-b-2 border-[var(--green)] text-[var(--green)] bg-[var(--bg-elevated)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            {id === 'recommendations' && <Lightbulb className="h-4 w-4" />}
            {id}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === 'recommendations' && (
          <ul className="space-y-3">
            {quadrants.map((q) => {
              const list = itemsByQuadrant[q] ?? [];
              const color = QUAD_COLOR[q];
              const revenue = list.reduce((s, i) => s + i.revenue, 0);
              const avgMargin = list.length ? list.reduce((s, i) => s + i.marginPct, 0) / list.length : 0;
              return (
                <li
                  key={q}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3"
                >
                  <Lightbulb className="h-4 w-4 shrink-0" style={{ color }} />
                  <span className="text-xs font-medium uppercase" style={{ color }}>{q}</span>
                  <span className="text-sm text-[var(--text-secondary)]">{QUADRANT_STRATEGY[q]}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    · {list.length} items · avg margin {formatPercent(avgMargin)} · revenue {formatCurrency(revenue, true)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'quadrants' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {quadrants.map((q) => {
              const list = itemsByQuadrant[q] ?? [];
              const color = QUAD_COLOR[q];
              return (
                <div
                  key={q}
                  className="rounded-lg border border-[var(--border-subtle)] p-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: color }}
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 shrink-0" style={{ color }} />
                    <span className="text-xs font-medium uppercase" style={{ color }}>{q}</span>
                    <span className="text-xs text-[var(--text-muted)]">{list.length} items</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{QUADRANT_STRATEGY[q]}</p>
                  <ul className="mt-2 space-y-1">
                    {list.slice(0, 5).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onItemClick(item)}
                          className="text-left text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          {item.name} · {formatPercent(item.marginPct)} · {item.covers}
                        </button>
                      </li>
                    ))}
                    {list.length > 5 && (
                      <li className="text-[10px] text-[var(--text-muted)]">+{list.length - 5} more</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ----- Section 4: Category P&L chart -----
function CategoryPLChart({ data }: { data: { category: string; revenue: number; cost: number; marginPct: number }[] }) {
  const safeData = data ?? [];
  if (!safeData.length) return <EmptyState message="No category data" height={200} />;
  const highestMargin = safeData.reduce((best, d) => (d.marginPct > (best?.marginPct ?? 0) ? d : best), safeData[0]!);
  const highestRevenue = safeData.reduce((best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best), safeData[0]!);
  type WithRatio = { category: string; revenue: number; cost: number; marginPct: number; ratio: number };
  const worstCostRatio = safeData.reduce<WithRatio | null>(
    (worst, d) => {
      const ratio = safeDivide(d.cost, d.revenue, 0);
      if (!worst || ratio > worst.ratio) return { ...d, ratio };
      return worst;
    },
    safeData.length ? { ...safeData[0]!, ratio: safeDivide(safeData[0]!.cost, safeData[0]!.revenue, 0) } : null
  );

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={safeData} margin={{ top: 8, right: 40, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, true)} />
          <YAxis yAxisId="right" orientation="right" domain={[50, 90]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v: number) => (v > 10 ? formatCurrency(v) : `${v}%`)} />
          <Bar yAxisId="left" dataKey="revenue" fill="var(--blue)" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="cost" fill="var(--red)" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" dataKey="marginPct" type="monotone" stroke="var(--green)" strokeWidth={2.5} dot={{ fill: 'var(--green)', r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="green">Highest margin: {highestMargin?.category ?? '—'}</Badge>
        <Badge variant="green">Highest revenue: {highestRevenue?.category ?? '—'}</Badge>
        <Badge variant="red">Worst cost ratio: {worstCostRatio ? worstCostRatio.category : '—'}</Badge>
      </div>
    </div>
  );
}

// ----- Section 5: Item table -----
function ItemDetailTable({
  items,
  onItemClick,
  onAskSage,
}: {
  items: MenuItemForEngineering[];
  onItemClick: (item: MenuItemForEngineering) => void;
  onAskSage: (item: MenuItemForEngineering) => void;
}) {
  const setFlagForReview = useMetricsStore((s) => s.setFlagForReview);
  const flaggedItemIds = useMetricsStore((s) => s.flaggedItemIds);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns: ColumnDef<MenuItemForEngineering>[] = useMemo(
    () => [
      {
        id: 'trend',
        header: 'Trend',
        cell: ({ row }) => {
          const t = row.original.trendWoW;
          return (
            <span style={{ color: t > 0 ? 'var(--green)' : t < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
              {t > 0 ? '▲' : t < 0 ? '▼' : '—'}
            </span>
          );
        },
      },
      { accessorKey: 'name', header: 'Item Name', cell: (c) => truncate(String(c.getValue() ?? ''), 25) },
      { accessorKey: 'category', header: 'Category' },
      { accessorKey: 'covers', header: 'Covers', cell: (c) => c.getValue(), enableSorting: true },
      { accessorKey: 'revenue', header: 'Revenue', cell: (c) => formatCurrency(Number(c.getValue())), enableSorting: true },
      { accessorKey: 'marginPct', header: 'Margin%', cell: (c) => formatPercent(Number(c.getValue())), enableSorting: true },
      { accessorKey: 'foodCostPct', header: 'Food Cost%', cell: (c) => formatPercent(Number(c.getValue())), enableSorting: true },
      {
        id: 'quadrant',
        header: 'Quadrant',
        cell: ({ row }) => (
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{ backgroundColor: `${QUAD_COLOR[row.original.quadrant]}20`, color: QUAD_COLOR[row.original.quadrant] }}
          >
            {row.original.quadrant}
          </span>
        ),
      },
      {
        id: 'sparkline',
        header: '7d',
        cell: ({ row }) => <Sparkline data={row.original.sparkline7} height={20} color="var(--green)" />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const item = row.original;
          const flagged = flaggedItemIds.includes(item.id);
          return (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFlagForReview(item.id, !flagged); }}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                title="Flag"
              >
                <Flag className={cn('h-4 w-4', flagged && 'text-[var(--red)]')} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAskSage(item); }}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                title="Ask SAGE"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [flaggedItemIds, setFlagForReview, onAskSage]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] p-2">
        <input
          type="text"
          placeholder="Search items…"
          value={globalFilter}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="w-full max-w-xs rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--bg-elevated)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="border-b border-[var(--border-default)] px-3 py-2 font-medium text-[var(--text-muted)]"
                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                onClick={() => onItemClick(row.original)}
                className={cn(
                  'cursor-pointer transition-colors duration-150',
                  i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--bg-base)]',
                  'hover:bg-[var(--bg-elevated)]'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="border-b border-[var(--border-subtle)] px-3 py-2 text-[var(--text-secondary)]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-3 py-2">
        <span className="text-xs text-[var(--text-muted)]">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const rows = table.getFilteredRowModel().rows.map((r) => r.original);
              const headers = ['Name', 'Category', 'Covers', 'Revenue', 'Margin%', 'Food Cost%', 'Quadrant'];
              const csv = [headers.join(','), ...rows.map((i) => [i.name, i.category, i.covers, i.revenue, i.marginPct, i.foodCostPct, i.quadrant].join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `koravo-menu-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1 rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border border-[var(--border-default)] px-2 py-1 text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-[var(--border-default)] px-2 py-1 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Main tab -----
export default function MenuEngineeringTab() {
  const menuItemsForEngineering = useMetricsStore((s) => s.menuItemsForEngineering);
  const categoryPL = useMetricsStore((s) => s.categoryPL);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Desserts']);
  const [period, setPeriod] = useState<PeriodKey>('This Month');
  const [sortBy, setSortBy] = useState<SortKey>('Revenue ↓');
  const [detailItem, setDetailItem] = useState<MenuItemForEngineering | null>(null);

  const isCategorySelected = useCallback(
    (c: string) => (c === 'All' ? selectedCategories.includes('All') : selectedCategories.includes(c)),
    [selectedCategories]
  );

  const toggleCategory = useCallback((c: string) => {
    setSelectedCategories((prev) => {
      if (c === 'All') return ['All'];
      const next = prev.filter((x) => x !== 'All');
      if (next.includes(c)) {
        const n = next.filter((x) => x !== c);
        return n.length ? n : ['All'];
      }
      return [...next, c];
    });
  }, []);

  const filteredItems = useMemo(() => {
    if (selectedCategories.includes('All')) return menuItemsForEngineering;
    return menuItemsForEngineering.filter((i) => selectedCategories.includes(i.category));
  }, [menuItemsForEngineering, selectedCategories]);

  const itemsWithQuadrant = useMemo(() => {
    const asItems: MenuItem[] = filteredItems.map((i) => ({ id: i.id, name: i.name, covers: i.covers, marginPct: i.marginPct, revenue: i.revenue }));
    return filteredItems.map((item) => ({
      ...item,
      quadrant: classifyItem(item, asItems),
    }));
  }, [filteredItems]);

  const itemsByQuadrant = useMemo(() => {
    const map: Record<QuadrantKey, MenuItemForEngineering[]> = { stars: [], plowhorses: [], puzzles: [], dogs: [] };
    itemsWithQuadrant.forEach((item) => {
      map[item.quadrant].push(item);
    });
    return map;
  }, [itemsWithQuadrant]);

  const filteredCategoryPL = useMemo(() => {
    if (selectedCategories.includes('All')) return categoryPL;
    return categoryPL.filter((r) => selectedCategories.includes(r.category));
  }, [categoryPL, selectedCategories]);

  const exportCSV = useCallback(() => {
    const headers = ['Name', 'Category', 'Covers', 'Revenue', 'Margin%', 'Food Cost%', 'Quadrant'];
    const rows = itemsWithQuadrant.map((i) => [i.name, i.category, i.covers, i.revenue, i.marginPct, i.foodCostPct, i.quadrant].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `koravo-menu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [itemsWithQuadrant]);

  const handleAskSage = useCallback((item: MenuItemForEngineering) => {
    window.open(`/chat?context=${encodeURIComponent(JSON.stringify({ item: item.name, metrics: { covers: item.covers, marginPct: item.marginPct } }))}`, '_blank');
  }, []);

  return (
    <div className="space-y-6">
      {/* Section 1: Controls bar (sticky within tab) */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Category</span>
          <div className="flex flex-wrap gap-1">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium',
                  isCategorySelected(c)
                    ? 'bg-[var(--green)]/20 text-[var(--green)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Period</span>
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded px-2 py-1 text-xs',
                period === p ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text-primary)]"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1 rounded border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Section 2: Menu ranking */}
      <MenuRankingChart items={itemsWithQuadrant} sortBy={sortBy} onItemClick={setDetailItem} />

      {/* Section 3: Insights — tabs with recommendations (lightbulb) + stats */}
      <MenuEngineeringInsights itemsByQuadrant={itemsByQuadrant} onItemClick={setDetailItem} />

      {/* Section 4: Menu matrix 2x2 — collapsible cards */}
      <MenuMatrixGrid itemsByQuadrant={itemsByQuadrant} onItemClick={setDetailItem} />

      {/* Section 5: Category P&L */}
      <CategoryPLChart data={filteredCategoryPL} />

      {/* Section 6: Item table */}
      <ItemDetailTable
        items={itemsWithQuadrant}
        onItemClick={setDetailItem}
        onAskSage={handleAskSage}
      />

      {detailItem && (
        <ItemDetailPanel item={detailItem} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
}
