import { useMemo, useState } from 'react';
import { Button, Flex, theme } from 'antd';
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
  SettingOutlined,
  ToolOutlined,
  LayoutOutlined,
  TranslationOutlined,
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
  { id: 'general', title: 'General', description: 'Accounts, AI access, appearance', icon: <SettingOutlined /> },
  { id: 'sidebar', title: 'Sidebar', description: 'Behaviors, scrolling, navigation', icon: <LayoutOutlined /> },
  { id: 'translate', title: 'Translate', description: 'Translation models, bilingual styles', icon: <TranslationOutlined /> },
  { id: 'prompts', title: 'Prompts', description: 'Reusable prompts', icon: <MessageOutlined /> },
  { id: 'slash', title: 'Commands', description: 'Custom slash commands', icon: <CodeOutlined /> },
  { id: 'mcp', title: 'Skills & MCP', description: 'Smart skills and MCP servers', icon: <ApiOutlined /> },
  { id: 'addons', title: 'Add-ons', description: 'Configure installed add-ons', icon: <ToolOutlined /> },
  { id: 'advanced', title: 'Advanced', description: 'Onboarding, memory, logs', icon: <DashboardOutlined /> },
];

export interface OptionsRootProps {
  initialSection?: string;
  onSelectSection?: (id: string) => void;
  renderSectionContent?: (sectionId: string) => React.ReactNode;
}

export function OptionsRoot({
  initialSection = 'general',
  onSelectSection,
  renderSectionContent,
}: OptionsRootProps) {
  const { token } = theme.useToken();
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredSections = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return OPTIONS_SECTIONS;
    return OPTIONS_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query)),
    );
  }, [searchQuery]);

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

        <div style={{ marginBottom: 4 }}>
          <input
            type="search"
            aria-label="Search settings"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${token.colorBorder}`,
              background: token.colorBgContainer,
              color: token.colorText,
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        <Flex
          vertical
          role="list"
          aria-label="Options navigation"
          style={{ gap: 4, overflowY: 'auto', flex: 1, minHeight: 0 }}
        >
          {filteredSections.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                role="listitem"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelect(section.id)}
                data-options-nav-item={section.id}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  borderRadius: 8,
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: isActive ? token.colorFillSecondary : 'transparent',
                  color: isActive ? token.colorPrimary : token.colorText,
                  transition: 'background 0.2s, color 0.2s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = token.colorFillTertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span aria-hidden style={{ width: 20, display: 'inline-flex', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {section.icon}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, lineHeight: '20px' }}>{section.title}</span>
                  {section.description ? (
                    <span style={{ fontSize: 11, lineHeight: '16px', color: token.colorTextSecondary }}>{section.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
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
