'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';
import { domainWithBreathingRoom } from '@/lib/utils/math';

export interface SparklineProps {
  data: number[];
  className?: string;
  color?: string;
  height?: number;
}

export function Sparkline({ data, className, color = 'var(--green)', height = 28 }: SparklineProps) {
  const path = useMemo(() => {
    if (!data.length) return '';
    const finite = data.filter((v) => Number.isFinite(v));
    if (!finite.length) return '';
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const [dMin, dMax] = domainWithBreathingRoom(min, max);
    const range = dMax - dMin || 1;
    const w = 80;
    const h = height - 4;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * w;
      const yVal = Number.isFinite(v) ? v : dMin;
      const y = h - ((yVal - dMin) / range) * h;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [data, height]);

  if (!data.length) return <div className={cn('flex items-center justify-center text-[var(--text-muted)] text-xs', className)} style={{ height }} aria-hidden>—</div>;

  return (
    <svg
      className={cn('overflow-visible', className)}
      width="100%"
      height={height}
      viewBox={`0 0 80 ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
