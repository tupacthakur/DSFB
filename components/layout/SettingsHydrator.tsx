'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/store/settingsStore';

/**
 * On app load: read from localStorage, decode keys, populate settingsStore.
 * Call key-status to set keySource (env vs settings vs none). Rendered once from root layout.
 */
export function SettingsHydrator() {
  const loadFromStorage = useSettingsStore((s) => s.loadFromStorage);
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const checkKeySource = async () => {
      try {
        const res = await fetch('/api/sage/key-status');
        const data = (await res.json()) as { source: 'env' | 'none'; configured: boolean };
        const store = useSettingsStore.getState();
        store.setKeySource(
          data.source === 'env' ? 'env' : store.anthropicKey.trim() ? 'settings' : 'none'
        );
        if (data.source === 'env') {
          store.saveToStorage();
        }
      } catch {
        // Network error — leave store as-is
      }
    };
    checkKeySource();

    const checkRista = async () => {
      try {
        const res = await fetch('/api/rista/key-status');
        const data = (await res.json()) as { source: 'env' | 'none'; configured: boolean };
        const store = useSettingsStore.getState();
        if (data.source === 'env' && data.configured) {
          store.setRistaKeySource('env');
          store.saveToStorage();
        }
      } catch {
        // leave as-is
      }
    };
    checkRista();
  }, []);
  return null;
}
