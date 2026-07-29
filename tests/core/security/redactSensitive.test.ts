import { describe, it, expect } from 'vitest';
import { redactSensitive } from '../../../src/core/security/redactSensitive';

describe('redactSensitive', () => {
  it('redacts sk- API key patterns', () => {
    const result = redactSensitive('sk-abc123def456');
    expect(result).not.toContain('sk-abc123def456');
    expect(result).toContain('REDACTED');
  });

  it('redacts api_key= patterns', () => {
    const result = redactSensitive('api_key=sk-abc123');
    expect(result).not.toContain('sk-abc123');
    expect(result).toContain('REDACTED');
  });

  it('redacts Bearer JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNqPnd9y3K8I4iA7iE1xGq3R5f6J';
    const result = redactSensitive(`Bearer ${jwt}`);
    expect(result).not.toContain(jwt);
    expect(result).toContain('REDACTED');
  });

  it('redacts Authorization: Bearer tokens', () => {
    const result = redactSensitive('Authorization: Bearer tok_abc123');
    expect(result).not.toContain('tok_abc123');
    expect(result).toContain('REDACTED');
  });

  it('preserves non-sensitive content unchanged', () => {
    const input = 'Hello world, this is a normal message';
    expect(redactSensitive(input)).toBe(input);
  });

  it('redacts URL query parameter keys', () => {
    const result = redactSensitive('https://api.example.com?key=sk-abc&other=value');
    expect(result).not.toContain('sk-abc');
    expect(result).toContain('REDACTED');
    expect(result).toContain('other=value');
  });

  it('handles empty string gracefully', () => {
    expect(redactSensitive('')).toBe('');
  });

  it('handles undefined gracefully', () => {
    expect(redactSensitive(undefined as unknown as string)).toBe('');
  });

  it('handles null gracefully', () => {
    expect(redactSensitive(null as unknown as string)).toBe('');
  });
});
