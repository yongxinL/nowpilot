import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PromptTemplate } from '../../../src/core/prompts/PromptManager';

const { mockCreateTemplate } = vi.hoisted(() => ({
  mockCreateTemplate: vi.fn(),
}));

vi.mock('../../../src/core/prompts/PromptManager', () => ({
  promptManager: {
    createTemplate: mockCreateTemplate,
  },
}));

const { writeSkillTemplates, registerWriteTemplates } = await import('../../../src/addons/write/skills/writeSkills');

describe('Write skill templates', () => {
  beforeEach(() => {
    mockCreateTemplate.mockClear();
  });

  it('writeSkillTemplates array has exactly 6 entries', () => {
    expect(writeSkillTemplates).toHaveLength(6);
  });

  it('each template has required fields: id, name, description, template, category, variables, isBuiltin', () => {
    for (const tpl of writeSkillTemplates) {
      expect(tpl).toHaveProperty('id');
      expect(typeof tpl.id).toBe('string');
      expect(tpl).toHaveProperty('name');
      expect(typeof tpl.name).toBe('string');
      expect(tpl).toHaveProperty('description');
      expect(typeof tpl.description).toBe('string');
      expect(tpl).toHaveProperty('template');
      expect(typeof tpl.template).toBe('string');
      expect(tpl).toHaveProperty('category');
      expect(typeof tpl.category).toBe('string');
      expect(tpl).toHaveProperty('variables');
      expect(Array.isArray(tpl.variables)).toBe(true);
      expect(tpl).toHaveProperty('isBuiltin');
      expect(tpl.isBuiltin).toBe(false);
    }
  });

  it('all templates have category: "Writing"', () => {
    for (const tpl of writeSkillTemplates) {
      expect(tpl.category).toBe('Writing');
    }
  });

  it('each template has at least one variable in variables array', () => {
    for (const tpl of writeSkillTemplates) {
      expect(tpl.variables.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('template strings are non-empty and contain variable placeholders', () => {
    for (const tpl of writeSkillTemplates) {
      expect(tpl.template.length).toBeGreaterThan(0);
      // Each template should contain its variable placeholders
      for (const variable of tpl.variables) {
        expect(tpl.template).toContain(`{{${variable}}}`);
      }
    }
  });

  it('registerWriteTemplates() calls promptManager.createTemplate() for each skill', async () => {
    await registerWriteTemplates();
    expect(mockCreateTemplate).toHaveBeenCalledTimes(writeSkillTemplates.length);
    // Verify each template was registered by id
    for (const tpl of writeSkillTemplates) {
      expect(mockCreateTemplate).toHaveBeenCalledWith(tpl);
    }
  });
});
