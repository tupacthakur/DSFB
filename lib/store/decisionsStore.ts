import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMetricsStore } from '@/lib/store/metricsStore';

export type DecisionStatus = 'open' | 'in_progress' | 'done' | 'dropped';
export type DecisionPriority = 'high' | 'medium' | 'low';
export type DecisionSource = 'command_centre' | 'action_center' | 'decisions_page';

export interface DecisionEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  rationale: string;
  priority: DecisionPriority;
  status: DecisionStatus;
  source: DecisionSource;
  linkedSignalId?: string;
  /** KPI snapshot at commit time for audit trail */
  metricsSnapshot: Record<string, number>;
}

function snapshotMetrics(): Record<string, number> {
  try {
    const m = useMetricsStore.getState().metrics;
    return { ...m };
  } catch {
    return {};
  }
}

function newId(): string {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface DecisionsState {
  decisions: DecisionEntry[];
}

interface DecisionsActions {
  addDecision: (input: {
    title: string;
    rationale: string;
    priority: DecisionPriority;
    source: DecisionSource;
    linkedSignalId?: string;
    metricsSnapshot?: Record<string, number>;
  }) => DecisionEntry;
  updateDecision: (id: string, patch: Partial<Pick<DecisionEntry, 'title' | 'rationale' | 'priority' | 'status'>>) => void;
  removeDecision: (id: string) => void;
}

export const useDecisionsStore = create<DecisionsState & DecisionsActions>()(
  persist(
    (set) => ({
      decisions: [],
      addDecision: (input) => {
        const now = new Date().toISOString();
        const entry: DecisionEntry = {
          id: newId(),
          createdAt: now,
          updatedAt: now,
          title: input.title.trim(),
          rationale: input.rationale.trim(),
          priority: input.priority,
          status: 'open',
          source: input.source,
          linkedSignalId: input.linkedSignalId,
          metricsSnapshot: input.metricsSnapshot ?? snapshotMetrics(),
        };
        set((s) => ({ decisions: [entry, ...s.decisions] }));
        return entry;
      },
      updateDecision: (id, patch) =>
        set((s) => ({
          decisions: s.decisions.map((d) =>
            d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
          ),
        })),
      removeDecision: (id) => set((s) => ({ decisions: s.decisions.filter((d) => d.id !== id) })),
    }),
    { name: 'koravo-decisions-v1' }
  )
);

/** Derived stats for dashboards (no persist extra state). */
export function computeDecisionStats(decisions: DecisionEntry[]) {
  const byStatus = { open: 0, in_progress: 0, done: 0, dropped: 0 } as Record<DecisionStatus, number>;
  const byPriority = { high: 0, medium: 0, low: 0 } as Record<DecisionPriority, number>;
  for (const d of decisions) {
    byStatus[d.status]++;
    byPriority[d.priority]++;
  }
  const weekAgo = Date.now() - 7 * 86400000;
  const completedThisWeek = decisions.filter(
    (d) => d.status === 'done' && new Date(d.updatedAt).getTime() >= weekAgo
  ).length;
  return { total: decisions.length, byStatus, byPriority, completedThisWeek };
}
