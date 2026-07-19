import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PromptTemplate } from '../../../src/core/prompts/PromptManager';

// ---------------------------------------------------------------------------
// Mock promptManager.getAllTemplates to return 21 builtin templates
// with and without displayCategory.
// ---------------------------------------------------------------------------
const makeMockTemplate = (id: string, name: string, description: string, category: string, order: number, displayCategory?: string): PromptTemplate => ({
  id,
  name,
  description: `${description}`,
  template: `${name} template content for {{userInput}}`,
  category,
  variables: ['userInput'],
  isBuiltin: true,
  scopes: ['chat', 'reading', 'writing'],
  hidden: false,
  icon: 'fileText',
  order,
  ...(displayCategory !== undefined ? { displayCategory } : {}),
});

const WRITING_TEMPLATES = [
  'improve-writing', 'continue-writing', 'fix-spelling-grammar', 'translate',
  'make-shorter', 'make-longer', 'simplify-language', 'change-tone', 'outline',
  'brainstorm', 'blog-post', 'paragraph-about', 'social-media-post', 'press-release',
  'creative-story', 'to-do-list', 'meeting-agenda', 'sales-email',
];

const ANALYSIS_TEMPLATES = ['summarize', 'testing'];
const RESEARCH_TEMPLATES = ['explain'];

function createMockTemplates(includeDisplayCategory: boolean): PromptTemplate[] {
  let order = 0;
  const templates: PromptTemplate[] = [];

  for (const id of WRITING_TEMPLATES) {
    order++;
    templates.push(makeMockTemplate(
      id, id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      `${id} description`,
      'builtin', order, includeDisplayCategory ? 'Writing' : undefined,
    ));
  }
  for (const id of ANALYSIS_TEMPLATES) {
    order++;
    templates.push(makeMockTemplate(
      id, id === 'summarize' ? 'Summarize' : 'Testing',
      id === 'summarize' ? 'Summarize content concisely' : 'Quick prompt testing',
      'builtin', order, includeDisplayCategory ? 'Analysis' : undefined,
    ));
  }
  for (const id of RESEARCH_TEMPLATES) {
    order++;
    templates.push(makeMockTemplate(
      id, 'Explain',
      'Explain this clearly',
      'builtin', order, includeDisplayCategory ? 'Research' : undefined,
    ));
  }
  return templates;
}

// Mock promptManager
const mockGetAllTemplates = vi.fn();
vi.mock('../../../src/core/prompts/PromptManager', () => ({
  promptManager: {
    getAllTemplates: mockGetAllTemplates,
    getTemplate: (id: string) => Promise.resolve(undefined),
  },
}));

// Import after mock
const { templateBrowserService } = await import('../../../src/core/prompts/TemplateBrowserService');

describe('TemplateBrowserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the service's internal state
    (templateBrowserService as any).recentTemplateIds = [];
  });

  describe('getByCategory', () => {
    it('returns templates grouped by displayCategory, sorted by order (Test 2)', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));
      const categories = await templateBrowserService.getByCategory();

      // Should have 3 categories: Writing, Analysis, Research
      expect(categories.length).toBeGreaterThanOrEqual(3);

      const writing = categories.find((c) => c.category === 'Writing');
      expect(writing).toBeDefined();
      expect(writing!.templates.length).toBe(18);

      const analysis = categories.find((c) => c.category === 'Analysis');
      expect(analysis).toBeDefined();
      expect(analysis!.templates.length).toBe(2);

      const research = categories.find((c) => c.category === 'Research');
      expect(research).toBeDefined();
      expect(research!.templates.length).toBe(1);
    });

    it('includes recently-used section first when recent templates exist (Test 5)', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));

      // Track a recent use
      templateBrowserService.trackRecentUse('summarize');
      templateBrowserService.trackRecentUse('improve-writing');

      const categories = await templateBrowserService.getByCategory();

      // First category should be "Recently used"
      expect(categories[0].category).toBe('Recently used');
      expect(categories[0].templates.length).toBe(2);
      expect(categories[0].templates[0].id).toBe('improve-writing'); // LIFO
      expect(categories[0].templates[1].id).toBe('summarize');
    });
  });

  describe('search', () => {
    it('returns matching templates by name/description (Test 3)', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));
      const results = await templateBrowserService.search('summarize');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((t) => t.id === 'summarize')).toBe(true);
    });

    it('is case-insensitive', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));
      const results = await templateBrowserService.search('SUMMARIZE');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for no matches', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));
      const results = await templateBrowserService.search('xyznonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('recent usage tracking', () => {
    it('trackRecentUse adds to recent list; getRecentlyUsed returns in LIFO order, max 5 (Test 4)', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));

      templateBrowserService.trackRecentUse('summarize');
      templateBrowserService.trackRecentUse('explain');
      templateBrowserService.trackRecentUse('testing');

      const recent = await templateBrowserService.getRecentlyUsed();
      expect(recent.length).toBe(3);
      // LIFO order
      expect(recent[0].id).toBe('testing');
      expect(recent[1].id).toBe('explain');
      expect(recent[2].id).toBe('summarize');
    });

    it('limits recent list to 5', async () => {
      mockGetAllTemplates.mockResolvedValue(createMockTemplates(true));

      templateBrowserService.trackRecentUse('testing');
      templateBrowserService.trackRecentUse('explain');
      templateBrowserService.trackRecentUse('summarize');
      templateBrowserService.trackRecentUse('brainstorm');
      templateBrowserService.trackRecentUse('blog-post');
      templateBrowserService.trackRecentUse('creative-story'); // 6th, should evict oldest

      const recent = await templateBrowserService.getRecentlyUsed();
      expect(recent.length).toBe(5);
      // First item should be the most recently added
      expect(recent[0].id).toBe('creative-story');
      // Oldest ('testing') should be evicted
      expect(recent.some((t) => t.id === 'testing')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Also test that builtinTemplates exports displayCategory for all 21 templates
// ---------------------------------------------------------------------------
describe('builtinTemplates displayCategory', () => {
  it('all 21 templates have displayCategory assigned (Test 1)', async () => {
    const { builtinTemplates } = await import('../../../src/core/prompts/builtinTemplates');

    expect(builtinTemplates.length).toBe(21);

    const validCategories = ['Writing', 'Analysis', 'Research', 'Coding', 'Support'];
    for (const tpl of builtinTemplates) {
      expect(tpl).toHaveProperty('displayCategory');
      expect(validCategories).toContain(tpl.displayCategory);
    }
  });
});
