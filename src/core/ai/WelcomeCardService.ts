import { debugLog } from '../utils/debugLog';
import { useWorkspaceStore } from '../stores/workspaceStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface WelcomeCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  templateId: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Static curated capability cards — the 6 capabilities (D-15 / UI-SPEC)
// ---------------------------------------------------------------------------
interface CardDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  templateId: string;
}

const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: 'summarize_page',
    title: 'Summarize This Page',
    description: 'Extract key points from the current page',
    icon: 'FileTextOutlined',
    category: 'Research',
    templateId: 'summarize_page',
  },
  {
    id: 'research_topic',
    title: 'Research a Topic',
    description: 'Search and synthesize information',
    icon: 'GlobalOutlined',
    category: 'Research',
    templateId: 'research',
  },
  {
    id: 'draft_response',
    title: 'Draft a Response',
    description: 'Write a professional reply or update',
    icon: 'FormOutlined',
    category: 'Writing',
    templateId: 'draft',
  },
  {
    id: 'explain_code',
    title: 'Explain Code or Errors',
    description: 'Understand code snippets and error messages',
    icon: 'CodeOutlined',
    category: 'Coding',
    templateId: 'explain',
  },
  {
    id: 'write_script',
    title: 'Write a Script',
    description: 'Generate code for automation or analysis',
    icon: 'CodeOutlined',
    category: 'Coding',
    templateId: 'write_script',
  },
  {
    id: 'analyze_data',
    title: 'Analyze Data',
    description: 'Extract insights from structured data',
    icon: 'FileTextOutlined',
    category: 'Analysis',
    templateId: 'analyze',
  },
];

/** chrome.storage.local key for usage counts per card. */
const USAGE_KEY = 'np_welcome_card_usage';

/**
 * Hostname-based contextual boost mapping (D-22).
 * Key: hostname substring to match, value: card ID → boost amount.
 */
const HOSTNAME_BOOSTS: Record<string, Record<string, number>> = {
  'servicenow.com': { summarize_page: 50, research_topic: 30 },
  'github.com': { explain_code: 50, write_script: 30 },
};

// ---------------------------------------------------------------------------
// WelcomeCardService class + singleton
// ---------------------------------------------------------------------------
export class WelcomeCardService {
  /**
   * Return the 6 curated capability cards sorted by three-tier scoring:
   *   1. Usage history (stored in chrome.storage.local)
   *   2. Hostname-based contextual boost
   *   3. Default curated order (base score)
   */
  async getCards(): Promise<WelcomeCard[]> {
    try {
      const usageScores = await this.#getUsageScores();
      const hostname = useWorkspaceStore.getState().currentPageContext?.hostname;
      const hostnameBoosts = hostname ? this.#getHostnameBoost(hostname) : {};

      const cards: WelcomeCard[] = CARD_DEFINITIONS.map((card, index) => {
        const defaultScore = 100 - index;
        const usageScore = usageScores[card.id] ?? 0;
        const hostnameBoost = hostnameBoosts[card.id] ?? 0;

        return {
          ...card,
          score: usageScore + hostnameBoost + defaultScore,
        };
      });

      // Sort descending by score; ties broken by definition order (stable)
      cards.sort((a, b) => {
        const diff = b.score - a.score;
        if (diff !== 0) return diff;
        // Stable: lower definition index wins on tie
        const aIdx = CARD_DEFINITIONS.findIndex((c) => c.id === a.id);
        const bIdx = CARD_DEFINITIONS.findIndex((c) => c.id === b.id);
        return aIdx - bIdx;
      });

      return cards;
    } catch (err) {
      debugLog('error', '[WelcomeCardService] getCards failed', { error: err });
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Read per-card usage counts from chrome.storage.local.
   * Gracefully falls back to empty object on failure.
   */
  async #getUsageScores(): Promise<Record<string, number>> {
    try {
      const result = await chrome.storage.local.get(USAGE_KEY);
      return (result[USAGE_KEY] as Record<string, number>) ?? {};
    } catch (err) {
      debugLog('warn', '[WelcomeCardService] getUsageScores failed — using default scores', { error: err });
      return {};
    }
  }

  /**
   * Map a hostname to per-card boost values using substring matching
   * (e.g. "example.servicenow.com" matches "servicenow.com").
   * Returns an empty record for unknown/ unmatched hostnames.
   */
  #getHostnameBoost(hostname: string): Record<string, number> {
    for (const [pattern, boosts] of Object.entries(HOSTNAME_BOOSTS)) {
      if (hostname.includes(pattern)) {
        return boosts;
      }
    }
    return {};
  }
}

export const welcomeCardService = new WelcomeCardService();
