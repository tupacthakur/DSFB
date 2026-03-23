import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg-base)] px-4">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Page not found</h1>
      <p className="text-center text-[var(--text-secondary)]">
        The page you’re looking for doesn’t exist or has been moved.
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          Home
        </Link>
        <Link
          href="/analytics"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          Analytics
        </Link>
        <Link
          href="/chat"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          SAGE Chat
        </Link>
        <Link
          href="/settings"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          Settings
        </Link>
      </nav>
    </div>
  );
}
