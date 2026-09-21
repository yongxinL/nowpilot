import { defineBackground } from 'wxt/utils/define-background';
import * as BackgroundRouter from '../core/messaging/BackgroundRouter';
import { deleteLegacyWorkspaceBlob } from '../core/workspace/legacyWorkspaceBlob';
import { migrateLegacyOnboardingFlag } from '../core/onboarding/onboardingStateStore';
import { runLegacyCredentialCleanup } from '../core/storage/legacyCredentialCleanup';

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
    //   (3) the install/startup migrations: the onboarding completion record
    //       migration (D-06) and the legacy plaintext credential cleanup (D-07).
    //       The cleanup is NOT a fourth registration — it runs inside the two
    //       handlers (3) already owns, and it runs FIRST so no later read in the
    //       same wake can observe the prototype's plaintext provider keys.
    //
    // Plus one removal-only step, not a registration (D-14): the stale
    // prototype workspace blob is deleted on every wake so Phase 2 does not
    // inherit a zombie key. It reads nothing back and writes nothing.
    //
    // No install or startup path opens a surface (D-06): nothing here creates
    // a tab or opens the panel. Opening the Side Panel or a Standalone tab
    // results only from an approved user action.
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
      // (3a) D-07: destroy the prototype's plaintext provider credentials in
      // place before anything reads the provider configuration. Idempotent and
      // version-stamped, so every wake is cheap; it reports a soft success when
      // no chrome storage is available and never throws.
      void runLegacyCredentialCleanup();
      // (3b) Absorb an installed prototype's onboarding flag on startup.
      void migrateLegacyOnboardingFlag();
    });

    // (3) Install/update migrations — the prototype seeded a bare legacy
    // boolean and plaintext provider keys; the canonical completion record
    // (D-06) and D-07's cleaned provider configuration are now the single
    // source, so install and update run only the idempotent migrations that
    // absorb the legacy value and destroy the legacy secrets in place.
    chrome.runtime.onInstalled.addListener(() => {
      void runLegacyCredentialCleanup();
      void migrateLegacyOnboardingFlag();
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    });
  },
});
