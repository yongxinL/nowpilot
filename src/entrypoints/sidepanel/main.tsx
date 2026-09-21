import React, { useEffect, useState } from 'react';
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
import { CommandPalette } from '../../components/common/CommandPalette';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { useThemeStore, cycleThemeMode, persistThemeNow } from '../../core/theme/ThemeStore';
import { useThemeSync, showThemeSyncFailure } from '../../core/theme/ThemeSync';
import { getAntdConfig, resolveThemePack } from '../../core/theme/antdConfig';
import { openStandalone, openOptions } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { registerSidepanelCommands } from '../../core/commands/registerWorkspaceCommands';
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

const SidePanelSurface: React.FC = () => {
  const { message: antMessage } = AntdApp.useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
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
      onSettled: (result) => {
        if (result.ok) {
          antMessage.destroy('open-standalone');
          return;
        }
        debugLog('SIDEPANEL_STANDALONE_OPEN_FAILED', result.error);
        antMessage.destroy('open-standalone');
        antMessage.error({
          content: "Couldn't open Standalone view",
          key: 'open-standalone',
          duration: 4,
          onClick: () => openStandaloneWithToasts(),
        });
      },
    });
  };

  useEffect(() => {
    const cleanup = registerSidepanelCommands({
      openStandalone: () => {
        openStandaloneWithToasts();
        setPaletteOpen(false);
      },
      openOptions: () => {
        handleOpenOptions();
        setPaletteOpen(false);
      },
      toggleTheme: () => {
        cycleThemeMode();
        void persistThemeNow().then((result) => {
          if (!result.ok) showThemeSyncFailure(antMessage, persistThemeNow);
        });
        setPaletteOpen(false);
      },
      reloadExtension: () => {
        chrome.runtime.reload();
      },
    });
    return cleanup;
  }, []);

  // FLOW-8: no global keyboard listener is registered here. The palette
  // binding moves to `KeymapRegistry` in plan `01-08`; until then the palette
  // is mounted by the surface and has no ad-hoc `window` listener.
  return (
    <>
      <SidePanelRouter
        onOpenStandalone={openStandaloneWithToasts}
        onOpenOptions={handleOpenOptions}
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
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
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
