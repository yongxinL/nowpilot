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
import { KeymapRegistry } from '../../core/input/KeymapRegistry';
import { t } from '../../core/i18n/strings';
import { debugLog } from '../../core/log/debugLog';
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
      focusSidePanel: handleOpenSidepanel,
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
