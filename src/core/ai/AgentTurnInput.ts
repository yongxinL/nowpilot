import type { AgentTurnInput } from './types';

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
