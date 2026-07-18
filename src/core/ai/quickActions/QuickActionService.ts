export interface QuickAction {
  label: string;
  promptText: string;
}

/**
 * QuickActionService — static hostname-to-action mapping (D-31).
 *
 * Provides deterministic, instant context-aware suggestions based on
 * the current page's hostname. No LLM calls, no async operations.
 */
export class QuickActionService {
  #hostnameMap: Map<string, QuickAction[]>;

  constructor() {
    this.#hostnameMap = new Map();
    this.#initMapping();
  }

  #initMapping(): void {
    this.#hostnameMap.set('servicenow.com', [
      { label: 'Summarize this case', promptText: 'Summarize this case' },
      { label: 'Draft a work note', promptText: 'Draft a work note' },
      { label: 'Check similar cases', promptText: 'Check similar cases' },
    ]);

    this.#hostnameMap.set('github.com', [
      { label: 'Explain this code', promptText: 'Explain this code' },
      { label: 'Write a script', promptText: 'Write a script to...' },
    ]);

    this.#hostnameMap.set('stackoverflow.com', [
      { label: 'Explain this error', promptText: 'Explain this error' },
      { label: 'Find alternative approach', promptText: 'Find an alternative approach' },
    ]);
  }

  getActions(hostname?: string): QuickAction[] {
    if (!hostname) {
      return this.#getFallback();
    }

    // Match hostname against patterns using includes()
    for (const [pattern, actions] of this.#hostnameMap.entries()) {
      if (hostname.includes(pattern)) {
        return actions;
      }
    }

    // Check docs patterns
    if (hostname.startsWith('docs.') || hostname.includes('documentation')) {
      return [
        { label: 'Summarize this article', promptText: 'Summarize this article' },
        { label: 'Find related docs', promptText: 'Find related documentation' },
      ];
    }

    return this.#getFallback();
  }

  #getFallback(): QuickAction[] {
    return [
      { label: 'Summarize this page', promptText: 'Summarize this page' },
      { label: 'Extract key points', promptText: 'Extract the key points from this page' },
    ];
  }
}

export const quickActionService = new QuickActionService();
