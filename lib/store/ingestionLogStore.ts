import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_EVENTS = 40;

export interface IngestionEvent {
  id: string;
  at: string;
  fileName: string | null;
  schema: string;
  rowCount: number;
  columnCount: number;
  dataRowCount: number;
  skippedRowCount: number;
  dailyDays: number;
  dateRange: { start: string; end: string } | null;
  warnings: string[];
  branchesDetected: string[];
}

function newId(): string {
  return `ing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface IngestionLogState {
  events: IngestionEvent[];
}

interface IngestionLogActions {
  pushIngestion: (event: Omit<IngestionEvent, 'id' | 'at'>) => void;
  clearIngestions: () => void;
}

export const useIngestionLogStore = create<IngestionLogState & IngestionLogActions>()(
  persist(
    (set) => ({
      events: [],
      pushIngestion: (event) =>
        set((s) => {
          const full: IngestionEvent = {
            ...event,
            id: newId(),
            at: new Date().toISOString(),
          };
          return { events: [full, ...s.events].slice(0, MAX_EVENTS) };
        }),
      clearIngestions: () => set({ events: [] }),
    }),
    { name: 'koravo-ingestion-log-v1' }
  )
);

export function ingestionStats(events: IngestionEvent[]) {
  const last = events[0];
  const totalRows = events.reduce((s, e) => s + e.rowCount, 0);
  const totalWarnings = events.reduce((s, e) => s + e.warnings.length, 0);
  return { runCount: events.length, last, totalRows, totalWarnings };
}
