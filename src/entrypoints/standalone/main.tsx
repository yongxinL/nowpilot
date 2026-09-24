import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { StandaloneShell } from '../../components/standalone/StandaloneShell';
import {
  OnboardingFlow,
  type OnboardingCompletionSelection,
} from '../../components/onboarding/OnboardingFlow';
import { createFixtureValidationPort } from '../../services/fixtures/providerValidationFixtures';
import {
  readOnboardingState,
  writeOnboardingState,
} from '../../core/onboarding/onboardingStateStore';
import { useOnboardingGate } from '../../core/onboarding/useOnboardingGate';
import { LegacyCredentialCleanupNotice } from '../../components/common/LegacyCredentialCleanupNotice';
import { Phase2Notices } from '../../components/common/Phase2Notices';
import { CommandPalette } from '../../components/common/CommandPalette';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { useThemeStore, cycleThemeMode, persistThemeNow } from '../../core/theme/ThemeStore';
import { useThemeSync, showThemeSyncFailure } from '../../core/theme/ThemeSync';
import { getAntdConfig, resolveThemePack } from '../../core/theme/antdConfig';
import { registerStandaloneCommands } from '../../core/commands/registerWorkspaceCommands';
import { KeymapRegistry } from '../../core/input/KeymapRegistry';
import { t } from '../../core/i18n/strings';
import { debugLog } from '../../core/log/debugLog';
import { openOptions } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { startWorkspaceRuntime } from '../../core/workspace/workspaceRuntime';
import {
  HEARTBEAT_MS,
  createWriterElection,
  setActiveWriterElection,
  type WriterElection,
} from '../../core/workspace/WriterElection';
import { useExtensionStore } from '../../store/useExtensionStore';
import '../../index.css';

const handleOpenOptions = () => {
  openOptions();
};

/**
 * Phase 1's validation port is the deterministic fixture adapter (D-05); Phase
 * 3 swaps this one argument for the real implementation.
 */
const onboardingValidationPort = createFixtureValidationPort('success');

/**
 * The pinned AntD imperative-API configuration (01-UI-SPEC § Toast /
 * notification configuration; wired by plan `02-10`).
 *
 * antd v6 exposes no `config` method on the `App.useApp()` instances, so the
 * pinned values are applied through the `App` config props — which configure
 * exactly those instances — instead of the forbidden static `message.*` /
 * `notification.*` imports. Module constants, not inline literals: a fresh
 * object on every render would rebuild the app-scoped API on every render.
 */
const ANT_MESSAGE_CONFIG = { maxCount: 3, duration: 5 };
const ANT_NOTIFICATION_CONFIG = { duration: 0 };

/** This surface's identity in the election record (§15.1). */
const SURFACE = 'standalone' as const;

/** The tab id the election falls back to when the platform cannot answer. */
const UNKNOWN_TAB_ID = -1;

/**
 * This document's own tab id: the Standalone view **is** a tab, so its identity
 * is the tab id the browser assigned it (the same call the focus-existing-tab
 * path above already issues).
 */
function resolveSelfTabId(): Promise<number> {
  return new Promise((resolve) => {
    const tabs = chrome?.tabs;
    if (!tabs?.getCurrent) {
      resolve(UNKNOWN_TAB_ID);
      return;
    }
    tabs.getCurrent((tab) => resolve(tab?.id ?? UNKNOWN_TAB_ID));
  });
}

/**
 * This surface's writer election, with every authoritative outcome published to
 * the writer projection.
 *
 * Both paths that elect — the `MirrorBanner` refocus action (through the
 * registry) and this surface's heartbeat — must reach `useWorkspaceStore`, or
 * the banner and the onboarding gate would never react to a promotion the
 * election actually granted (02-07's D6 carry-forward). `coordinationState()`
 * is the election's own canonical projection, so nothing here re-derives an
 * outcome.
 */
function createSurfaceElection(tabId: number): WriterElection {
  const election = createWriterElection({ surface: SURFACE, tabId });
  return {
    ...election,
    elect: async () => {
      const outcome = await election.elect();
      useWorkspaceStore.getState().applyElectionOutcome(election.coordinationState());
      return outcome;
    },
  };
}

/**
 * The D2-17 read path, the workspace runtime (durable hydrate + persistence),
 * the writer election and its heartbeat, once per mount.
 */
