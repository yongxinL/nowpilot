import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external stores for controlled test values
const mockThemeState = { mode: 'dark' as const };
const mockWorkspaceState = { activeSurface: 'fullapp' as const };

vi.mock('../../../src/core/stores/themeStore', () => ({
  useThemeStore: {
    getState: vi.fn(() => mockThemeState),
  },
}));

vi.mock('../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: vi.fn(() => mockWorkspaceState),
  },
}));

import { preferenceMemoryStore, usePreferenceStore } from '../../../src/core/memory/PreferenceMemoryStore';
import { preferenceSchema } from '../../../src/core/memory/memoryTypes';

describe('PreferenceMemoryStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with defaults for all 6 AI-preference fields', () => {
    const state = usePreferenceStore.getState();
    expect(state.responseStyle).toBe('concise');
    expect(state.preferredLanguage).toBe('auto');
    expect(state.preferStructuredOutput).toBe(false);
    expect(state.allowCloudFallbackFromLocal).toBe(false);
    expect(state.defaultProviderId).toBe('');
    expect(state.toolAutonomy).toBe('manual');
  });

  it('setPreferences updates a value and persists via chrome.storage.local', () => {
    usePreferenceStore.getState().setPreferences({ responseStyle: 'verbose' });
    const state = usePreferenceStore.getState();
    expect(state.responseStyle).toBe('verbose');
    // Other fields should remain at defaults
    expect(state.preferredLanguage).toBe('auto');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('get() returns PreferencePayload with themeMode read from ThemeStore.getState().mode', () => {
    const result = preferenceMemoryStore.get();
    expect(result.themeMode).toBe('dark');
  });

  it('get() returns PreferencePayload with defaultSurface read from WorkspaceStore.getState().activeSurface', () => {
    const result = preferenceMemoryStore.get();
    expect(result.defaultSurface).toBe('fullapp');
  });

  it('get() output matches preferenceSchema Zod validation', () => {
    const result = preferenceMemoryStore.get();
    const parsed = preferenceSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('get() output is a plain JSON object (compact JSON, not verbose prose per D-10)', () => {
    const result = preferenceMemoryStore.get();
    expect(result.constructor).toBe(Object);
    expect(Object.prototype.toString.call(result)).toBe('[object Object]');
  });

  describe('PreferenceMemoryStore — persona/displayName fields (Phase 7.4)', () => {
    it('preferenceSchema.parse() accepts object with only the 6 existing fields (backward compat)', () => {
      const parsed = preferenceSchema.safeParse({
        responseStyle: 'concise',
        preferredLanguage: 'auto',
        preferStructuredOutput: false,
        allowCloudFallbackFromLocal: false,
        defaultProviderId: '',
        toolAutonomy: 'manual',
      });
      expect(parsed.success).toBe(true);
    });

    it('preferenceSchema.parse() accepts object with displayName, aiName, aiTone, responseBrevity as optional/undefined', () => {
      const parsed = preferenceSchema.safeParse({
        responseStyle: 'concise',
        preferredLanguage: 'auto',
        preferStructuredOutput: false,
        allowCloudFallbackFromLocal: false,
        defaultProviderId: '',
        toolAutonomy: 'manual',
        displayName: 'George',
        aiName: 'TestBot',
        aiTone: 'casual',
        responseBrevity: 'detailed',
      });
      expect(parsed.success).toBe(true);
    });

    it('usePreferenceStore initial state includes displayName=undefined, aiName=undefined, aiTone=undefined, responseBrevity=undefined', () => {
      const state = usePreferenceStore.getState();
      expect((state as any).displayName).toBeUndefined();
      expect((state as any).aiName).toBeUndefined();
      expect((state as any).aiTone).toBeUndefined();
      expect((state as any).responseBrevity).toBeUndefined();
    });

    it('preferenceMemoryStore.get() passes new fields through validation gate and returns them in result', () => {
      // Set a displayName first
      usePreferenceStore.getState().setPreferences({ displayName: 'George' } as any);
      const result = preferenceMemoryStore.get();
      expect((result as any).displayName).toBe('George');
    });

    it('setPreferences({ displayName: "George" }) updates only displayName; other fields unchanged', () => {
      // Reset and set displayName
      usePreferenceStore.getState().setPreferences({ displayName: 'George' } as any);
      const state = usePreferenceStore.getState();
      expect((state as any).displayName).toBe('George');
      // Other fields remain at defaults
      expect((state as any).aiName).toBeUndefined();
      expect((state as any).aiTone).toBeUndefined();
      expect((state as any).responseBrevity).toBeUndefined();
    });
  });
});
