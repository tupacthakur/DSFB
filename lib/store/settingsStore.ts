import { create } from 'zustand';

/**
 * Encode for storage: obfuscation only (not encryption). Prevents accidental
 * exposure in dev tools. Do not rely on this for security.
 */
function encodeForStorage(value: string): string {
  if (!value) return '';
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeFromStorage(stored: string): string {
  if (!stored) return '';
  try {
    return decodeURIComponent(escape(atob(stored)));
  } catch {
    return '';
  }
}

const STORAGE_KEY = 'koravo_settings';

export type ThemeMode = 'light' | 'dark' | 'system';

export type KeySource = 'env' | 'settings' | 'none';
export type RistaKeySource = 'env' | 'settings' | 'none';

export interface RestaurantProfile {
  name: string;
  cuisineType: string;
  seatingCapacity: number;
  avgCoversPerWeek: number;
  serviceStyle: string;
  currency: string;
}

export const DEFAULT_RESTAURANT_PROFILE: RestaurantProfile = {
  name: 'Your Restaurant',
  cuisineType: 'Casual Dining',
  seatingCapacity: 80,
  avgCoversPerWeek: 1200,
  serviceStyle: 'Full Service',
  currency: 'INR',
};

export interface StoredSettings {
  anthropicKey: string;
  ristaApiKey: string;
  ristaSecretKey: string;
  openaiKey: string;
  posEndpoint: string;
  reservationKey: string;
  savedAt: string;
  theme: ThemeMode;
  restaurantProfile: RestaurantProfile;
}

export interface SettingsState extends StoredSettings {
  keySource: KeySource;
  keyConfigured: boolean;
  ristaKeySource: RistaKeySource;
  ristaConfigured: boolean;
  storageError: string | null;
  setAnthropicKey: (value: string) => void;
  clearAnthropicKey: () => void;
  setKeySource: (source: KeySource) => void;
  setRistaApiKey: (value: string) => void;
  setRistaSecretKey: (value: string) => void;
  setRistaKeySource: (source: RistaKeySource) => void;
  setRestaurantProfile: (value: Partial<RestaurantProfile>) => void;
  setOpenaiKey: (value: string) => void;
  setPosEndpoint: (value: string) => void;
  setReservationKey: (value: string) => void;
  setTheme: (value: ThemeMode) => void;
  saveToStorage: () => void;
  loadFromStorage: () => void;
  clearStorageError: () => void;
}

const defaultSettings: StoredSettings = {
  anthropicKey: '',
  ristaApiKey: '',
  ristaSecretKey: '',
  openaiKey: '',
  posEndpoint: '',
  reservationKey: '',
  savedAt: '',
  theme: 'system',
  restaurantProfile: DEFAULT_RESTAURANT_PROFILE,
};

function computeKeyConfigured(keySource: KeySource, anthropicKey: string): boolean {
  return keySource === 'env' || (keySource === 'settings' && anthropicKey.trim().length > 10);
}

function computeRistaConfigured(
  ristaKeySource: RistaKeySource,
  ristaApiKey: string,
  ristaSecretKey: string
): boolean {
  return (
    ristaKeySource === 'env' ||
    (ristaKeySource === 'settings' && ristaApiKey.trim().length > 8 && ristaSecretKey.trim().length > 8)
  );
}

function loadStored(): Partial<SettingsState> {
  if (typeof window === 'undefined') {
    return {
      ...defaultSettings,
      keySource: 'none',
      keyConfigured: false,
      ristaKeySource: 'none',
      ristaConfigured: false,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaultSettings,
        keySource: 'none',
        keyConfigured: false,
        ristaKeySource: 'none',
        ristaConfigured: false,
      };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const theme = parsed.theme as string | undefined;
    const themeMode: ThemeMode =
      theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
    let anthropicKey = '';
    if (typeof parsed.anthropicKey === 'string' && parsed.anthropicKey) {
      try {
        anthropicKey = decodeFromStorage(parsed.anthropicKey);
      } catch {
        anthropicKey = '';
      }
    }
    const keySource: KeySource =
      parsed.keySource === 'env' || parsed.keySource === 'settings' ? (parsed.keySource as KeySource) : 'none';
    /** Env-backed keys are not stored locally; keep keySource env so UI does not flash "unconfigured" on reload. */
    const effectiveSource: KeySource =
      keySource === 'env' ? 'env' : anthropicKey.trim() ? keySource : 'none';

    let ristaApiKey = '';
    if (typeof parsed.ristaApiKey === 'string' && parsed.ristaApiKey) {
      try {
        ristaApiKey = decodeFromStorage(parsed.ristaApiKey);
      } catch {
        ristaApiKey = '';
      }
    }
    let ristaSecretKey = '';
    if (typeof parsed.ristaSecretKey === 'string' && parsed.ristaSecretKey) {
      try {
        ristaSecretKey = decodeFromStorage(parsed.ristaSecretKey);
      } catch {
        ristaSecretKey = '';
      }
    }
    const ristaKeySource: RistaKeySource =
      parsed.ristaKeySource === 'env' || parsed.ristaKeySource === 'settings'
        ? (parsed.ristaKeySource as RistaKeySource)
        : 'none';
    const effectiveRistaSource: RistaKeySource =
      ristaKeySource === 'env' ? 'env' : ristaApiKey.trim() && ristaSecretKey.trim() ? ristaKeySource : 'none';
    let restaurantProfile = DEFAULT_RESTAURANT_PROFILE;
    const rp = parsed.restaurantProfile;
    if (typeof rp === 'string') {
      try {
        const p = JSON.parse(rp) as Record<string, unknown>;
        if (p && typeof p === 'object') {
          restaurantProfile = {
            name: typeof p.name === 'string' ? p.name : DEFAULT_RESTAURANT_PROFILE.name,
            cuisineType: typeof p.cuisineType === 'string' ? p.cuisineType : DEFAULT_RESTAURANT_PROFILE.cuisineType,
            seatingCapacity: typeof p.seatingCapacity === 'number' ? p.seatingCapacity : DEFAULT_RESTAURANT_PROFILE.seatingCapacity,
            avgCoversPerWeek: typeof p.avgCoversPerWeek === 'number' ? p.avgCoversPerWeek : DEFAULT_RESTAURANT_PROFILE.avgCoversPerWeek,
            serviceStyle: typeof p.serviceStyle === 'string' ? p.serviceStyle : DEFAULT_RESTAURANT_PROFILE.serviceStyle,
            currency: typeof p.currency === 'string' ? p.currency : DEFAULT_RESTAURANT_PROFILE.currency,
          };
        }
      } catch {
        // keep default
      }
    } else if (rp && typeof rp === 'object' && !Array.isArray(rp)) {
      const p = rp as Record<string, unknown>;
      restaurantProfile = {
        name: typeof p.name === 'string' ? p.name : DEFAULT_RESTAURANT_PROFILE.name,
        cuisineType: typeof p.cuisineType === 'string' ? p.cuisineType : DEFAULT_RESTAURANT_PROFILE.cuisineType,
        seatingCapacity: typeof p.seatingCapacity === 'number' ? p.seatingCapacity : DEFAULT_RESTAURANT_PROFILE.seatingCapacity,
        avgCoversPerWeek: typeof p.avgCoversPerWeek === 'number' ? p.avgCoversPerWeek : DEFAULT_RESTAURANT_PROFILE.avgCoversPerWeek,
        serviceStyle: typeof p.serviceStyle === 'string' ? p.serviceStyle : DEFAULT_RESTAURANT_PROFILE.serviceStyle,
        currency: typeof p.currency === 'string' ? p.currency : DEFAULT_RESTAURANT_PROFILE.currency,
      };
    }
    return {
      ...defaultSettings,
      anthropicKey,
      ristaApiKey,
      ristaSecretKey,
      openaiKey: typeof parsed.openaiKey === 'string' ? decodeFromStorage(parsed.openaiKey) : '',
      posEndpoint: typeof parsed.posEndpoint === 'string' ? parsed.posEndpoint : '',
      reservationKey: typeof parsed.reservationKey === 'string' ? decodeFromStorage(parsed.reservationKey) : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      theme: themeMode,
      restaurantProfile,
      keySource: effectiveSource,
      keyConfigured: computeKeyConfigured(effectiveSource, anthropicKey),
      ristaKeySource: effectiveRistaSource,
      ristaConfigured: computeRistaConfigured(effectiveRistaSource, ristaApiKey, ristaSecretKey),
    };
  } catch {
    return {
      ...defaultSettings,
      keySource: 'none',
      keyConfigured: false,
      ristaKeySource: 'none',
      ristaConfigured: false,
    };
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  keySource: 'none',
  keyConfigured: false,
  ristaKeySource: 'none',
  ristaConfigured: false,
  storageError: null,
  setAnthropicKey: (value) =>
    set((state) => ({
      anthropicKey: value,
      keySource: 'settings',
      keyConfigured: value.trim().length > 10,
    })),
  clearAnthropicKey: () =>
    set({
      anthropicKey: '',
      keySource: 'none',
      keyConfigured: false,
    }),
  setKeySource: (source) =>
    set((state) => ({
      keySource: source,
      keyConfigured: source === 'env' || (source === 'settings' && state.anthropicKey.trim().length > 10),
    })),
  setRistaApiKey: (value) =>
    set((state) => ({
      ristaApiKey: value,
      ristaKeySource: 'settings',
      ristaConfigured: computeRistaConfigured('settings', value, state.ristaSecretKey),
    })),
  setRistaSecretKey: (value) =>
    set((state) => ({
      ristaSecretKey: value,
      ristaKeySource: 'settings',
      ristaConfigured: computeRistaConfigured('settings', state.ristaApiKey, value),
    })),
  setRistaKeySource: (source) =>
    set((state) => ({
      ristaKeySource: source,
      ristaConfigured:
        source === 'env' || computeRistaConfigured(source, state.ristaApiKey, state.ristaSecretKey),
    })),
  setRestaurantProfile: (value) =>
    set((state) => ({
      restaurantProfile: { ...state.restaurantProfile, ...value },
    })),
  setOpenaiKey: (value) => set({ openaiKey: value }),
  setPosEndpoint: (value) => set({ posEndpoint: value }),
  setReservationKey: (value) => set({ reservationKey: value }),
  setTheme: (value) => {
    set({ theme: value });
    get().saveToStorage();
  },
  clearStorageError: () => set({ storageError: null }),
  saveToStorage: () => {
    const s = get();
    const toStore: Record<string, string> = {
      anthropicKey: s.anthropicKey ? encodeForStorage(s.anthropicKey) : '',
      ristaApiKey: s.ristaApiKey ? encodeForStorage(s.ristaApiKey) : '',
      ristaSecretKey: s.ristaSecretKey ? encodeForStorage(s.ristaSecretKey) : '',
      openaiKey: s.openaiKey ? encodeForStorage(s.openaiKey) : '',
      posEndpoint: s.posEndpoint,
      reservationKey: s.reservationKey ? encodeForStorage(s.reservationKey) : '',
      savedAt: new Date().toISOString(),
      theme: s.theme,
      keySource: s.keySource,
      ristaKeySource: s.ristaKeySource,
      restaurantProfile: JSON.stringify(s.restaurantProfile),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      set({ savedAt: toStore.savedAt, storageError: null });
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        try {
          const chatRaw = localStorage.getItem('koravo_chat');
          if (chatRaw) {
            const chat = JSON.parse(chatRaw) as { sessions?: unknown[] };
            if (Array.isArray(chat.sessions) && chat.sessions.length > 0) {
              chat.sessions.shift();
              localStorage.setItem('koravo_chat', JSON.stringify(chat));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
              set({ savedAt: toStore.savedAt, storageError: null });
              return;
            }
          }
        } catch {
          // ignore
        }
        set({ storageError: 'Storage full. Old chat sessions may not be saved.' });
      }
    }
  },
  loadFromStorage: () => set(loadStored()),
}));

export function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
