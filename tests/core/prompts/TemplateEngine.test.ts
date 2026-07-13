import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../../../src/core/prompts/TemplateEngine';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  it('render replaces {{variable}} with values', () => {
    const result = engine.render('Hello {{name}}', { name: 'World' });
    expect(result).toBe('Hello World');
  });

  it('render retains unknown variables as literal {{key}}', () => {
    const result = engine.render('Hello {{name}}', {});
    expect(result).toBe('Hello {{name}}');
  });

  it('render replaces multiple distinct variables', () => {
    const result = engine.render('{{a}} and {{b}}', { a: 'X', b: 'Y' });
    expect(result).toBe('X and Y');
  });

  it('extractVariables returns unique variable names from template', () => {
    const vars = engine.extractVariables('{{a}} and {{b}} and {{a}}');
    expect(vars).toEqual(['a', 'b']);
  });

  it('extractVariables returns empty array for template with no variables', () => {
    const vars = engine.extractVariables('Hello World');
    expect(vars).toEqual([]);
  });

  it('validate returns valid true when all variables are available', () => {
    const result = engine.validate('Hello {{name}}', ['name']);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('validate returns valid false with missing variables', () => {
    const result = engine.validate('{{a}} and {{b}}', ['a']);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['b']);
  });
});
