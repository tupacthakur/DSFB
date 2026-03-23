'use client';

import { useState } from 'react';
import { DataIngestion } from '@/components/analytics/DataIngestion';
import { InstantAnalysis } from '@/components/analytics/InstantAnalysis';
import { BarChart3, Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default function DataIntelligenceTab() {
  const [view, setView] = useState<'upload' | 'analysis'>('upload');

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Data Intelligence</h1>
        <div className="flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1">
          <button
            type="button"
            onClick={() => setView('upload')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              view === 'upload' ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setView('analysis')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
              view === 'analysis' ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Instant analysis
          </button>
        </div>
      </div>
      {view === 'upload' && <DataIngestion />}
      {view === 'analysis' && <InstantAnalysis />}
    </div>
  );
}
