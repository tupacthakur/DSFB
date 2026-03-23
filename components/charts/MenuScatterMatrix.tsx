'use client';

import {
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Tooltip,
  ZAxis,
} from 'recharts';
import type { MenuScatterItem, QuadrantKey } from '@/lib/store/metricsStore';
import { ScatterTooltip } from '@/components/charts/CustomTooltip';
import { EmptyState } from '@/components/ui/EmptyState';

const QUAD_COLOR: Record<QuadrantKey, string> = {
  stars: 'var(--green)',
  puzzles: 'var(--blue)',
  plowhorses: 'var(--amber)',
  dogs: 'var(--red)',
};

export interface MenuScatterMatrixProps {
  data: MenuScatterItem[];
  avgVolumeThreshold: number;
  targetMargin: number;
  height?: number;
}

export function MenuScatterMatrix({
  data,
  avgVolumeThreshold,
  targetMargin,
  height = 240,
}: MenuScatterMatrixProps) {
  const safeData = data ?? [];
  if (!safeData.length) {
    return <EmptyState message="No menu data" height={height} />;
  }

  const scatterData = safeData.map((d) => ({
    ...d,
    quadrant: d.quadrant.toUpperCase(),
  }));

  const counts = safeData.reduce(
    (acc, d) => {
      acc[d.quadrant] = (acc[d.quadrant] ?? 0) + 1;
      return acc;
    },
    {} as Record<QuadrantKey, number>
  );

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
            <XAxis
              type="number"
              dataKey="covers"
              name="Covers"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number"
              dataKey="marginPct"
              name="Margin %"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <ZAxis type="number" dataKey="revenue" range={[6, 6]} />
            <ReferenceLine
              x={avgVolumeThreshold}
              stroke="var(--border-strong)"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
            />
            <ReferenceLine
              y={targetMargin}
              stroke="var(--border-strong)"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
            />
            <Tooltip content={<ScatterTooltip />} cursor={{ stroke: 'var(--border-default)' }} />
            <Scatter
              data={scatterData}
              fill="var(--green)"
              shape="circle"
              legendType="none"
            >
              {scatterData.map((entry) => (
                <Cell key={entry.id} fill={QUAD_COLOR[entry.quadrant as QuadrantKey]} />
              ))}
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
        {/* Quadrant labels as absolute divs so they don't clip */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ marginLeft: '8px', marginTop: '8px', marginRight: '8px', marginBottom: '24px' }}
        >
          <div
            className="absolute text-[10px] font-semibold"
            style={{ color: 'var(--green)', right: '15%', top: '8%' }}
          >
            STARS
          </div>
          <div
            className="absolute text-[10px] font-semibold"
            style={{ color: 'var(--blue)', left: '15%', top: '8%' }}
          >
            PUZZLES
          </div>
          <div
            className="absolute text-[10px] font-semibold"
            style={{ color: 'var(--amber)', right: '15%', bottom: '15%' }}
          >
            PLOWHORSES
          </div>
          <div
            className="absolute text-[10px] font-semibold"
            style={{ color: 'var(--red)', left: '15%', bottom: '15%' }}
          >
            DOGS
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['stars', 'puzzles', 'plowhorses', 'dogs'] as const).map((q) => (
          <span
            key={q}
            className="rounded px-2 py-0.5 text-xs font-medium capitalize"
            style={{
              backgroundColor: `${QUAD_COLOR[q]}20`,
              color: QUAD_COLOR[q],
            }}
          >
            {q}: {counts[q] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}
