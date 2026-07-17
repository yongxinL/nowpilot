/**
 * SPANavigationWatcher — SPA navigation detection via History API + title observer.
 *
 * Detects navigation events in Single Page Applications by monkey-patching
 * history.pushState/replaceState and listening for popstate/hashchange events
 * and <title> element mutations.
 *
 * ## Key invariants
 * - Saves original History API references BEFORE patching (Pitfall 4)
 * - Calls original method FIRST, then dispatches callback
 * - 300ms debounce on navigation events (D-24)
 * - cleanup() restores all original references
 * - No module-level side effects — patching happens in watch() only
 *
 * Pattern: event-driven utility with observer lifecycle (SidepanelRoot.tsx analog)
 */
import { debugLog } from '../utils/debugLog';

export type NavigationCallback = (url: string, title: string) => void;

export class SPANavigationWatcher {
  private callback: NavigationCallback | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300; // D-24
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;

  /**
   * Start watching for SPA navigation events.
   * Returns a cleanup function that restores all original references.
   */
  watch(callback: NavigationCallback): () => void {
    this.callback = callback;

    // Pitfall 4: Save references BEFORE patching
    this.origPushState = history.pushState.bind(history);
    this.origReplaceState = history.replaceState.bind(history);

    const self = this;

    // Monkey-patch pushState
    history.pushState = function (...args: any[]) {
      self.origPushState!.apply(history, args as any);
      self.onNavigationChange(location.href, document.title);
    };

    // Monkey-patch replaceState
    history.replaceState = function (...args: any[]) {
      self.origReplaceState!.apply(history, args as any);
      self.onNavigationChange(location.href, document.title);
    };

    // Popstate event
    const popstateHandler = () => {
      this.onNavigationChange(location.href, document.title);
    };
    window.addEventListener('popstate', popstateHandler);

    // Hashchange event
    const hashchangeHandler = () => {
      this.onNavigationChange(location.href, document.title);
    };
    window.addEventListener('hashchange', hashchangeHandler);

    // Title MutationObserver
    let titleObserver: MutationObserver | null = null;
    const titleEl = document.querySelector('title');
    if (titleEl) {
      titleObserver = new MutationObserver(() => {
        this.onNavigationChange(location.href, document.title);
      });
      titleObserver.observe(titleEl, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    // Return cleanup function
    return () => {
      this.callback = null;
      if (this.origPushState) history.pushState = this.origPushState;
      if (this.origReplaceState) history.replaceState = this.origReplaceState;
      window.removeEventListener('popstate', popstateHandler);
      window.removeEventListener('hashchange', hashchangeHandler);
      if (titleObserver) titleObserver.disconnect();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    };
  }

  /**
   * 300ms debounced navigation handler (D-24).
   */
  private onNavigationChange(url: string, title: string): void {
    if (!this.callback) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      debugLog('debug', '[SPANavigationWatcher] Navigation detected', { url });
      this.callback?.(url, title);
    }, this.DEBOUNCE_MS);
  }

  /**
   * Clean up all timers and references.
   */
  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.callback = null;
  }
}
