'use client';

import Link from 'next/link';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { AlertTriangle } from 'lucide-react';

/**
 * Key status indicator on the right. Shown only when not using env key or when no key.
 */
export function Topbar() {
  const keyConfigured = useSettingsStore((s) => s.keyConfigured);
  const keySource = useSettingsStore((s) => s.keySource);

  if (keyConfigured && keySource === 'env') {
    return null;
  }

  if (keyConfigured && keySource === 'settings') {
    return (
      <div className="flex justify-end border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5">
        <span
          className="text-xs text-[var(--text-muted)]"
          title="Using API key from Settings. Add to .env.local for a more permanent setup."
        >
          Key: Settings
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-end border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5">
      <Link
        href="/settings"
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[var(--amber)] hover:bg-[var(--amber)]/10"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>No API key</span>
      </Link>
    </div>
  );
}
