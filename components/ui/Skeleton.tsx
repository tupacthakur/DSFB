'use client';

import { cn } from '@/lib/utils/cn';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[var(--bg-elevated)]', className)}
      style={{ backgroundColor: 'var(--bg-elevated)' }}
      aria-hidden
    />
  );
}

/**
 * Grid of skeleton cards used as Suspense fallback for analytics tabs.
 * Matches typical tab layout: header row + content cards.
 */
export function AnalyticsTabSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-24 min-h-[6rem]" />
      ))}
    </div>
  );
}
