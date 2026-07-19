import type { PromptTemplate } from '../../../core/prompts/PromptManager';
import { promptManager } from '../../../core/prompts/PromptManager';

export const writeSkillTemplates: PromptTemplate[] = [
  {
    id: 'write-rewrite',
    name: 'Rewrite',
    description: 'Rewrite the given text in a different style',
    template: 'Rewrite the following text in a {{style}} style:\n\n{{content}}',
    category: 'Writing',
    variables: ['content', 'style'],
    isBuiltin: false,
    scopes: ['writing'],
    hidden: false,
  },
  {
    id: 'write-summarize',
    name: 'Summarize',
    description: 'Summarize the given content at a specified length',
    template: 'Summarize the following content in {{length}}:\n\n{{content}}',
    category: 'Writing',
    variables: ['content', 'length'],
    isBuiltin: false,
    scopes: ['writing'],
    hidden: false,
  },
  {
    id: 'write-customer-update',
    name: 'Draft Customer Update',
    description: 'Draft a customer-facing update for a case',
    template: 'Draft a customer update for case {{case}} with current status: {{status}}',
    category: 'Writing',
    variables: ['case', 'status'],
    isBuiltin: false,
    scopes: ['writing'],
    hidden: false,
  },
  {
    id: 'write-internal-note',
    name: 'Draft Internal Note',
    description: 'Draft an internal work note for a case',
    template: 'Draft an internal work note for case {{case}} based on findings: {{findings}}',
    category: 'Writing',
    variables: ['case', 'findings'],
    isBuiltin: false,
    scopes: ['writing'],
    hidden: false,
  },
  {
    id: 'write-explain',
    name: 'Explain',
    description: 'Explain the given content for a specific audience',
    template: 'Explain the following to a {{audience}} audience:\n\n{{content}}',
    category: 'Writing',
    variables: ['content', 'audience'],
    isBuiltin: false,
    scopes: ['writing'],
    hidden: false,
  },
  {
    id: 'write-action-plan',
    name: 'Action Plan',
    description: 'Create a step-by-step action plan to achieve a goal',
    template: 'Create a step-by-step action plan to achieve: {{goal}}. Constraints: {{constraints}}',
    category: 'Writing',
    variables: ['goal', 'constraints'],
    isBuiltin: false,
    scopes: ['writing'],
    hidden: false,
  },
];

export async function registerWriteTemplates(): Promise<void> {
  for (const template of writeSkillTemplates) {
    try {
      await promptManager.createTemplate(template);
    } catch {
      // Template already exists — skip silently (idempotent registration)
    }
  }
}
