// src/components/sidepanel/SidePanelShell.tsx — §17.1 chat-only side panel
// shell (compact layout per UI-SPEC): header (title + theme indicator),
// conversation area rendering the ChatPage (Task 3), and — when a provider is
// ACTIVE — NO shell footer at all: the composer lives INSIDE ChatPage
// (D-01: the Sender is ChatPage's, one composer per surface, no double
// composer). When NO provider is active the shell renders the Phase-1 disabled
// surface per D-07/D-21 (STR.chat.noProvider Alert + disabled Input footer) —
// the gate is ProviderRegistry.hasActiveProvider(), not an onboarding flag
// (W-10); PROVIDER_KEY_UNREADABLE-disabled providers collapse into the same
// gate (D-21). Theme comes from useThemeStore (01-05) display-only
// (ConfigProvider wiring happens at mount in 01-09); workspace activeSurface
// comes from useWorkspaceStore (01-06). Cmd+K palette (Flow 10) is the §17.1
// global overlay. Wrapped in ErrorBoundary (01-04). No direct extension API
// calls — all state flows through the stores (Pitfall 4/P5).
import { useSyncExternalStore } from 'react';
import { Alert, Input, Layout, Typography } from 'antd';
import { CmdKPicker } from '@/components/cmdk/CmdKPicker';
import { ChatPage } from '@/components/pages/ChatPage';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { STR } from '@/core/i18n/strings';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

export interface SidePanelShellProps {
  /** Controlled Cmd+K palette visibility (lifted at the 01-09 entrypoint). */
  pickerOpen?: boolean;
  /** Controlled Cmd+K palette visibility change callback. */
  onPickerOpenChange?: (open: boolean) => void;
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 52,
  padding: '0 16px',
};

const contentStyle: React.CSSProperties = {
  padding: 16,
  overflowY: 'auto',
};

const composerStyle: React.CSSProperties = {
  padding: 16,
};

export function SidePanelShell({ pickerOpen, onPickerOpenChange }: SidePanelShellProps = {}) {
  const mode = useThemeStore((s) => s.mode);
  const activeSurface = useWorkspaceStore((s) => s.workspace.activeSurface);
  // T-1-18: re-evaluate on registry change (no cached UI flag) — the D-07
  // gate flips the surface live when a provider is registered/unregistered.
  const hasProvider = useSyncExternalStore(
    (onChange) => getProviderRegistry().subscribe(onChange),
    () => getProviderRegistry().hasActiveProvider(),
  );

  return (
    <ErrorBoundary>
      <Layout style={{ height: '100vh' }}>
        <Layout.Header style={headerStyle}>
          <Typography.Text strong>NowPilot</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {mode} · {activeSurface}
          </Typography.Text>
        </Layout.Header>
        <Layout.Content style={contentStyle}>
          {hasProvider ? (
            <ChatPage />
          ) : (
            <Alert type="info" showIcon title={STR.chat.noProvider} />
          )}
        </Layout.Content>
        {/* D-01 single composer: the Sender lives INSIDE ChatPage — when a
            provider is active there is NO shell footer (no double composer);
            the Phase-1 disabled Input footer only renders unconfigured. */}
        {hasProvider ? null : (
          <Layout.Footer style={composerStyle}>
            <Input placeholder={STR.chat.askPlaceholder} disabled />
          </Layout.Footer>
        )}
        <CmdKPicker open={pickerOpen} onOpenChange={onPickerOpenChange} />
      </Layout>
    </ErrorBoundary>
  );
}
