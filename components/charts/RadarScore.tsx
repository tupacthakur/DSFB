'use client';

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { RadarAxis } from '@/lib/store/metricsStore';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export interface RadarScoreProps {
  data: RadarAxis[];
  height?: number;
}

export function RadarScore({ data, height = 240 }: RadarScoreProps) {
  const safeData = data ?? [];
  if (!safeData.length) {
    return <EmptyState message="No radar data" height={height} />;
  }

  const chartData = safeData.map((d) => ({
    name: d.name,
    yourScore: d.yourScore,
    benchmark: d.benchmark,
    fullMark: 5,
  }));

  const strongestAxis = safeData.reduce((best, curr) => {
    const gap = curr.yourScore - curr.benchmark;
    if (gap > (best.gap ?? -Infinity)) return { name: curr.name, gap };
    return best;
  }, { name: '', gap: null as number | null });
  const weakestAxis = safeData.reduce((worst, curr) => {
    if (curr.yourScore < (worst.score ?? Infinity)) return { name: curr.name, score: curr.yourScore };
    return worst;
  }, { name: '', score: null as number | null });
  const avgYour = safeData.reduce((s, d) => s + d.yourScore, 0) / safeData.length;
  const avgBench = safeData.reduce((s, d) => s + d.benchmark, 0) / safeData.length;
  const npsDirection = avgYour >= avgBench ? 'green' : 'amber';

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <PolarGrid stroke="var(--border-subtle)" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 5]}
            tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
          />
          <Radar
            name="Your Score"
            dataKey="yourScore"
            stroke="var(--green)"
            fill="var(--green)"
            fillOpacity={0.15}
            strokeWidth={1.5}
          />
          <Radar
            name="Industry Benchmark"
            dataKey="benchmark"
            stroke="var(--blue)"
            fill="var(--blue)"
            fillOpacity={0.08}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => <span style={{ color: 'var(--text-muted)' }}>{value}</span>}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {strongestAxis.name && (
          <Badge variant="green">Strongest: {strongestAxis.name}</Badge>
        )}
        {weakestAxis.name && (
          <Badge variant="red">Weakest: {weakestAxis.name}</Badge>
        )}
        <Badge variant={npsDirection === 'green' ? 'green' : 'amber'}>
          {avgYour >= avgBench ? 'Above' : 'Below'} benchmark overall
        </Badge>
      </div>
    </div>
  );
}
