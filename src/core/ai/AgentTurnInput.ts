import type { AgentTurnInput } from './types';
import { getMemoryEngine } from '../memory/MemoryEngine';
import type { RetrievalOptions } from '../memory/types';

export type { AgentTurnInput } from './types';

/**
 * Factory that fills runtime-generated defaults for the fields a caller
 * should not have to provide (D-03). Required identity fields default to
 * fresh UUIDs; optional collections default to empty.
 */
export function createAgentTurnInput(partial: Partial<AgentTurnInput>): AgentTurnInput {
  return {
    operationId: crypto.randomUUID(),
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: '',
    conversationId: crypto.randomUUID(),
    workspaceId: crypto.randomUUID(),
    activeSurface: 'sidepanel',
    providerId: 'openai',
    tier: 'FAST',
    selectedToolSchemas: [],
    memoryHints: [],
    preferences: {},
    personaBehavior: null,
    abortSignal: undefined,
    ...partial,
  };
}

/**
 * Memory-aware turn factory (Phase 5 integration contract): builds the same
 * AgentTurnInput as createAgentTurnInput() but pre-populates the memory
 * context from MemoryEngine — memoryHints from retrieve(), preferences from
 * getPreferences(), and personaBehavior from getPersona(). Callers that
 * need memory context on every AI turn use this factory; the plain factory
 * remains unchanged for backward compatibility (additive, opt-in).
 */
export async function createAgentTurnInputWithMemory(
  partial: Partial<AgentTurnInput>,
  conversationId: string,
  tier: string,
): Promise<AgentTurnInput> {
  const memoryEngine = getMemoryEngine();
  const base = createAgentTurnInput(partial);

  // Memory context: scored + tier-gated ContextItem[] (D-09/D-10)
  const retrievalResult = await memoryEngine.retrieve({
    conversationId,
    query: partial.userInput ?? '',
    tier: tier as RetrievalOptions['tier'],
  });
  if (retrievalResult.success) {
    base.memoryHints = retrievalResult.items;
  }

  // Preferences (persona config etc.) and persona behavior
  const prefs = await memoryEngine.getPreferences();
  base.preferences = prefs as AgentTurnInput['preferences'];
  const persona = await memoryEngine.getPersona();
  if (persona) {
    base.personaBehavior = persona as AgentTurnInput['personaBehavior'];
  }
  return base;
}
