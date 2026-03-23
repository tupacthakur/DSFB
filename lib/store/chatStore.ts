import { create } from 'zustand';

const STORAGE_KEY = 'koravo_chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  interrupted?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'>) => void;
  updateLastMessage: (sessionId: string, content: string, interrupted?: boolean) => void;
  appendToLastMessage: (sessionId: string, append: string) => void;
  createSession: () => string;
  syncFromStorage: () => void;
  persist: () => void;
}

function loadFromStorage(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { sessions?: ChatSession[] };
    return Array.isArray(parsed.sessions) ? parsed.sessions : [];
  } catch {
    return [];
  }
}

function saveToStorage(sessions: ChatSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions }));
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      try {
        if (sessions.length > 0) {
          const trimmed = sessions.slice(-20);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: trimmed }));
        }
      } catch {
        // ignore
      }
    }
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  setActiveSession: (id) => set({ activeSessionId: id }),
  addMessage: (sessionId, message) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => {
      const sessions = s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, messages: [...sess.messages, { ...message, id }] }
          : sess
      );
      saveToStorage(sessions);
      return { sessions };
    });
  },
  updateLastMessage: (sessionId, content, interrupted) => {
    set((s) => {
      const sessions = s.sessions.map((sess) => {
        if (sess.id !== sessionId || sess.messages.length === 0) return sess;
        const last = sess.messages[sess.messages.length - 1]!;
        const messages = [...sess.messages.slice(0, -1), { ...last, content, interrupted }];
        return { ...sess, messages };
      });
      saveToStorage(sessions);
      return { sessions };
    });
  },
  appendToLastMessage: (sessionId, append) => {
    set((s) => {
      const sessions = s.sessions.map((sess) => {
        if (sess.id !== sessionId || sess.messages.length === 0) return sess;
        const last = sess.messages[sess.messages.length - 1]!;
        const messages = [...sess.messages.slice(0, -1), { ...last, content: last.content + append }];
        return { ...sess, messages };
      });
      saveToStorage(sessions);
      return { sessions };
    });
  },
  createSession: () => {
    const id = `session-${Date.now()}`;
    const session: ChatSession = {
      id,
      title: 'New chat',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => {
      const sessions = [session, ...s.sessions];
      saveToStorage(sessions);
      return { sessions, activeSessionId: id };
    });
    return id;
  },
  syncFromStorage: () => set({ sessions: loadFromStorage() }),
  persist: () => saveToStorage(get().sessions),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) useChatStore.getState().syncFromStorage();
  });
}
