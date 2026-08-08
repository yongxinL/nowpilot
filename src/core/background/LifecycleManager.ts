// src/core/background/LifecycleManager.ts — §5.3 Side Panel Opening (spec line
// 915): the action button must OPEN the side panel via the panel-behavior
// setter, applied on onInstalled AND onStartup (RESEARCH Pitfall 1 mitigation,
// lines 361-362 — this is the action-button → side panel path).
//
// Idempotent (safe to re-run on every SW startup — RESEARCH A6): the setter is
// idempotent by definition, re-invoking it is a no-op update. Failures log
// SIDEPANEL_BEHAVIOR and never throw (Golden Rule 9). Dependency-free core
// (Pitfall 4): no UI libs.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export const LifecycleManager = {
  register(): void {
    const ensurePanelBehavior = (): void => {
      void chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((err: unknown) => {
          debugLog(ERROR_CODES.SIDEPANEL_BEHAVIOR, 'side panel behavior update failed', {
            error: err instanceof Error ? err : undefined,
            module: 'LifecycleManager',
          });
        });
    };
    chrome.runtime.onInstalled.addListener(() => ensurePanelBehavior());
    chrome.runtime.onStartup.addListener(() => ensurePanelBehavior());
  },
};
