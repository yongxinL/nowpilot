import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { repairAndValidate } from '../../../../src/core/ai/pipeline/StructuredOutput';
import { PlannerDecision } from '../../../../src/core/ai/pipeline/pipelineTypes';

const TestSchema = z.object({ name: z.string(), age: z.number() });
const fallbackAnswer = { action: 'answer' as const, reasoning: 'Planner output was unparseable' };

describe('repairAndValidate', () => {
  it('returns result for valid JSON that matches schema', () => {
    const result = repairAndValidate('{"action":"answer","reasoning":"test"}', PlannerDecision, fallbackAnswer);
    expect(result).toHaveProperty('result');
    if ('result' in result) {
      expect(result.result.action).toBe('answer');
      expect(result.result.reasoning).toBe('test');
    }
  });

  it('repairs truncated JSON and returns valid result', () => {
    const result = repairAndValidate('{"action":"answer","reasoning":"test"', PlannerDecision, fallbackAnswer);
    expect(result).toHaveProperty('result');
    if ('result' in result) {
      expect(result.result.action).toBe('answer');
      expect(result.result.reasoning).toBe('test');
    }
  });

  it('returns fallback for completely unparseable input', () => {
    const result = repairAndValidate('garbage', PlannerDecision, fallbackAnswer);
    expect(result).toHaveProperty('fallback');
    if ('fallback' in result) {
      expect(result.fallback.reasoning).toBe('Planner output was unparseable');
    }
  });

  it('returns fallback when JSON is valid but fails schema validation', () => {
    const result = repairAndValidate('{"action":"invalid_action","reasoning":"test"}', PlannerDecision, fallbackAnswer);
    expect(result).toHaveProperty('fallback');
    if ('fallback' in result) {
      expect(result.fallback.reasoning).toBe('Planner output was unparseable');
    }
  });

  it('returns result for valid generic schema', () => {
    const result = repairAndValidate('{"name":"Alice","age":30}', TestSchema, { name: '', age: 0 });
    expect(result).toHaveProperty('result');
    if ('result' in result) {
      expect(result.result.name).toBe('Alice');
      expect(result.result.age).toBe(30);
    }
  });

  it('returns fallback when valid JSON fails generic schema validation', () => {
    const result = repairAndValidate('{"name":"Alice","age":"thirty"}', TestSchema, { name: '', age: 0 });
    expect(result).toHaveProperty('fallback');
    if ('fallback' in result) {
      expect(result.fallback.age).toBe(0);
    }
  });

  it('parses a wrapped tool_call shape ({"tool_call": {"name", "args"}})', () => {
    const result = repairAndValidate(
      '{"tool_call":{"name":"get-page-content","args":{}}}',
      PlannerDecision,
      fallbackAnswer,
    );
    expect(result).toHaveProperty('result');
    if ('result' in result) {
      expect(result.result.action).toBe('run_tool');
      expect(result.result.toolName).toBe('get-page-content');
      expect(result.result.toolInput).toEqual({});
    }
  });

  it('parses a wrapped function_call shape with "arguments" key', () => {
    const result = repairAndValidate(
      '{"function_call":{"name":"get_page_content","arguments":{"tabId":1}}}',
      PlannerDecision,
      fallbackAnswer,
    );
    expect(result).toHaveProperty('result');
    if ('result' in result) {
      expect(result.result.action).toBe('run_tool');
      expect(result.result.toolName).toBe('get-page-content');
      expect(result.result.toolInput).toEqual({ tabId: 1 });
    }
  });

  it('parses an OpenAI-native tool_calls array with stringified arguments', () => {
    const result = repairAndValidate(
      '{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_page_content","arguments":"{\\"tabId\\":1}"}}]}',
      PlannerDecision,
      fallbackAnswer,
    );
    expect(result).toHaveProperty('result');
    if ('result' in result) {
      expect(result.result.action).toBe('run_tool');
      expect(result.result.toolName).toBe('get-page-content');
      expect(result.result.toolInput).toEqual({ tabId: 1 });
    }
  });
});
