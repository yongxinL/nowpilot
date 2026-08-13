// src/components/pages/OptionsPage.tsx — §18 canonical page (W-6 flat name).
// Renders the UI-SPEC Account + Appearance card layout (E5/§17.1a): the
// Account card shows the provider empty state (UI-SPEC Copywriting Contract —
// verbatim 'No provider connected. Set up a provider to start.'; forward-compat
// for the providers phase); the Appearance card renders the displayMode
// selector (light/dark/auto, D-14) wired to useThemeStore().setMode (01-05)
// with the E5 theme-persistence error toast (STR.theme.saveFailed) when the
// store fails to adopt the mode. Phase 4b (04b-05, D-4b-07) appends the
// content-trust Card AFTER Appearance (UI-SPEC Visual Hierarchy): helper
// caption, four Switch rows in FIXED order Pages → Notes → Memory → Tool
// results bound to useTrustSettingsStore (np_trust write-through, auto-save),
// and the structural note — with the E5-style rollback toast
// (STR.options.trustSaveFailed) when a toggle write fails. Golden Rule 3: the
// card only PERSISTS a preference — runtime enforcement stays core-side at the
// TrustPolicy boundary (D-4b-08); no prompt assembly, no icons (UI-SPEC
// Invisible-by-contract). Wrapped in ErrorBoundary.
import { useEffect } from 'react';
import { App, Card, Divider, Empty, Segmented, Switch, Typography } from 'antd';
import { WorkspacePageSkeleton } from '@/components/pages/standalone/WorkspacePageSkeleton';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { useThemeStore } from '@/core/theme/ThemeStore';
import type { ThemeMode } from '@/core/theme/themePacks';
import { STR } from '@/core/i18n/strings';
import { useTrustSettingsStore } from '@/core/registry/TrustSettingsStore';
import type { TrustPrefs } from '@/core/preferences/trustConfig';

// UI-SPEC Copywriting Contract — Options empty state (verbatim; = STR.options.noProvider).
const NO_PROVIDER_COPY = 'No provider connected. Set up a provider to start.';

const MODE_OPTIONS: ThemeMode[] = ['light', 'dark', 'auto'];

// UI-SPEC Visual Hierarchy: the four Switch rows in FIXED source-type order
// (Pages → Notes → Memory → Tool results, D-4b-07 enumeration) — each kind maps
// to its np_trust key + verbatim STR label.
const TRUST_SOURCES: ReadonlyArray<{ kind: keyof TrustPrefs; label: string }> = [
  { kind: 'page', label: STR.options.trustSources.pages },
  { kind: 'notes', label: STR.options.trustSources.notes },
  { kind: 'memory', label: STR.options.trustSources.memory },
  { kind: 'tool_result', label: STR.options.trustSources.toolResults },
];

export function OptionsPage() {
  const mode = useThemeStore((s) => s.mode);
  const prefs = useTrustSettingsStore((s) => s.prefs);
  const { notification } = App.useApp();

  // UI-SPEC hydrating row: the store starts all-true (switches render
  // immediately) and init() hydrates from chrome.storage.local — the brief
  // true→persisted flip is the only transition, never a blank card.
  useEffect(() => {
    void useTrustSettingsStore.getState().init();
  }, []);

  const handleModeChange = async (next: ThemeMode): Promise<void> => {
    await useThemeStore.getState().setMode(next);
    // ThemeStore swallows write failures (THEME_WRITE log); surface the E5
    // persistence toast when the store did not adopt the requested mode.
    if (useThemeStore.getState().mode !== next) {
      notification.error({ message: STR.theme.saveFailed, duration: 0 });
    }
  };

  // E5 toast precedent: optimistic set + write-through; the store rolls the
  // optimistic set back on write failure, so comparing the store state against
  // the requested value detects the failure and surfaces the error toast
  // (UI-SPEC failure row — STR.options.trustSaveFailed).
  const handleTrustToggle = async (kind: keyof TrustPrefs, on: boolean): Promise<void> => {
    await useTrustSettingsStore.getState().setSource(kind, on);
    if (useTrustSettingsStore.getState().prefs[kind] !== on) {
      notification.error({ message: STR.options.trustSaveFailed, duration: 0 });
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
      <Card title={STR.options.contentTrust}>
        <Typography.Text type="secondary">{STR.options.trustHelper}</Typography.Text>
        <Divider style={{ margin: '12px 0' }} />
        {TRUST_SOURCES.map((row) => (
          <div
            key={row.kind}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Typography.Text>{row.label}</Typography.Text>
            <Switch
              checked={prefs[row.kind]}
              onChange={(on) => void handleTrustToggle(row.kind, on)}
            />
          </div>
        ))}
        <Typography.Text type="secondary">{STR.options.trustStructuralNote}</Typography.Text>
      </Card>
    </ErrorBoundary>
  );
}
