import { describe, it, expect, beforeEach } from 'vitest';
import {
  UserPreferencesSchema,
  useUserPreferencesStore,
  PERSONA_TONE_ENUM,
  PERSONA_BREVITY_ENUM,
} from '../../../src/core/ai/UserPreferences';
import {
  flushPendingWrites,
  __test__ as adapterTest,
} from '../../../src/core/theme/chromeStorageAdapter';

/**
 * UserPreferences acceptance proof (plan 03-02, Task 2): schema parses the
 * three fields, rejects empty-string overrides (z.string().min(1) keeps the
 * seeded persona authoritative), and the store persists under `np_preferences`
 * via chromeStorageAdapter('local') with zustand-persist version 1.
 */

const storageMap = (globalThis as any).__chromeStorageMap as Map<string, string>;

describe('UserPreferences (03-02 Task 2)', () => {
  beforeEach(async () => {
    storageMap.clear();
    adapterTest.resetPendingState();
    useUserPreferencesStore.setState({
      fastModel: undefined,
      balancedModel: undefined,
      personaOverrides: undefined,
    });
    // Flush the reset write so no stale pending write shadows storage reads.
    await flushPendingWrites();
  });

  it('schema parses a full preferences object', () => {
    const parsed = UserPreferencesSchema.parse({
      fastModel: 'gpt-4o-mini',
      balancedModel: 'gpt-4o',
      personaOverrides: { name: 'NP-Consult', tone: 'concise', brevity: 'detailed' },
    });
    expect(parsed.fastModel).toBe('gpt-4o-mini');
    expect(parsed.balancedModel).toBe('gpt-4o');
    expect(parsed.personaOverrides).toEqual({
      name: 'NP-Consult',
      tone: 'concise',
      brevity: 'detailed',
    });
  });

  it('schema parses a minimal (all-optional) preferences object', () => {
    const result = UserPreferencesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('schema REJECTS an empty-string override (min(1) keeps seed authoritative)', () => {
    expect(UserPreferencesSchema.safeParse({ personaOverrides: { name: '' } }).success).toBe(false);
    expect(UserPreferencesSchema.safeParse({ personaOverrides: { tone: '' } }).success).toBe(false);
    expect(UserPreferencesSchema.safeParse({ personaOverrides: { brevity: '' } }).success).toBe(false);
  });

  it('schema rejects invalid tone / brevity override values', () => {
    expect(UserPreferencesSchema.safeParse({ personaOverrides: { tone: 'casual' } }).success).toBe(
      false,
    );
    expect(UserPreferencesSchema.safeParse({ personaOverrides: { brevity: 'chatty' } }).success).toBe(
      false,
    );
  });

  it('store persists under np_preferences via chromeStorageAdapter(local), version 1', async () => {
    useUserPreferencesStore.getState().setFastModel('gpt-4o-mini');
    useUserPreferencesStore.getState().setPersonaOverrides({ name: 'NP-Consult', tone: 'concise' });
    await flushPendingWrites();

    const raw = storageMap.get('np_preferences');
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw as string) as { state: Record<string, unknown>; version: number };
    expect(persisted.version).toBe(1);
    expect(persisted.state.fastModel).toBe('gpt-4o-mini');
    expect(persisted.state.personaOverrides).toEqual({ name: 'NP-Consult', tone: 'concise' });
  });

  it('hydrate() re-reads np_preferences from chrome.storage.local', async () => {
    // What a previous session would have left on disk.
    storageMap.set(
      'np_preferences',
      JSON.stringify({
        state: {
          fastModel: 'gpt-4o-mini',
          balancedModel: undefined,
          personaOverrides: { brevity: 'balanced' },
        },
        version: 1,
      }),
    );
    await useUserPreferencesStore.getState().hydrate();

    const s = useUserPreferencesStore.getState();
    expect(s.fastModel).toBe('gpt-4o-mini');
    expect(s.personaOverrides?.brevity).toBe('balanced');
  });

  it('PERSONA_TONE_ENUM / PERSONA_BREVITY_ENUM match the locked §21.6 enums', () => {
    expect(PERSONA_TONE_ENUM).toEqual(['professional-warm', 'concise', 'friendly']);
    expect(PERSONA_BREVITY_ENUM).toEqual(['brief', 'balanced', 'detailed']);
  });
});