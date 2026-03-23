'use client';

import { useEffect } from 'react';
import { useSettingsStore, getResolvedTheme } from '@/lib/store/settingsStore';

/**
 * Applies theme from settings store to document. Runs after SettingsHydrator
 * so stored theme is available. Listens to system preference when theme is "system".
 */
export function ThemeSync() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const resolved = getResolvedTheme(theme);
      root.setAttribute('data-theme', resolved);
    };

    apply();

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handle = () => apply();
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, [theme]);

  return null;
}
