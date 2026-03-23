'use client';

import { useState, useCallback, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { validateAPIKey } from '@/lib/api/sage';
import { format } from 'date-fns';
import { cn } from '@/lib/utils/cn';

type KeyStatus = 'connected' | 'invalid' | 'untested' | 'testing';

function formatSavedAt(iso: string): string {
  if (!iso) return 'Never';
  try {
    return format(new Date(iso), 'MMM d, yyyy HH:mm');
  } catch {
    return 'Unknown';
  }
}

export function ApiKeyVault() {
  const {
    anthropicKey,
    keySource,
    openaiKey,
    posEndpoint,
    reservationKey,
    savedAt,
    storageError,
    setAnthropicKey,
    setOpenaiKey,
    setPosEndpoint,
    setReservationKey,
    saveToStorage,
    clearStorageError,
  } = useSettingsStore();

  const [localKey, setLocalKey] = useState(anthropicKey);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [status, setStatus] = useState<KeyStatus>('untested');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setLocalKey(anthropicKey);
  }, [anthropicKey]);

  const handleTest = useCallback(async () => {
    const trimmed = localKey.trim();
    if (keySource === 'settings' && !trimmed) {
      setErrorMsg('Enter a key first');
      return;
    }
    setStatus('testing');
    setErrorMsg(null);
    setToastMsg(null);
    if (trimmed) {
      setAnthropicKey(trimmed);
      saveToStorage();
    }
    try {
      const result = await validateAPIKey();
      if (result.valid) {
        setStatus('connected');
      } else if (result.reason === 'NO_API_KEY') {
        setStatus('untested');
        setToastMsg('Key was not received by the server. Check your browser storage settings.');
      } else {
        setStatus('invalid');
        setErrorMsg(result.reason ?? 'Invalid key');
      }
    } catch {
      setStatus('untested');
      setToastMsg('Could not reach server to validate key.');
    }
  }, [localKey, keySource, setAnthropicKey, saveToStorage]);

  const handleSaveThenTest = useCallback(() => {
    const trimmed = localKey.trim();
    if (!trimmed) {
      setStatus('untested');
      setErrorMsg(null);
      return;
    }
    if (!trimmed.startsWith('sk-ant')) {
      setErrorMsg('Key must start with sk-ant');
      return;
    }
    setErrorMsg(null);
    setToastMsg(null);
    setAnthropicKey(trimmed);
    saveToStorage();
    setStatus('untested');
    setTimeout(() => handleTest(), 0);
  }, [localKey, setAnthropicKey, saveToStorage, handleTest]);

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      {storageError && (
        <div className="flex items-center justify-between rounded border border-[var(--amber)] bg-[var(--amber)]/10 px-3 py-2 text-sm text-[var(--text-primary)]">
          <span>{storageError}</span>
          <button type="button" onClick={clearStorageError} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Dismiss
          </button>
        </div>
      )}
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">API Key Vault</h2>

      {/* Anthropic key: locked (env) vs editable (settings/none) */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Anthropic API Key</label>
        {keySource === 'env' ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-3">
            <CheckCircle className="h-[18px] w-[18px] shrink-0 text-[var(--green)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">Key loaded from environment</p>
              <p className="text-xs text-[var(--text-muted)]">
                ANTHROPIC_API_KEY is set in .env.local. This key is used automatically and cannot be overridden from the UI.
              </p>
            </div>
            <span className="shrink-0 rounded bg-[var(--green)]/20 px-2 py-0.5 text-xs font-medium text-[var(--green)]">
              ● Active
            </span>
          </div>
        ) : (
          <>
            <p className="text-xs text-[var(--text-muted)]">
              No environment key detected. Enter your key below. It will be stored locally in your browser.
            </p>
            <div className="flex items-center gap-2">
              <input
                type={showAnthropic ? 'text' : 'password'}
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <button
                type="button"
                onClick={() => setShowAnthropic((s) => !s)}
                className="rounded p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                aria-label={showAnthropic ? 'Hide key' : 'Show key'}
              >
                {showAnthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveThenTest}
                className="rounded bg-[var(--green)]/20 px-3 py-1.5 text-sm font-medium text-[var(--green)] hover:bg-[var(--green)]/30"
              >
                Save Key
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={!localKey.trim()}
                className="rounded border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                Test Connection
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {status === 'connected' && <span className="text-[var(--green)]">● Connected</span>}
              {status === 'invalid' && (
                <span className="text-[var(--red)]">✕ Invalid key — check and re-enter</span>
              )}
              {status === 'untested' && <span className="text-[var(--text-muted)]">○ Not tested</span>}
              {status === 'testing' && <span className="text-[var(--text-muted)]">Testing...</span>}
              {savedAt && <span className="text-[var(--text-muted)]">Saved {formatSavedAt(savedAt)}</span>}
            </div>
          </>
        )}
      </div>

      {errorMsg && <p className="text-xs text-[var(--red)]">{errorMsg}</p>}
      {toastMsg && (
        <p className="rounded border border-[var(--amber)]/50 bg-[var(--amber)]/10 px-3 py-2 text-xs text-[var(--text-primary)]">
          {toastMsg}
        </p>
      )}

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">OpenAI API Key (optional)</label>
        <div className="flex items-center gap-2">
          <input
            type={showOpenai ? 'text' : 'password'}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button type="button" onClick={() => setShowOpenai((s) => !s)} className="rounded p-2 text-[var(--text-muted)]">
            {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">POS Endpoint URL</label>
        <input
          type="url"
          value={posEndpoint}
          onChange={(e) => setPosEndpoint(e.target.value)}
          placeholder="https://..."
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">Reservation API Key</label>
        <div className="flex items-center gap-2">
          <input
            type={showReservation ? 'text' : 'password'}
            value={reservationKey}
            onChange={(e) => setReservationKey(e.target.value)}
            className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button type="button" onClick={() => setShowReservation((s) => !s)} className="rounded p-2 text-[var(--text-muted)]">
            {showReservation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
