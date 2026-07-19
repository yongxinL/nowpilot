import { promptManager } from '../../prompts/PromptManager';
import type { ReferenceToken } from '../ReferenceToken';
import type { AutocompleteResult, ReferenceResolver } from '../ReferenceResolver';

export class PromptResolver implements ReferenceResolver {
  getType(): string {
    return 'prompt';
  }

  async search(query: string): Promise<AutocompleteResult[]> {
    const templates = await promptManager.getAllTemplates();
    const lower = query.toLowerCase();
    const filtered = templates.filter(
      (t) => t.name.toLowerCase().includes(lower) || t.description?.toLowerCase().includes(lower),
    );
    return filtered.slice(0, 10).map((tpl) => ({
      token: {
        type: 'prompt',
        id: tpl.id,
        title: tpl.name,
        displayLabel: `@prompt:${tpl.name}`,
      },
      icon: 'MessageOutlined',
      color: 'colorSuccess',
      subtitle: tpl.category,
    }));
  }

  async validate(token: ReferenceToken): Promise<{ valid: boolean; reason?: string }> {
    const tpl = await promptManager.getTemplate(token.id);
    if (!tpl) return { valid: false, reason: 'Prompt template not found' };
    return { valid: true };
  }

  async resolve(token: ReferenceToken): Promise<{ title: string; content: string } | null> {
    const tpl = await promptManager.getTemplate(token.id);
    if (!tpl) return null;
    return { title: tpl.name, content: tpl.template };
  }
}

export const promptResolver = new PromptResolver();
