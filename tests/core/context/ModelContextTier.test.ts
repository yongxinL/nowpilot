import { describe, it, expect } from 'vitest';
import {
  classifyModelContext,
  CONTEXT_SOURCE_PRIORITY,
  CANONICAL_SECTION_ORDER,
  getSourcePriority,
} from '../../../src/core/context/ModelContextTier';

describe('classifyModelContext', () => {
  it('classifies 4096 as tiny (boundary)', () => {
    expect(classifyModelContext(4096)).toBe('tiny');
  });

  it('classifies 4097 as small', () => {
    expect(classifyModelContext(4097)).toBe('small');
  });

  it('classifies 16384 as small (boundary)', () => {
    expect(classifyModelContext(16384)).toBe('small');
  });

  it('classifies 16385 as medium', () => {
    expect(classifyModelContext(16385)).toBe('medium');
  });

  it('classifies 131072 as medium (boundary)', () => {
    expect(classifyModelContext(131072)).toBe('medium');
  });

  it('classifies 131073 as large', () => {
    expect(classifyModelContext(131073)).toBe('large');
  });

  it('classifies 200000 as large', () => {
    expect(classifyModelContext(200000)).toBe('large');
  });
});

describe('CONTEXT_SOURCE_PRIORITY', () => {
  it('has 9 elements in D-09 order', () => {
    expect(CONTEXT_SOURCE_PRIORITY).toHaveLength(9);
    expect(CONTEXT_SOURCE_PRIORITY[0]).toBe('system_prompt');
    expect(CONTEXT_SOURCE_PRIORITY[1]).toBe('user_input');
    expect(CONTEXT_SOURCE_PRIORITY[2]).toBe('tool_results');
    expect(CONTEXT_SOURCE_PRIORITY[3]).toBe('workspace_context');
    expect(CONTEXT_SOURCE_PRIORITY[4]).toBe('conversation_history');
    expect(CONTEXT_SOURCE_PRIORITY[5]).toBe('memory');
    expect(CONTEXT_SOURCE_PRIORITY[6]).toBe('page_context');
    expect(CONTEXT_SOURCE_PRIORITY[7]).toBe('notes_metadata');
    expect(CONTEXT_SOURCE_PRIORITY[8]).toBe('debug_data');
  });
});

describe('CANONICAL_SECTION_ORDER', () => {
  it('has 8 elements in D-14 order', () => {
    expect(CANONICAL_SECTION_ORDER).toHaveLength(8);
    expect(CANONICAL_SECTION_ORDER[0]).toBe('system_prompt');
    expect(CANONICAL_SECTION_ORDER[1]).toBe('task_instructions');
    expect(CANONICAL_SECTION_ORDER[2]).toBe('workspace_context');
    expect(CANONICAL_SECTION_ORDER[3]).toBe('memory');
    expect(CANONICAL_SECTION_ORDER[4]).toBe('tool_schemas');
    expect(CANONICAL_SECTION_ORDER[5]).toBe('page_context');
    expect(CANONICAL_SECTION_ORDER[6]).toBe('conversation_history');
    expect(CANONICAL_SECTION_ORDER[7]).toBe('user_input');
  });
});

describe('getSourcePriority', () => {
  it('returns 0 for system_prompt', () => {
    expect(getSourcePriority('system_prompt')).toBe(0);
  });

  it('returns 8 for debug_data', () => {
    expect(getSourcePriority('debug_data')).toBe(8);
  });

  it('returns 999 for unknown kind', () => {
    expect(getSourcePriority('preferences' as any)).toBe(999);
  });
});
