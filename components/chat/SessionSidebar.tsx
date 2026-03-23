'use client';

import Link from 'next/link';
import { useChatStore } from '@/lib/store/chatStore';

export function SessionSidebar() {
  const { sessions, activeSessionId, setActiveSession, createSession } = useChatStore();

  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] sm:w-56">
      <div className="border-b border-[var(--border-subtle)] p-2">
        <Link
          href="/"
          className="mb-2 block rounded-lg px-3 py-2 text-center text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--green)] transition-colors"
        >
          Koravo
        </Link>
        <button
          type="button"
          onClick={() => createSession()}
          className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] min-h-[44px] touch-manipulation"
        >
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSession(s.id)}
            className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm min-h-[44px] touch-manipulation ${
              activeSessionId === s.id ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
