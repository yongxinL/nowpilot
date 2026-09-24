import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { SidePanelRouter } from '../../components/sidepanel/SidePanelRouter';
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
import { openStandalone, openOptions } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { startWorkspaceRuntime } from '../../core/workspace/workspaceRuntime';
import {
  HEARTBEAT_MS,
  createWriterElection,
  setActiveWriterElection,
  type WriterElection,
} from '../../core/workspace/WriterElection';
import { useExtensionStore } from '../../store/useExtensionStore';
import { registerSidepanelCommands } from '../../core/commands/registerWorkspaceCommands';
import { KeymapRegistry } from '../../core/input/KeymapRegistry';
import { t } from '../../core/i18n/strings';
import { debugLog } from '../../core/log/debugLog';
import '../../index.css';

const handleOpenOptions = () => {
  openOptions();
};

/**
 * Phase 1's validation port is the deterministic fixture adapter (D-05): it
 * performs no network request, and the flow discloses the fixture backing
 * through its marked `deferred.reasonFixture` notice. Phase 3 swaps this one
 * argument for the real implementation.
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
const SURFACE = 'sidepanel' as const;

/** The tab id the election falls back to when the platform cannot answer. */
const UNKNOWN_TAB_ID = -1;

/**
 * The tab this Side Panel is attached to. The panel is not itself a tab, so its
 * host is the active tab of the current window — the same query the Standalone
 * surface's "Focus Side Panel" path already issues.
 */
function resolveHostTabId(): Promise<number> {
  return new Promise((resolve) => {
    const tabs = chrome?.tabs;
    if (!tabs?.query) {
      resolve(UNKNOWN_TAB_ID);
      return;
    }
    tabs.query({ active: true, currentWindow: true }, (found) => {
      resolve(found[0]?.id ?? UNKNOWN_TAB_ID);
    });
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
      election = createSurfaceElection(await resolveHostTabId());
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

const SidePanelSurface: React.FC = () => {
  const { message: antMessage } = AntdApp.useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // 02-10: the phase's runtime — hydration, the writer election and its
  // heartbeat — runs once per surface mount and is torn down with it.
  usePhase2Startup();
  // WR-07 / D-13: the composer draft the handoff carries. The shell owns the
  // textarea state and reports every change here; the ref keeps the value out
  // of the render path and never persists it.
  const composerDraftRef = useRef('');
  // D-06: the completion record gates the flow; the dismissal flag only closes
  // this surface's presentation (nothing persisted).
  const onboardingGate = useOnboardingGate();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const handleOnboardingComplete = (selection: OnboardingCompletionSelection) => {
    setOnboardingDismissed(true);
    // Non-secret state only: the UI-complete flag, the persona and the
    // provider identifier. The credential never leaves the flow.
    void writeOnboardingState({
      uiComplete: true,
      persona: selection.persona,
      providerId: selection.providerId,
      validationBacking: 'fixture',
    });
  };

  const handleOnboardingSkip = () => {
    setOnboardingDismissed(true);
    // An explicit incomplete state: the flow re-presents on the next open.
    void writeOnboardingState({ uiComplete: false });
  };

  const openStandaloneWithToasts = () => {
    antMessage.loading({ content: 'Opening standalone view…', key: 'open-standalone', duration: 0 });

    const { workspaceId, conversationId } = useWorkspaceStore.getState();
    openStandalone(workspaceId, conversationId ?? undefined, undefined, {
      // The live composer draft rides the validated handoff projection: it is
      // never placed in the URL and never persisted (D-13 / hard rule 4).
      composerDraft: composerDraftRef.current,
      onSettled: (result) => {
        if (result.ok) {
          antMessage.destroy('open-standalone');
          return;
        }
        debugLog('SIDEPANEL_STANDALONE_OPEN_FAILED', result.error);
        antMessage.destroy('open-standalone');
        antMessage.error({
          content: t('standalone.openFailed'),
          key: 'open-standalone',
          duration: 4,
          onClick: () => openStandaloneWithToasts(),
        });
      },
    });
  };

  useEffect(() => {
    const cleanupCommands = registerSidepanelCommands({
      openStandalone: () => {
        openStandaloneWithToasts();
      },
      openOptions: () => {
        handleOpenOptions();
      },
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
      <SidePanelRouter
        onOpenStandalone={openStandaloneWithToasts}
        onOpenOptions={handleOpenOptions}
        onDraftChange={(draft) => {
          composerDraftRef.current = draft;
        }}
      />
      {/* The shared flow presents in the surface the user actually opened
          (D-06) — the Side Panel is never redirected, and no surface is opened
          automatically. */}
      {onboardingGate === 'present' && !onboardingDismissed && (
        <OnboardingFlow
          open
          surface="sidepanel"
          validationPort={onboardingValidationPort}
          readOnboardingState={readOnboardingState}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
          onSwitchToFullSetup={() => {
            setPaletteOpen(false);
            openStandaloneWithToasts();
          }}
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
 * The Side Panel's single provider chain (§5.5): exactly one `XProvider` fed
 * by `getAntdConfig`, then `AntdApp`, then the mounted `ErrorBoundary`, then
 * the shell. No second AntD provider is mounted anywhere in `src/entrypoints`
 * or `src/components` — a separate one would double-wrap theme and locale
 * context.
 */
const SidePanelRoot: React.FC = () => {
  const mode = useThemeStore((state) => state.mode);
  const pack = useThemeStore((state) => state.pack);

  useThemeSync();

  const config = getAntdConfig({ mode, pack: resolveThemePack(pack), compact: true });

  return (
    <XProvider {...config}>
      <AntdApp
        // 02-10: the pinned configuration Phase 1 declared but never applied.
        message={ANT_MESSAGE_CONFIG}
        notification={ANT_NOTIFICATION_CONFIG}
        style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
      >
        <ErrorBoundary>
          <SidePanelSurface />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidePanelRoot />);
}
