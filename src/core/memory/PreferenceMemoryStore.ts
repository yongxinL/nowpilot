import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useThemeStore } from '../stores/themeStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { PreferencePayload } from './memoryTypes';
import { preferenceSchema } from './memoryTypes';
import type { ThemeMode } from '../stores/themeStore';
import type { Surface } from '../stores/workspaceStore';

// ---------------------------------------------------------------------------
// State type: own preference fields + Zustand setter
// ---------------------------------------------------------------------------

export interface PreferenceState extends PreferencePayload {
  setPreferences: (partial: Partial<PreferencePayload>) => void;
}

// ---------------------------------------------------------------------------
// Return type for preferenceMemoryStore.get()
// ---------------------------------------------------------------------------

export interface PreferenceMemoryStoreResult extends PreferencePayload {
  themeMode: ThemeMode;
  defaultSurface: Surface;
}

// ---------------------------------------------------------------------------
// chrome.storage.local adapter (matching workspaceStore.ts pattern)
// ---------------------------------------------------------------------------

const chromeLocalStorage = createJSONStorage<PreferenceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

// ---------------------------------------------------------------------------
// Zustand store with persist — chrome.storage.local, key: np_preferences
// Default values per D-08
// ---------------------------------------------------------------------------

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      // D-08: Default values for all 6 AI-behavioural preference fields
      responseStyle: 'concise',
      preferredLanguage: 'auto',
      preferStructuredOutput: false,
      allowCloudFallbackFromLocal: false,
      defaultProviderId: '',
      toolAutonomy: 'manual',
      // Phase 7.4: Persona identity overrides (D-11, D-21)
      displayName: undefined,
      aiName: undefined,
      aiTone: undefined,
      responseBrevity: undefined,
      setPreferences: (partial: Partial<PreferencePayload>) => set(partial),
    }),
    {
      name: 'np_preferences',
      storage: chromeLocalStorage,
      version: 1,
      migrate: (persisted: unknown) => {
        const p = persisted as Record<string, unknown>;
        // Guard: only transform when aiTone is a legacy free-text string
        if (typeof p.aiTone === 'string' && p.aiTone !== 'professional' && p.aiTone !== 'professional_approachable') {
          const v = p.aiTone as string;
          if (v === 'Professional' || v === 'professional') {
            p.aiTone = 'professional';
          } else if (
            v.includes('Professional + approachable') ||
            v.includes('professional + approachable') ||
            v.startsWith('Professional +')
          ) {
            p.aiTone = 'professional_approachable';
          } else {
            console.warn('[PreferenceMemoryStore] Unknown aiTone value during migration:', v);
            p.aiTone = 'professional_approachable';
          }
        }
        return p as PreferenceState;
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Non-React consumer API (used by MemoryEngine.assemble)
// preferenceMemoryStore.get() reads own state + ThemeStore + WorkspaceStore
// and returns compact JSON per D-09 and D-10
// ---------------------------------------------------------------------------

export const preferenceMemoryStore = {
  get(): PreferenceMemoryStoreResult {
    const own = usePreferenceStore.getState();

    // D-09: Read themeMode from ThemeStore, defaultSurface from WorkspaceStore
    // using vanilla Zustand getState() to avoid circular deps (Research pitfall #4)
    const themeMode = useThemeStore.getState().mode;
    const defaultSurface = useWorkspaceStore.getState().activeSurface;

    // Validate own fields against preferenceSchema
    preferenceSchema.parse({
      responseStyle: own.responseStyle,
      preferredLanguage: own.preferredLanguage,
      preferStructuredOutput: own.preferStructuredOutput,
      allowCloudFallbackFromLocal: own.allowCloudFallbackFromLocal,
      defaultProviderId: own.defaultProviderId,
      toolAutonomy: own.toolAutonomy,
      // Phase 7.4: Pass persona fields through validation gate
      displayName: own.displayName,
      aiName: own.aiName,
      aiTone: own.aiTone,
      responseBrevity: own.responseBrevity,
    });

    return {
      // 6 AI-preference fields (D-08)
      responseStyle: own.responseStyle,
      preferredLanguage: own.preferredLanguage,
      preferStructuredOutput: own.preferStructuredOutput,
      allowCloudFallbackFromLocal: own.allowCloudFallbackFromLocal,
      defaultProviderId: own.defaultProviderId,
      toolAutonomy: own.toolAutonomy,
      // Phase 7.4: Persona identity overrides (D-11, D-21)
      displayName: own.displayName,
      aiName: own.aiName,
      aiTone: own.aiTone,
      responseBrevity: own.responseBrevity,
      // External store reads (D-09)
      themeMode,
      defaultSurface,
    };
  },
};
