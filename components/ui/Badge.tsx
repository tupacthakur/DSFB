'use client';

import { cn } from '@/lib/utils/cn';

export type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-[var(--green-dim)] text-[var(--green)] border-[var(--green-border)]',
  amber:  'bg-[rgba(251,191,36,0.12)] text-[var(--amber)] border-[rgba(251,191,36,0.25)]',
  red:    'bg-[rgba(248,113,113,0.12)] text-[var(--red)] border-[rgba(248,113,113,0.25)]',
  blue:   'bg-[rgba(96,165,250,0.12)] text-[var(--blue)] border-[rgba(96,165,250,0.25)]',
  neutral: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]',
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        VARIANT_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
