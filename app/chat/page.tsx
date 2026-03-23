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
            <Suspense fallback={<div className="flex flex-1 items-center justify-center text-[var(--text-muted)]">Loading…</div>}>
              <ChatWindow />
            </Suspense>
          </div>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
