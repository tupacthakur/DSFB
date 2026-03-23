'use client';

import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-[var(--amber)]/20 border-b border-[var(--amber)] px-4 py-2 text-center text-sm text-[var(--text-primary)]">
      You&apos;re offline. SAGE chat requires an internet connection.
    </div>
  );
}
