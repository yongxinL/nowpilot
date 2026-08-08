// src/components/pages/OptionsPage.tsx — §18 canonical page (W-6 flat name).
// Renders the UI-SPEC Account + Appearance card layout (E5/§17.1a): the
// Account card shows the provider empty state (UI-SPEC Copywriting Contract —
// verbatim 'No provider connected. Set up a provider to start.'; forward-compat
// for the providers phase); the Appearance card renders the displayMode
// selector (light/dark/auto, D-14) wired to useThemeStore().setMode (01-05)
// with the E5 theme-persistence error toast (STR.theme.saveFailed) when the
// store fails to adopt the mode. Wrapped in ErrorBoundary. No chrome API calls
// (Pitfall 4) — all persistence flows through the theme store.
import { App, Card, Empty, Segmented, Typography } from 'antd';
import { WorkspacePageSkeleton } from '@/components/pages/standalone/WorkspacePageSkeleton';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { useThemeStore } from '@/core/theme/ThemeStore';
import type { ThemeMode } from '@/core/theme/themePacks';
import { STR } from '@/core/i18n/strings';

// UI-SPEC Copywriting Contract — Options empty state (verbatim; = STR.options.noProvider).
const NO_PROVIDER_COPY = 'No provider connected. Set up a provider to start.';

const MODE_OPTIONS: ThemeMode[] = ['light', 'dark', 'auto'];

export function OptionsPage() {
  const mode = useThemeStore((s) => s.mode);
  const { notification } = App.useApp();

  const handleModeChange = async (next: ThemeMode): Promise<void> => {
    await useThemeStore.getState().setMode(next);
    // ThemeStore swallows write failures (THEME_WRITE log); surface the E5
    // persistence toast when the store did not adopt the requested mode.
    if (useThemeStore.getState().mode !== next) {
      notification.error({ message: STR.theme.saveFailed, duration: 0 });
    }
  };

  return (
    <ErrorBoundary>
      <Card title="Account">
        <WorkspacePageSkeleton />
        <Empty description={NO_PROVIDER_COPY}>
          <Typography.Text type="secondary">Providers arrive in the settings phase</Typography.Text>
        </Empty>
      </Card>
      <Card title="Appearance">
        <Segmented
          block
          options={MODE_OPTIONS}
          value={mode}
          onChange={(value) => void handleModeChange(value as ThemeMode)}
        />
        <Typography.Text type="secondary">Display mode</Typography.Text>
      </Card>
    </ErrorBoundary>
  );
}
