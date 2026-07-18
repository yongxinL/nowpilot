import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock workspaceStore before importing the service (vi.hoisted pattern)
// ---------------------------------------------------------------------------
const mockGetState = vi.hoisted(() => vi.fn(() => ({ currentPageContext: null })));

vi.mock('../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(vi.fn(), { getState: mockGetState }),
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered (vi.mock is hoisted by vitest)
// ---------------------------------------------------------------------------
import { welcomeCardService, type WelcomeCard } from '../../../src/core/ai/WelcomeCardService';

describe('WelcomeCardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no hostname context, no usage data
    mockGetState.mockReturnValue({ currentPageContext: null });
    (chrome.storage.local.get as any).mockResolvedValue({});
  });

  // Test 1: getCards() returns 6 curated capability cards
  it('getCards() returns 6 cards with id, title, description, icon, category, templateId, score', async () => {
    const cards = await welcomeCardService.getCards();
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('title');
      expect(card).toHaveProperty('description');
      expect(card).toHaveProperty('icon');
      expect(card).toHaveProperty('category');
      expect(card).toHaveProperty('templateId');
      expect(card).toHaveProperty('score');
      expect(typeof card.score).toBe('number');
    }
  });

  // Test 2: Without usage history or hostname, cards are in default curated order
  it('returns cards in default curated order when no usage or hostname data exists', async () => {
    const cards = await welcomeCardService.getCards();
    expect(cards).toHaveLength(6);
    // Default order by base score (100 - index): summarize_page, research_topic, draft_response, explain_code, write_script, analyze_data
    expect(cards[0].id).toBe('summarize_page');
    expect(cards[1].id).toBe('research_topic');
    expect(cards[2].id).toBe('draft_response');
    expect(cards[3].id).toBe('explain_code');
    expect(cards[4].id).toBe('write_script');
    expect(cards[5].id).toBe('analyze_data');
    // Verify descending scores
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].score).toBeLessThanOrEqual(cards[i - 1].score);
    }
  });

  // Test 3: With hostname 'servicenow.com', Summarize This Page and Research a Topic are boosted
  it('boosts summarize_page and research_topic when hostname is servicenow.com', async () => {
    mockGetState.mockReturnValue({
      currentPageContext: { hostname: 'servicenow.com', url: 'https://example.servicenow.com' },
    });
    const cards = await welcomeCardService.getCards();
    // Both should be in top 2 (higher scores due to boost)
    expect(cards[0].id).toBe('summarize_page');
    expect(cards[1].id).toBe('research_topic');
    // Research topic should have significantly higher score than without boost
    expect(cards[1].score).toBeGreaterThan(100); // default max is 100
  });

  // Test 4: With hostname 'github.com', Explain Code or Errors and Write a Script are boosted
  it('boosts explain_code and write_script when hostname is github.com', async () => {
    mockGetState.mockReturnValue({
      currentPageContext: { hostname: 'github.com', url: 'https://github.com/some/repo' },
    });
    const cards = await welcomeCardService.getCards();
    // explain_code and write_script should rank above default-order cards
    expect(cards[0].id).toBe('explain_code');
    expect(cards[1].id).toBe('write_script');
    expect(cards[0].score).toBeGreaterThan(100);
    expect(cards[1].score).toBeGreaterThan(100);
  });

  // Test 5: Unknown hostname returns default order unchanged
  it('returns default order for unknown hostname', async () => {
    mockGetState.mockReturnValue({
      currentPageContext: { hostname: 'example.com', url: 'https://example.com/page' },
    });
    const cards = await welcomeCardService.getCards();
    expect(cards[0].id).toBe('summarize_page');
    expect(cards[1].id).toBe('research_topic');
    expect(cards[2].id).toBe('draft_response');
    expect(cards[3].id).toBe('explain_code');
    expect(cards[4].id).toBe('write_script');
    expect(cards[5].id).toBe('analyze_data');
  });

  // Test 6: When usage history exists, most-used cards rank higher
  it('ranks most-used cards higher when usage history exists', async () => {
    // Mock chrome.storage.local to return usage data
    (chrome.storage.local.get as any).mockImplementation((key: string) => {
      if (key === 'np_welcome_card_usage') {
        return Promise.resolve({
          np_welcome_card_usage: { summarize_page: 40, draft_response: 20 },
        });
      }
      return Promise.resolve({});
    });

    const cards = await welcomeCardService.getCards();
    // draft_response should rank 2nd (above research_topic which has no usage)
    expect(cards[0].id).toBe('summarize_page');
    expect(cards[1].id).toBe('draft_response');
    expect(cards[2].id).toBe('research_topic');
  });

  // Test 7: Scoring is deterministic — same inputs produce same card order
  it('produces deterministic order for the same inputs', async () => {
    mockGetState.mockReturnValue({
      currentPageContext: { hostname: 'github.com', url: 'https://github.com/test' },
    });
    (chrome.storage.local.get as any).mockImplementation((key: string) => {
      if (key === 'np_welcome_card_usage') {
        return Promise.resolve({
          np_welcome_card_usage: { explain_code: 30 },
        });
      }
      return Promise.resolve({});
    });

    const cards1 = await welcomeCardService.getCards();
    const cards2 = await welcomeCardService.getCards();

    expect(cards1.map((c) => c.id)).toEqual(cards2.map((c) => c.id));
    expect(cards1.map((c) => c.score)).toEqual(cards2.map((c) => c.score));
  });

  it('handles missing UserMemoryStore gracefully (returns cards with default scores)', async () => {
    // Simulate storage error
    (chrome.storage.local.get as any).mockRejectedValue(new Error('Storage unavailable'));
    const cards = await welcomeCardService.getCards();
    expect(cards).toHaveLength(6);
    // Should still return cards in default order
    expect(cards[0].id).toBe('summarize_page');
  });
});
