// src/components/standalone/StandaloneShell.tsx — standalone extension-tab
// shell (standalone opens via update-or-create tab in 01-06 W-12 — no popup
// window dimensions apply). Header with STR.standalone.openTitle; content area
// renders the active §18 page (Chat/Agent/Notes/Options) resolved from
// StandalonePageRegistry (01-07) by the activePageId the router supplies
// ('chat' default). Cmd+K palette (Flow 10) is the global overlay. Wrapped in
// ErrorBoundary (01-04). No direct extension API calls (Pitfall 4/P5).
import { Layout, Typography } from 'antd';
import { CmdKPicker } from '@/components/cmdk/CmdKPicker';
import { AgentPage } from '@/components/pages/AgentPage';
import { ChatPage } from '@/components/pages/ChatPage';
import { NotesPage } from '@/components/pages/NotesPage';
import { OptionsPage } from '@/components/pages/OptionsPage';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { STR } from '@/core/i18n/strings';
import { getStandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import type { ComponentType } from 'react';

/** Lazy component-key resolution for PageRegistration.component (01-07 UI-free registries). */
const PAGE_COMPONENTS: Record<string, ComponentType> = {
  ChatPage,
  AgentPage,
  NotesPage,
  OptionsPage,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: 64,
  padding: '0 24px',
};

const contentStyle: React.CSSProperties = {
  padding: 24,
  overflowY: 'auto',
};

export interface StandaloneShellProps {
  /** StandalonePageRegistry id of the active page ('chat' default). */
  activePageId: string;
}

export function StandaloneShell({ activePageId }: StandaloneShellProps) {
  const registryEntry = getStandalonePageRegistry().get(activePageId);
  const ActivePage =
    (registryEntry !== undefined ? PAGE_COMPONENTS[registryEntry.component] : undefined) ??
    ChatPage;

  return (
    <ErrorBoundary>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Header style={headerStyle}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {STR.standalone.openTitle}
          </Typography.Title>
        </Layout.Header>
        <Layout.Content style={contentStyle}>
          <ActivePage />
        </Layout.Content>
        <CmdKPicker />
      </Layout>
    </ErrorBoundary>
  );
}
