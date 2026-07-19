import { debugLog } from '../utils/debugLog';
import { promptManager } from './PromptManager';
import type { PromptTemplate } from './PromptManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CategorizedTemplates {
  category: string;
  templates: PromptTemplate[];
}

// ---------------------------------------------------------------------------
// TemplateBrowserService class + singleton
// ---------------------------------------------------------------------------
export class TemplateBrowserService {
  private recentTemplateIds: string[] = [];
  private readonly MAX_RECENT = 5;

  /**
   * Return all templates grouped by displayCategory, with recently-used
   * templates shown in a "Recently used" section first.
   */
  async getByCategory(): Promise<CategorizedTemplates[]> {
    const allTemplates = await promptManager.getAllTemplates();

    // Separate recent from rest
    const recentTemplateIds = [...this.recentTemplateIds];
    const recentMap = new Map<string, PromptTemplate>();
    const recentTemplates: PromptTemplate[] = [];

    for (const id of recentTemplateIds) {
      const tpl = allTemplates.find((t) => t.id === id);
      if (tpl) {
        recentTemplates.push(tpl);
        recentMap.set(id, tpl);
      }
    }

    // Group remaining templates by displayCategory
    const categoryMap = new Map<string, PromptTemplate[]>();
    for (const tpl of allTemplates) {
      // Skip if already in recent list
      if (recentMap.has(tpl.id)) continue;

      const category = (tpl as any).displayCategory || 'Other';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(tpl);
    }

    // Build result: recently-used section first, then sorted categories
    const result: CategorizedTemplates[] = [];

    if (recentTemplates.length > 0) {
      result.push({ category: 'Recently used', templates: recentTemplates });
    }

    for (const [category, templates] of categoryMap.entries()) {
      // Sort by order within each category
      templates.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      result.push({ category, templates });
    }

    return result;
  }

  /**
   * Case-insensitive fuzzy search across template name and description.
   */
  async search(query: string): Promise<PromptTemplate[]> {
    const lowerQuery = query.toLowerCase().trim();
    const allTemplates = await promptManager.getAllTemplates();

    if (!lowerQuery) {
      return allTemplates.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    }

    return allTemplates
      .filter((tpl) => {
        const name = tpl.name.toLowerCase();
        const desc = (tpl.description ?? '').toLowerCase();
        return name.includes(lowerQuery) || desc.includes(lowerQuery);
      })
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  /**
   * Track a template as recently used. Prepends to the list (LIFO),
   * trims to MAX_RECENT. In-memory only — not persisted.
   */
  trackRecentUse(templateId: string): void {
    // Remove existing entry to avoid duplicates
    this.recentTemplateIds = this.recentTemplateIds.filter((id) => id !== templateId);
    // Prepend
    this.recentTemplateIds.unshift(templateId);
    // Trim to max
    if (this.recentTemplateIds.length > this.MAX_RECENT) {
      this.recentTemplateIds = this.recentTemplateIds.slice(0, this.MAX_RECENT);
    }
    debugLog('info', `[TemplateBrowserService] tracked recent use: ${templateId}`);
  }

  /**
   * Return recently used templates resolved to full PromptTemplate objects
   * from promptManager, in LIFO order.
   */
  async getRecentlyUsed(): Promise<PromptTemplate[]> {
    const all = await promptManager.getAllTemplates();
    const result: PromptTemplate[] = [];
    for (const id of this.recentTemplateIds) {
      const tpl = all.find((t) => t.id === id);
      if (tpl) result.push(tpl);
    }
    return result;
  }
}

export const templateBrowserService = new TemplateBrowserService();
