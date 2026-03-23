import { create } from 'zustand';

/**
 * Optional summary of last ingested CSV/upload for SAGE context.
 * Set by DataIngestion when user uploads a file; ChatWindow sends as context.ingestedSummary.
 */
interface IngestedContextState {
  summary: string | null;
  setSummary: (summary: string | null) => void;
}

export const useIngestedContextStore = create<IngestedContextState>((set) => ({
  summary: null,
  setSummary: (summary) => set({ summary }),
}));
