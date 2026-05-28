'use client';

import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SessionSidebar } from '@/components/chat/SessionSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function ChatPage() {
  return (
    <ErrorBoundary level="page">
      <div className="flex h-screen">
        <SessionSidebar />
        <ErrorBoundary level="section">
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            <div className="info-banner mx-3 mt-3 mb-2 hidden md:block">
              <p className="text-sm font-medium text-[var(--text-primary)]">SAGE command center</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Ask for diagnostics, quantify financial impact, then convert recommendations into 7-day and 30-day execution steps.
              </p>
            </div>
            <Suspense fallback={<div className="flex flex-1 items-center justify-center text-[var(--text-muted)]">Loading…</div>}>
              <ChatWindow />
            </Suspense>
          </div>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
