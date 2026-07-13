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
});
