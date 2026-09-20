import { defineBackground } from 'wxt/utils/define-background';
import * as BackgroundRouter from '../src/core/messaging/BackgroundRouter';

export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    // eslint-disable-next-line no-console
    console.log('NowPilot Background Service Worker initialized');

    // Phase 1 background.ts registers exactly THREE things per D-13:
    //   (1) the BackgroundRouter typed wrapper — the single message entry
    //       symbol (internally calls MessageBus.init() + pre-registers the
    //       CONTENT_SCRIPT_READY / SPA_NAVIGATION advisory handlers);
    //   (2) chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    //   (3) the onboardingComplete flag init inside chrome.runtime.onInstalled.
    //
    // What this file does NOT yet register (later-phase TODOs):
    //   - Phase 2+:  WorkspaceStore.isPrimaryWriter() election (CAS + heartbeat).
    //   - Phase 2+:  LifecycleManager / KeepAliveManager (when streaming lands).
    //   - Phase 17:  ContextMenuHost.
    //   - Phase 17:  ServiceNow MCP permissions (scripting / declarativeNetRequest).
    //   - Phase N:   CORS proxy host handlers (PROXY_FETCH envelope).

    // (1) Single message entry symbol — synchronous, attaches the typed
    // chrome.runtime.onMessage listener before the first message on every SW
    // wake. Idempotent across re-entries (BackgroundRouter's module-level
    // `registered` flag + MessageBus's `initialized` flag).
    BackgroundRouter.register();

    // (2) Side panel click behavior — kept verbatim from the scaffold.
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      // side panel may not be available in all contexts
    });

    chrome.runtime.onStartup.addListener(() => {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });

    // (3) Onboarding flag init — kept verbatim from the scaffold.
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.storage.local.set({ onboardingComplete: false });
      } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.storage.local.set({ onboardingComplete: true });
      }
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
  },
});
