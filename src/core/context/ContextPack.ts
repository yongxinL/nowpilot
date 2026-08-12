// src/core/context/ContextPack.ts — Wave-2 (04-02) §1.3 canonical section
// packing, migrated from contextHelper.buildOptimizedContext's section
// assembly (D-04-08, src/core/ai/contextHelper.ts L48-108 — Phase-4 deletion
// target). ContextOptimizer (04-04) consumes this; the SAME estimateTokens
// counter the optimizer uses for manifests keeps pack tokens and manifest
// tokens non-divergent (TokenBudget, 04-01).
//
// Section order is the §1.3 canonical sequence verbatim:
//   [SYSTEM] [TOOL SCHEMAS] [PREFERENCES] [MEMORY] [CONTEXT] [TASK] [USER INPUT]
// with stability flags mirroring ProviderRouter's CACHED_KINDS/TASK_KINDS
// exactly — a wrong flag kills anthropic prompt caching (F-5 / P4-8 / T-04-09):
// system/tool_schemas/preferences/memory = stable:true (cache-eligible);
// context/task/user_input = stable:false (per-turn).
//
// Byte-stable [SYSTEM] invariant: the system section text IS the persona
// block, emitted verbatim — identical input yields byte-identical output
// (the drop-in-identity regression 04-04 re-pins). tool_schemas text is a
// deterministic fixed-field-order join (name: description, newline-joined,
// mirroring contextHelper.buildToolSchemasText) and is omitted when empty.
// Preferences/memory/context/task are optional text inputs, emitted only when
// non-empty. Counting is READ-ONLY (estimateTokens of each section's own
// text) — this module never rewrites section text (no slice/substring).
//
// Returns PromptSection[] (F-4) — never a joined string.
import { estimateTokens } from './TokenBudget';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';
import type { PromptSection } from '@/core/ai/types';

/** §1.3 inputs the hook/optimizer supply. All optional except personaBlock + userInput in P4. */
export interface ContextPackInput {
  /** Byte-stable block from PersonaInjector.buildPersonaBlock (D-10 seam). */
  personaBlock: string;
  userInput: string;
  toolSchemaRefs?: readonly ToolSchemaRef[];
  preferencesText?: string;
  memoryText?: string;
  contextText?: string;
  taskText?: string;
}

/** Deterministic tool-schemas text (fixed field order — Pitfall 5); mirrors contextHelper. */
function buildToolSchemasText(refs: readonly ToolSchemaRef[]): string {
  return refs.map((t) => `${t.name}: ${t.description}`).join('\n');
}

/**
 * Pack the §1.3 inputs into PromptSection[] in canonical order. Pure +
 * deterministic: two calls with identical input deep-equal. Optional text
 * inputs emit a section only when non-empty; tool_schemas is omitted when no
 * refs are supplied. Token counts always come from estimateTokens — never
 * hand-authored. Returns sections only (the optimizer stamps the manifest).
 */
export function packSections(input: ContextPackInput): PromptSection[] {
  const sections: PromptSection[] = [
    {
      kind: 'system',
      text: input.personaBlock,
      tokens: estimateTokens(input.personaBlock),
      stable: true,
      sourceId: 'system',
    },
  ];

  if (input.toolSchemaRefs && input.toolSchemaRefs.length > 0) {
    const schemasText = buildToolSchemasText(input.toolSchemaRefs);
    sections.push({
      kind: 'tool_schemas',
      text: schemasText,
      tokens: estimateTokens(schemasText),
      stable: true,
      sourceId: 'tool-schemas',
    });
  }

  if (input.preferencesText && input.preferencesText.length > 0) {
    sections.push({
      kind: 'preferences',
      text: input.preferencesText,
      tokens: estimateTokens(input.preferencesText),
      stable: true,
      sourceId: 'preferences',
    });
  }

  if (input.memoryText && input.memoryText.length > 0) {
    sections.push({
      kind: 'memory',
      text: input.memoryText,
      tokens: estimateTokens(input.memoryText),
      stable: true,
      sourceId: 'memory',
    });
  }

  if (input.contextText && input.contextText.length > 0) {
    sections.push({
      kind: 'context',
      text: input.contextText,
      tokens: estimateTokens(input.contextText),
      stable: false,
      sourceId: 'context',
    });
  }

  if (input.taskText && input.taskText.length > 0) {
    sections.push({
      kind: 'task',
      text: input.taskText,
      tokens: estimateTokens(input.taskText),
      stable: false,
      sourceId: 'task',
    });
  }

  sections.push({
    kind: 'user_input',
    text: input.userInput,
    tokens: estimateTokens(input.userInput),
    stable: false,
    sourceId: 'user-input',
  });

  return sections;
}
