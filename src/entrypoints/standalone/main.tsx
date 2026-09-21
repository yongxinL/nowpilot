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
import { CommandPalette } from '../../components/common/CommandPalette';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { useThemeStore, cycleThemeMode, persistThemeNow } from '../../core/theme/ThemeStore';
import { useThemeSync, showThemeSyncFailure } from '../../core/theme/ThemeSync';
import { getAntdConfig, resolveThemePack } from '../../core/theme/antdConfig';
import { registerStandaloneCommands } from '../../core/commands/registerWorkspaceCommands';
import { openOptions } from '../../core/workspace/WorkspaceRouter';
import '../../index.css';

const handleOpenOptions = () => {
  openOptions();
};

/**
 * Phase 1's validation port is the deterministic fixture adapter (D-05); Phase
 * 3 swaps this one argument for the real implementation.
 */
const onboardingValidationPort = createFixtureValidationPort('success');

const handleOpenSidepanel = async () => {
  try {
    const win = await chrome.windows.getCurrent();
    if (win?.id !== undefined) {
      await chrome.sidePanel.open({ windowId: win.id });
    }
  } catch {
    // side panel may not be available
  }
};

const StandaloneSurface: React.FC = () => {
  const { message: antMessage } = AntdApp.useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
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
    const cleanup = registerStandaloneCommands({
      focusSidePanel: handleOpenSidepanel,
      openOptions: handleOpenOptions,
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
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
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
