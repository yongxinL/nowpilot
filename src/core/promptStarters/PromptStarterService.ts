import { promptManager } from '../prompts/PromptManager';
import { usePromptStarterUsageStore } from './PromptStarterUsageStore';

const CATEGORY_MAP: Record<string, string> = {
  writing: 'Writing',
  analysis: 'Analysis',
  research: 'Research',
  coding: 'Coding',
  support: 'Support',
};

const NORMALIZED_CATEGORIES = ['Writing', 'Analysis', 'Research', 'Coding', 'Support'];

export class PromptStarterService {
  async getRecentTemplates(limit?: number) {
    const templates = await promptManager.getAllTemplates();
    const usageState = usePromptStarterUsageStore.getState();
    const sorted = [...templates].sort((a, b) => {
      const aUsage = usageState.usage[a.id]?.lastUsedAt ?? 0;
      const bUsage = usageState.usage[b.id]?.lastUsedAt ?? 0;
      return bUsage - aUsage;
    });
    return limit ? sorted.slice(0, limit) : sorted;
  }

  normalizeCategory(category: string): string {
    const normalized = category.trim().toLowerCase();
    return CATEGORY_MAP[normalized] ?? category;
  }

  getUsageStats(promptStarterId: string) {
    const usageState = usePromptStarterUsageStore.getState();
    return usageState.usage[promptStarterId] ?? null;
  }

  getNormalizedCategories(): string[] {
    return NORMALIZED_CATEGORIES;
  }
}

export const promptStarterService = new PromptStarterService();
