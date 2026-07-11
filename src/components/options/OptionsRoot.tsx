import { useMemo, useState } from 'react';
import { Button, Flex, Input, theme } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DashboardOutlined,
  DownloadOutlined,
  FlagOutlined,
  HighlightOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  MessageOutlined,
  RobotOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { WorkspaceStatusBar } from '../common/WorkspaceStatusBar';

export interface OptionsSectionEntry {
  id: string;
  title: string;
  description?: string;
  group?: string;
  icon: React.ReactNode;
}

const OPTIONS_SECTIONS: OptionsSectionEntry[] = [
  { id: 'providers', title: 'Providers', description: 'Connect AI providers', icon: <KeyOutlined /> },
  { id: 'models', title: 'Models', description: 'Enable and configure models', icon: <AppstoreOutlined /> },
  { id: 'mcp', title: 'MCP Servers', description: 'Manage MCP servers', icon: <ApiOutlined /> },
  { id: 'prompts', title: 'Prompt Templates', description: 'Reusable prompts', icon: <MessageOutlined /> },
  { id: 'slash', title: 'Slash Commands', description: 'Custom slash commands', icon: <CodeOutlined /> },
  { id: 'memory', title: 'Memory', description: 'Atomic facts and preferences', icon: <InfoCircleOutlined /> },
  { id: 'appearance', title: 'Appearance', description: 'Themes and density', icon: <HighlightOutlined /> },
  { id: 'diagnostics', title: 'Diagnostics', description: 'Health and traces', icon: <DashboardOutlined /> },
  { id: 'import-export', title: 'Import / Export', description: 'Backup and restore', icon: <DownloadOutlined /> },
  { id: 'feature-flags', title: 'Feature Flags', description: 'Toggle experimental features', icon: <FlagOutlined /> },
  { id: 'addons', title: 'Add-on Settings', description: 'Configure installed add-ons', icon: <ToolOutlined /> },
  { id: 'about', title: 'About', description: 'Version and credits', icon: <InfoCircleOutlined /> },
];

export interface OptionsRootProps {
  initialSection?: string;
  onSelectSection?: (id: string) => void;
  renderSectionContent?: (sectionId: string) => React.ReactNode;
}

export function OptionsRoot({
  initialSection = 'providers',
  onSelectSection,
  renderSectionContent,
}: OptionsRootProps) {
  const { token } = theme.useToken();
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [query, setQuery] = useState<string>('');

  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPTIONS_SECTIONS;
    return OPTIONS_SECTIONS.filter((s) =>
      `${s.title} ${s.description ?? ''} ${s.id}`.toLowerCase().includes(q),
    );
  }, [query]);

  const activeEntry = OPTIONS_SECTIONS.find((s) => s.id === activeSection) ?? OPTIONS_SECTIONS[0];
  const content = renderSectionContent ? renderSectionContent(activeSection) : (
    <div data-options-section={activeSection} style={{ padding: '8px 0' }}>
      <h2 style={{ marginTop: 0 }}>{activeEntry.title}</h2>
      {activeEntry.description ? (
        <p style={{ color: token.colorTextSecondary }}>{activeEntry.description}</p>
      ) : null}
    </div>
  );

  const handleSelect = (id: string) => {
    setActiveSection(id);
    onSelectSection?.(id);
    if (typeof window !== 'undefined' && window.location) {
      const hash = `#${id}`;
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash);
      }
    }
  };

  return (
    <div
      role="region"
      aria-label="Options"
      data-surface="options"
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        width: '100%',
      }}
    >
      <aside
        role="navigation"
        aria-label="Options sidebar"
        style={{
          width: 260,
          minWidth: 260,
          maxWidth: 280,
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <header data-options-header>
          <div style={{ fontSize: token.fontSizeLG, fontWeight: 700 }}>Settings</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            Manage providers, models, memory, and app behavior.
          </div>
        </header>
        <Input.Search
          aria-label="Search settings"
          placeholder="Search settings..."
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Flex
          vertical
          role="list"
          aria-label="Options navigation"
          style={{ gap: 4, overflowY: 'auto', flex: 1, minHeight: 0 }}
        >
          {visibleSections.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <Button
                key={section.id}
                role="listitem"
                type="text"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelect(section.id)}
                data-options-nav-item={section.id}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  height: 'auto',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: isActive ? token.colorFillSecondary : 'transparent',
                  color: isActive ? token.colorPrimary : token.colorText,
                }}
              >
                <span aria-hidden style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>
                  {section.icon}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{section.title}</span>
                  {section.description ? (
                    <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{section.description}</span>
                  ) : null}
                </span>
              </Button>
            );
          })}
          {visibleSections.length === 0 ? (
            <div
              data-options-empty
              style={{ padding: 16, textAlign: 'center', color: token.colorTextSecondary, fontSize: 12 }}
            >
              No matching sections.
            </div>
          ) : null}
        </Flex>
      </aside>

      <main
        role="main"
        aria-label="Options content"
        data-options-content={activeSection}
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          padding: '24px 32px',
          maxWidth: 1040,
          background: token.colorBgLayout,
        }}
      >
        {content}
      </main>
    </div>
  );
}

export function OptionsShellFooter() {
  return (
    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}>
      <WorkspaceStatusBar surface="standalone" />
    </div>
  );
}

export const optionsSections = OPTIONS_SECTIONS;
