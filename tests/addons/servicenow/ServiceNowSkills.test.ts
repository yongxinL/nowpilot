import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateTemplate } = vi.hoisted(() => ({
  mockCreateTemplate: vi.fn(),
}));

vi.mock('../../../src/core/prompts/PromptManager', () => ({
  promptManager: {
    createTemplate: mockCreateTemplate,
  },
}));

const { serviceNowSkillTemplates, registerServiceNowSkills } = await import(
  '../../../src/addons/servicenow/skills/serviceNowSkills'
);

describe('ServiceNow skill templates', () => {
  beforeEach(() => {
    mockCreateTemplate.mockClear();
  });

  it('serviceNowSkillTemplates has exactly 3 entries', () => {
    expect(serviceNowSkillTemplates).toHaveLength(3);
  });

  it('each template has required fields: id, name, description, template, category, variables, isBuiltin', () => {
    for (const tpl of serviceNowSkillTemplates) {
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

  it('all templates have category: "ServiceNow"', () => {
    for (const tpl of serviceNowSkillTemplates) {
      expect(tpl.category).toBe('ServiceNow');
    }
  });

  it('each template has scopes containing "servicenow"', () => {
    for (const tpl of serviceNowSkillTemplates) {
      expect(tpl.scopes).toContain('servicenow');
    }
  });

  it('template strings contain their variable placeholders', () => {
    for (const tpl of serviceNowSkillTemplates) {
      expect(tpl.template.length).toBeGreaterThan(0);
      for (const variable of tpl.variables) {
        expect(tpl.template).toContain(`{{${variable}}}`);
      }
    }
  });

  it('registerServiceNowSkills() calls promptManager.createTemplate() 3 times', async () => {
    await registerServiceNowSkills();
    expect(mockCreateTemplate).toHaveBeenCalledTimes(serviceNowSkillTemplates.length);
    for (const tpl of serviceNowSkillTemplates) {
      expect(mockCreateTemplate).toHaveBeenCalledWith(tpl);
    }
  });
});