function usePhase2Startup(): void {
  useEffect(() => {
    let disposed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let election: WriterElection | null = null;

    const start = async (): Promise<void> => {
      // 1. Hydrate (02-08 runs the whole D2-17 order: initialise the database,
      //    recover the journal, run or resume the migration, read the
      //    conversations). The store's in-flight guard joins a double-invoked
      //    mount instead of starting a second read.
      await useExtensionStore.getState().hydrateChatHistory();
      if (disposed) return;

      // 2. Hydrate the durable workspace state and start the workspace runtime
      //    (CR-02): the persisted identity and write counter are
      //    installed before this surface elects, and every authorised mutation
      //    from here on persists through the journaled path behind the
      //    election gate.
      await startWorkspaceRuntime();
      if (disposed) return;

      // 3. Elect this surface's writer and register it, so a refocus request
      //    from the shell can reach it with no prop chain.
      election = createSurfaceElection(await resolveSelfTabId());
      if (disposed) {
        election.stop();
        election = null;
        return;
      }
      setActiveWriterElection(election);

      // 4. The first election, applied before the heartbeat starts. The
      //    transition to `primary` is also the runtime's identity-establishing
      //    write, so this surface's workspace copy becomes durable.
      await election.elect();
      if (disposed) return;

      // 5. The heartbeat is also the promotion path: a secondary keeps probing
      //    and promotes itself once the record goes stale. It runs at the
      //    election's own interval so both paths report through one projection.
      heartbeat = setInterval(() => {
        void election?.elect();
      }, HEARTBEAT_MS);
    };

    void start();

    return () => {
      disposed = true;
      if (heartbeat !== null) clearInterval(heartbeat);
      setActiveWriterElection(null);
      election?.stop();
    };
  }, []);
}

export type SidePanelOpenFailureCode =
  | 'SIDE_PANEL_UNAVAILABLE'
  | 'SIDE_PANEL_NO_ACTIVE_TAB'
  | 'SIDE_PANEL_OPEN_FAILED';

export interface SidePanelOpenFailure {
  code: SidePanelOpenFailureCode;
  error: string;
}

function reportSidePanelFailure(
  onFailure: (failure: SidePanelOpenFailure) => void,
  failure: SidePanelOpenFailure,
): void {
  debugLog(failure.code, failure.error);
  onFailure(failure);
}

/**
 * SA-10 / RESEARCH Pitfall 4 — `chrome.sidePanel.open()` is gesture-gated.
 *
 * The open call is issued as early as the gesture stack allows: the tab id
 * arrives through the `chrome.tabs.query` callback, so **no `await` sits
 * between the user gesture and `open()`**. The prototype awaited
 * `chrome.windows.getCurrent()` first, which loses the gesture and makes the
 * call fail intermittently with "may only be called in response to a user
 * action".
 *
 * Every failure path is typed, logged with a `SCREAMING_SNAKE` code and handed
 * to `onFailure` — an unavailable API or a rejected promise never surfaces as
 * an unhandled rejection.
 *
 * A green jsdom test proves the ordering only; the real gesture stack is
 * operator-observed Chrome evidence owned by the phase acceptance plan.
 */
