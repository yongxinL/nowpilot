import { debugLog } from '../utils/debugLog';
import { builtinTemplates } from './builtinTemplates';

const PROMPT_TEMPLATES_KEY = 'np_prompt_templates';

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  category: string;
  variables: string[];
  isBuiltin: boolean;
}

export class PromptManager {
  #templates = new Map<string, PromptTemplate>();

  constructor() {
    this.#loadPersisted().catch(() => {});
    this.#registerBuiltins();
  }

  async createTemplate(template: PromptTemplate): Promise<void> {
    if (this.#templates.has(template.id)) {
      throw new Error(`Prompt template "${template.id}" already exists`);
    }
    this.#templates.set(template.id, template);
    await this.#persist();
  }

  async getTemplate(id: string): Promise<PromptTemplate | undefined> {
    return this.#templates.get(id);
  }

  async getAllTemplates(): Promise<PromptTemplate[]> {
    return Array.from(this.#templates.values());
  }

  async updateTemplate(template: PromptTemplate): Promise<void> {
    this.#templates.set(template.id, template);
    await this.#persist();
  }

  async deleteTemplate(id: string): Promise<void> {
    this.#templates.delete(id);
    await this.#persist();
  }

  async #loadPersisted(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(PROMPT_TEMPLATES_KEY);
      const persisted = (result[PROMPT_TEMPLATES_KEY] ?? []) as PromptTemplate[];
      for (const tpl of persisted) {
        this.#templates.set(tpl.id, tpl);
      }
    } catch (err) {
      debugLog('error', '[PromptManager] loadPersisted failed', { error: err });
    }
  }

  async #persist(): Promise<void> {
    try {
      const templates = Array.from(this.#templates.values());
      await chrome.storage.local.set({ [PROMPT_TEMPLATES_KEY]: templates });
    } catch (err) {
      debugLog('error', '[PromptManager] persist failed', { error: err });
    }
  }

  #registerBuiltins(): void {
    for (const tpl of builtinTemplates) {
      const id = tpl.id;
      if (!this.#templates.has(id)) {
        this.#templates.set(id, {
          ...tpl,
          isBuiltin: true,
        });
      }
    }
  }
}

export const promptManager = new PromptManager();
