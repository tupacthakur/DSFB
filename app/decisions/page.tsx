import { Suspense } from 'react';
import { DecisionsClient } from './DecisionsClient';

export default function DecisionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] text-sm text-[var(--text-muted)]">
          Loading decisions…
        </div>
      }
    >
      <DecisionsClient />
    </Suspense>
  );
}
