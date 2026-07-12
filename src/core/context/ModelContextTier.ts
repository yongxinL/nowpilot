import type { ModelContextTier, PromptSectionKindType } from './contextTypes';

export function classifyModelContext(contextWindow: number): ModelContextTier {
  if (contextWindow <= 4096) return 'tiny';
  if (contextWindow <= 16384) return 'small';
  if (contextWindow <= 131072) return 'medium';
  return 'large';
}

export const CONTEXT_SOURCE_PRIORITY = [
  'system_prompt',
  'user_input',
  'tool_results',
  'workspace_context',
  'conversation_history',
  'memory',
  'page_context',
  'notes_metadata',
  'debug_data',
] as const;

export type ContextSourcePriorityType = (typeof CONTEXT_SOURCE_PRIORITY)[number];

export const CANONICAL_SECTION_ORDER = [
  'system_prompt',
  'task_instructions',
  'workspace_context',
  'memory',
  'tool_schemas',
  'page_context',
  'conversation_history',
  'user_input',
] as const;

export type CanonicalSectionOrderType = (typeof CANONICAL_SECTION_ORDER)[number];

export function getSourcePriority(kind: PromptSectionKindType): number {
  const idx = CONTEXT_SOURCE_PRIORITY.indexOf(kind as unknown as ContextSourcePriorityType);
  return idx === -1 ? 999 : idx;
}
