import { defineBackground } from 'wxt/utils/define-background';
import * as BackgroundRouter from '../core/messaging/BackgroundRouter';
import { deleteLegacyWorkspaceBlob } from '../core/workspace/legacyWorkspaceBlob';

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
    // Plus one removal-only step, not a registration (D-14): the stale
    // prototype workspace blob is deleted on every wake so Phase 2 does not
    // inherit a zombie key. It reads nothing back and writes nothing.
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

    // (1b) D-14: Phase 1 never persists WorkspaceState, and it deletes the
    // stale prototype blob on startup so Phase 2 does not inherit a zombie
    // key. Removal only — nothing is read back, restored or written here.
    void deleteLegacyWorkspaceBlob();

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
