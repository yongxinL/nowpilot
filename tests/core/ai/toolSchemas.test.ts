// tests/core/ai/toolSchemas.test.ts — tool contract (03-03, D-04/D-05): exactly
// one safe built-in 'get-provider-info' (dangerous: no) ships; buildToolNameEnum
// returns NULL for an empty list (D-05 — z.enum([]) is rejected by Zod, so the
// PlannerDecisionSchema builder omits the run_tool branch) and a closed enum
// over the registered names otherwise; registeredToolNames extracts names in
// order. The closed enum is what ExecutorService (03-04) rejects unknown tools
// against (TOOL_REJECTED).
import { describe, expect, it } from 'vitest';

import {
  BUILTIN_TOOLS,
  GET_PROVIDER_INFO_TOOL,
  buildToolNameEnum,
  registeredToolNames,
} from '@/core/ai/toolSchemas';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';

describe('GET_PROVIDER_INFO_TOOL (D-04, §10.5 row 8)', () => {
  it('is the exactly-one safe built-in — dangerous: no', () => {
    expect(GET_PROVIDER_INFO_TOOL.name).toBe('get-provider-info');
    expect(GET_PROVIDER_INFO_TOOL.dangerous).toBe(false);
    expect(GET_PROVIDER_INFO_TOOL.source).toBe('builtin');
    expect(GET_PROVIDER_INFO_TOOL.description.length).toBeGreaterThan(0);
    expect(GET_PROVIDER_INFO_TOOL.jsonSchema).toBeDefined();
  });

  it('is the only built-in in the D-04 closed list', () => {
    expect(BUILTIN_TOOLS).toHaveLength(1);
    expect(BUILTIN_TOOLS[0]).toBe(GET_PROVIDER_INFO_TOOL);
  });

  it('no dangerous tool ships in Phase 3', () => {
    expect(BUILTIN_TOOLS.every((t) => !t.dangerous)).toBe(true);
  });
});

describe('registeredToolNames', () => {
  it('returns names in list order', () => {
    expect(registeredToolNames(BUILTIN_TOOLS)).toEqual(['get-provider-info']);
    expect(registeredToolNames([])).toEqual([]);
  });
});

describe('buildToolNameEnum (D-05)', () => {
  it('returns null for an EMPTY list — never z.enum([])', () => {
    expect(buildToolNameEnum([])).toBeNull();
  });

  it('builds a closed enum over the registered names', () => {
    const toolEnum = buildToolNameEnum(BUILTIN_TOOLS);
    expect(toolEnum).not.toBeNull();
    expect(toolEnum?.safeParse('get-provider-info').success).toBe(true);
  });

  it('rejects any tool outside the closed enum (Executor → TOOL_REJECTED path)', () => {
    const toolEnum = buildToolNameEnum(BUILTIN_TOOLS);
    expect(toolEnum?.safeParse('run-arbitrary-script').success).toBe(false);
    expect(toolEnum?.safeParse('get-provider-info').error).toBeUndefined();
  });

  it('reflects the registered list — a larger list widens the enum', () => {
    const extra: ToolSchemaRef = {
      name: 'search-notes',
      description: 'dummy',
      jsonSchema: {},
      dangerous: false,
      source: 'builtin',
    };
    const toolEnum = buildToolNameEnum([...BUILTIN_TOOLS, extra]);
    expect(toolEnum?.safeParse('search-notes').success).toBe(true);
  });
});