export function openSidePanelForCurrentTab(
  onFailure: (failure: SidePanelOpenFailure) => void = () => {},
): void {
  const sidePanel = chrome.sidePanel;
  if (!sidePanel || typeof sidePanel.open !== 'function') {
    reportSidePanelFailure(onFailure, {
      code: 'SIDE_PANEL_UNAVAILABLE',
      error: 'chrome.sidePanel.open is not available',
    });
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId === undefined) {
      reportSidePanelFailure(onFailure, {
        code: 'SIDE_PANEL_NO_ACTIVE_TAB',
        error: 'No active tab in the current window',
      });
      return;
    }

    void Promise.resolve(sidePanel.open({ tabId })).catch((error: unknown) => {
      reportSidePanelFailure(onFailure, {
        code: 'SIDE_PANEL_OPEN_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

/**
 * D-09: on the Standalone surface, `Open Standalone view` resolves to the
 * idempotent focus-existing-tab path. This surface *is* the existing
 * Standalone view, so the command focuses this tab and its window rather than
 * starting a handoff that would re-point this very tab and then report a
 * false failure.
 */
const focusStandaloneSurface = (): void => {
  chrome.tabs.getCurrent((tab) => {
    if (chrome.runtime.lastError || !tab?.id) return;
    chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) {
      chrome.windows.update(tab.windowId, { focused: true });
    }
  });
};

const StandaloneSurface: React.FC = () => {
  const { message: antMessage } = AntdApp.useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // 02-10: the phase's runtime — hydration, the writer election and its
  // heartbeat — runs once per surface mount and is torn down with it.
  usePhase2Startup();
  // D-06: the Standalone surface presents the same flow when it is the surface
  // the user opened — it is never redirected to the Side Panel.
  const onboardingGate = useOnboardingGate();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const handleOnboardingComplete = (selection: OnboardingCompletionSelection) => {
    setOnboardingDismissed(true);
    void writeOnboardingState({
      uiComplete: true,
      persona: selection.persona,
      providerId: selection.providerId,
      validationBacking: 'fixture',
    });
  };

  const handleOnboardingSkip = () => {
    setOnboardingDismissed(true);
    void writeOnboardingState({ uiComplete: false });
  };

  useEffect(() => {
    const cleanupCommands = registerStandaloneCommands({
      focusSidePanel: () => {
        openSidePanelForCurrentTab(() => {
          antMessage.error({ content: t('sidepanel.openFailed'), duration: 4 });
        });
      },
      openStandalone: focusStandaloneSurface,
      openOptions: handleOpenOptions,
      toggleTheme: () => {
        cycleThemeMode();
        void persistThemeNow().then((result) => {
          if (!result.ok) showThemeSyncFailure(antMessage, persistThemeNow);
        });
      },
      reloadExtension: () => {
        chrome.runtime.reload();
      },
    });

    // FLOW-8: the palette binding is the registry's. This surface registers no
    // global keyboard listener of its own — `KeymapRegistry` owns the single
    // document `keydown` listener and toggles the palette on the chord.
    KeymapRegistry.register({
      id: 'open-command-palette',
      keys: 'Cmd+K',
      description: 'Open the command palette',
      handler: () => setPaletteOpen((isOpen) => !isOpen),
    });

    return () => {
      cleanupCommands();
      KeymapRegistry.unregister('open-command-palette');
    };
  }, []);

  return (
    <>
      {/* 02-10: the phase's three persistent failure notices (storage
          unavailable, migration failure, election failure). Headless — it
          renders no markup and issues through this surface's `App.useApp()`
          notification instance. */}
      <Phase2Notices />
      <StandaloneShell onOpenOptions={handleOpenOptions} />
      {/* Same flow, same state machine, same copy — presented on the larger
          canvas. The exit affordance is Skip, which returns to the shell. */}
      {onboardingGate === 'present' && !onboardingDismissed && (
        <OnboardingFlow
          open
          surface="standalone"
          validationPort={onboardingValidationPort}
          readOnboardingState={readOnboardingState}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
      {/* D-07: the single user-visible output of the legacy plaintext
          credential cleanup. It presents once (the shown-state lives on the
          onboarding record, not on a second key) and only after the gate has
          settled, so the onboarding flow and the notice never stack. */}
      {onboardingGate !== 'reading' &&
        !(onboardingGate === 'present' && !onboardingDismissed) && (
          <LegacyCredentialCleanupNotice />
        )}
      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
};

/**
 * The Standalone surface's single provider chain (§5.5): exactly one
 * `XProvider` fed by `getAntdConfig`, then `AntdApp`, then the mounted
 * `ErrorBoundary`, then the shell. Density is the default (not compact) and
 * is fixed per surface.
 */
const StandaloneRoot: React.FC = () => {
  const mode = useThemeStore((state) => state.mode);
  const pack = useThemeStore((state) => state.pack);

  useThemeSync();

  const config = getAntdConfig({ mode, pack: resolveThemePack(pack), compact: false });

  return (
    <XProvider {...config}>
      <AntdApp
        // 02-10: the pinned configuration Phase 1 declared but never applied.
        message={ANT_MESSAGE_CONFIG}
        notification={ANT_NOTIFICATION_CONFIG}
        style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
      >
        <ErrorBoundary>
          <StandaloneSurface />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<StandaloneRoot />);
}
