'use client';

import { useSettingsStore, getResolvedTheme, type ThemeMode } from '@/lib/store/settingsStore';
import { Sun, Moon, Monitor } from 'lucide-react';

const OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];

export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'buttons' }) {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const resolved = getResolvedTheme(theme);

  const cycle = () => {
    const i = OPTIONS.indexOf(theme);
    setTheme(OPTIONS[(i + 1) % OPTIONS.length]!);
  };

  if (variant === 'buttons') {
    return (
      <div className="flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1">
        {(['light', 'dark', 'system'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setTheme(opt)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            style={{
              backgroundColor: theme === opt ? 'var(--green-dim)' : 'transparent',
              color: theme === opt ? 'var(--green)' : 'var(--text-muted)',
            }}
            title={opt === 'system' ? 'System' : opt === 'light' ? 'Light' : 'Dark'}
          >
            {opt === 'light' && <Sun className="h-4 w-4" />}
            {opt === 'dark' && <Moon className="h-4 w-4" />}
            {opt === 'system' && <Monitor className="h-4 w-4" />}
            <span>{opt === 'system' ? 'System' : opt === 'light' ? 'Light' : 'Dark'}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
      title={`Theme: ${theme === 'system' ? 'System' : theme} (click to cycle)`}
      aria-label="Toggle theme"
    >
      {resolved === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
