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
  scopes?: ('chat' | 'reading' | 'writing' | 'reply')[];
  hidden?: boolean;
  icon?: string;
  order?: number;
}

export class PromptManager {
  #templates = new Map<string, PromptTemplate>();

  constructor() {
    this.init().catch(() => {});
  }

  async init(): Promise<void> {
    await this.#loadPersisted();
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
    let changed = false;
    for (const tpl of builtinTemplates) {
      const id = tpl.id;
      const existing = this.#templates.get(id);
      if (!existing) {
        this.#templates.set(id, {
          ...tpl,
          isBuiltin: true,
          scopes: tpl.scopes ?? ['chat', 'reading', 'writing', 'reply'],
          hidden: tpl.hidden ?? false,
          icon: tpl.icon ?? 'fileText',
          order: tpl.order ?? 99,
        });
        changed = true;
      } else {
        const merged = {
          ...existing,
          isBuiltin: true,
          scopes: existing.scopes ?? tpl.scopes ?? ['chat', 'reading', 'writing', 'reply'],
          hidden: existing.hidden !== undefined ? existing.hidden : (tpl.hidden ?? false),
          icon: existing.icon ?? tpl.icon ?? 'fileText',
          order: existing.order ?? tpl.order ?? 99,
        };
        if (
          JSON.stringify(existing.scopes) !== JSON.stringify(merged.scopes) ||
          existing.hidden !== merged.hidden ||
          existing.icon !== merged.icon ||
          existing.order !== merged.order
        ) {
          this.#templates.set(id, merged);
          changed = true;
        }
      }
    }
    if (changed) {
      this.#persist().catch(() => {});
    }
  }
}

export const promptManager = new PromptManager();
