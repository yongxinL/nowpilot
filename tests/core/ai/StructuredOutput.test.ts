import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { repairJSON } from '../../../src/core/ai/StructuredOutput';
import { PipelineError } from '../../../src/core/ai/PipelineError';

const TestSchema = z.strictObject({
  action: z.literal('test'),
  value: z.string(),
});

describe('StructuredOutput', () => {
  describe('repairJSON', () => {
    it('returns parsed object for valid JSON', () => {
      const result = repairJSON('{"action": "test", "value": "hello"}', TestSchema);
      expect(result).toEqual({ action: 'test', value: 'hello' });
    });

    it('strips markdown code fences (```json ... ```)', () => {
      const result = repairJSON('```json\n{"action": "test", "value": "hello"}\n```', TestSchema);
      expect(result).toEqual({ action: 'test', value: 'hello' });
    });

    it('strips language-less code fences (``` ... ```)', () => {
      const result = repairJSON('```\n{"action": "test", "value": "hello"}\n```', TestSchema);
      expect(result).toEqual({ action: 'test', value: 'hello' });
    });

    it('fixes trailing commas before closing braces', () => {
      const result = repairJSON('{"action": "test", "value": "hello",}', TestSchema);
      expect(result).toEqual({ action: 'test', value: 'hello' });
    });

    it('completes truncated JSON with missing closing braces', () => {
      const result = repairJSON('{"action": "test", "value": "hello"', TestSchema);
      expect(result).toEqual({ action: 'test', value: 'hello' });
    });

    it('throws SCHEMA_INVALID when repaired JSON fails zod validation', () => {
      expect(() => repairJSON('{"action": "invalid", "value": "test"}', TestSchema)).toThrow(PipelineError);
    });

    it('throws SCHEMA_INVALID for empty input', () => {
      expect(() => repairJSON('', TestSchema)).toThrow(PipelineError);
    });

    it('extracts JSON embedded in prose', () => {
      const result = repairJSON('Here is the result: {"action": "test", "value": "hello"}', TestSchema);
      expect(result).toEqual({ action: 'test', value: 'hello' });
    });
  });
});
