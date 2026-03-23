'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useChatStore } from '@/lib/store/chatStore';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { useMetricsStore } from '@/lib/store/metricsStore';
import { useIngestedContextStore } from '@/lib/store/ingestedContextStore';
import { callSAGE, SAGEError } from '@/lib/api/sage';
import { buildDataContext } from '@/lib/context/dataContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const MAX_MESSAGE_LENGTH = 4000;
const WARN_AT = 3800;
const COUNTER_AT = 1000;
const LONG_CONVERSATION_THRESHOLD = 40;

export function ChatWindow() {
  const { keyConfigured, keySource } = useSettingsStore();
  const { sessions, activeSessionId, addMessage, appendToLastMessage, updateLastMessage, createSession, syncFromStorage } = useChatStore();
  const session = sessions.find((s) => s.id === activeSessionId);
  const messages = session?.messages ?? [];

  const searchParams = useSearchParams();
  const [input, setInput] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      try {
        setInput(decodeURIComponent(q));
      } catch {
        setInput(q);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || sending) return;
    if (text.length > MAX_MESSAGE_LENGTH) return;

    let sid = activeSessionId;
    if (!sid) {
      sid = createSession();
    }
    setInput('');
    setInlineError(null);
    addMessage(sid, { role: 'user', content: text });
    addMessage(sid, { role: 'assistant', content: '' });
    setSending(true);
    abortRef.current = new AbortController();

    const rawMetrics = useMetricsStore.getState().metrics ?? {};
    const metrics = Object.keys(rawMetrics).length > 0 ? rawMetrics : { food_cost: 30, labor_cost: 30 };
    const ingestedSummary = useIngestedContextStore.getState().summary ?? undefined;
    const context = { dataContext: buildDataContext(), ingestedSummary };
    const sessions = useChatStore.getState().sessions;
    const sess = sessions.find((s) => s.id === sid);
    const list = sess?.messages ?? [];
    const prevForApi = list.slice(0, -2).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const apiMessages = [...prevForApi, { role: 'user' as const, content: text }];
    callSAGE(
      {
        messages: apiMessages,
        metrics,
        sessionId: sid,
        context,
      },
      {
        onToken: (token) => appendToLastMessage(sid, token),
        onDone: () => setSending(false),
        onError: (err: SAGEError) => {
          setSending(false);
          if (err.code === 'INVALID_API_KEY') setInlineError('Your API key was rejected. Please check it in Settings.');
          else setInlineError(err.message);
        },
      },
      abortRef.current.signal
    ).catch(() => setSending(false));
  }, [input, sending, activeSessionId, addMessage, appendToLastMessage, createSession]);

  const lastAssistant = messages.filter((m) => m.role === 'assistant').pop();
  const lastContent = lastAssistant?.content?.trim() ?? '';
  const showEmptyResponse = !sending && lastAssistant && lastContent === '';

  const sanitized = (html: string) => DOMPurify.sanitize(html);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {!keyConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] bg-[var(--amber)]/10 px-4 py-2 text-sm text-[var(--text-primary)]">
          <span>
            SAGE is not configured.{' '}
            {keySource === 'none'
              ? 'Add your Anthropic API key in Settings to enable AI reasoning.'
              : 'Key configuration error. Check Settings.'}
          </span>
          <Link href="/settings" className="shrink-0 font-medium text-[var(--green)] hover:underline">
            Go to Settings →
          </Link>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3 sm:p-4">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Send a message to start.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'inline-block rounded-lg bg-[var(--green)]/20 px-3 py-2 text-sm'
                  : 'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm'
              }
            >
              {m.role === 'assistant' ? (
                <div
                  className="chat-markdown text-[var(--text-primary)]"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      try {
                        const raw = typeof m.content === 'string' ? m.content : '';
                        const parsed = marked.parse(raw || '');
                        return sanitized(typeof parsed === 'string' ? parsed : String(parsed));
                      } catch {
                        return sanitized(String(m.content ?? ''));
                      }
                    })(),
                  }}
                />
              ) : (
                m.content
              )}
              {m.interrupted && (
                <span className="ml-1 text-xs text-[var(--text-muted)]">(interrupted)</span>
              )}
            </div>
          </div>
        ))}
        {showEmptyResponse && (
          <p className="text-sm text-[var(--text-muted)]">SAGE returned an empty response. Try rephrasing your question.</p>
        )}
        {messages.length >= LONG_CONVERSATION_THRESHOLD && (
          <p className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]">
            Long conversation — earliest messages are no longer in SAGE&apos;s context.
          </p>
        )}
      </div>

      {inlineError && (
        <div className="border-t border-[var(--red)]/30 bg-[var(--red)]/10 px-4 py-2 text-sm text-[var(--red)]">
          {inlineError}
        </div>
      )}

      <div className="border-t border-[var(--border-default)] p-3 sm:p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Type a message..."
          disabled={!keyConfigured}
          rows={3}
          className="w-full min-h-[44px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50 touch-manipulation"
        />
        {input.length >= COUNTER_AT && (
          <div
            className={
              input.length >= MAX_MESSAGE_LENGTH
                ? 'text-[var(--red)]'
                : input.length >= WARN_AT
                  ? 'text-[var(--amber)]'
                  : 'text-[var(--text-muted)]'
            }
          >
            {input.length >= MAX_MESSAGE_LENGTH
              ? 'Message too long. Maximum 4000 characters.'
              : `${input.length} / ${MAX_MESSAGE_LENGTH}`}
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSend}
            disabled={!keyConfigured || sending || !input.trim() || input.length > MAX_MESSAGE_LENGTH}
            className="min-h-[44px] min-w-[44px] touch-manipulation rounded-lg bg-[var(--green)]/20 px-4 py-2.5 text-sm font-medium text-[var(--green)] hover:bg-[var(--green)]/30 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
