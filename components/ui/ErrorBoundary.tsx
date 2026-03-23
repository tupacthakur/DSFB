'use client';

import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  level: 'page' | 'section' | 'chart';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const { level } = this.props;
      const err = this.state.error;
      if (level === 'page') {
        return (
          <div
            className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-base)] p-6"
            role="alert"
          >
            <div className="text-2xl font-semibold text-[var(--text-primary)]">Koravo</div>
            <p className="max-w-md text-center text-[var(--text-secondary)]">{err.message}</p>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <RefreshCw className="h-4 w-4" />
              Reload page
            </button>
          </div>
        );
      }
      if (level === 'section') {
        return (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6"
            role="alert"
          >
            <AlertTriangle className="h-8 w-8 text-[var(--amber)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">{err.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{err.message}</p>
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              Try again
            </button>
          </div>
        );
      }
      // chart
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
          style={{ minHeight: 120 }}
          role="alert"
        >
          <RefreshCw className="h-5 w-5 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Chart error</span>
          <button
            type="button"
            onClick={this.handleReset}
            className="text-xs text-[var(--green)] hover:underline"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
