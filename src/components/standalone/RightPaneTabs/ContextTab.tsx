import { type CSSProperties } from 'react';
import { Typography, theme } from 'antd';
import { PushpinOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../../../core/stores/workspaceStore';

const { Text } = Typography;

/**
 * ContextTab — Displays current page context and pinned tabs (D-05, D-07)
 *
 * Reads from workspaceStore selectors for currentPageContext and pinnedTabs.
 * Empty state shown when neither is available.
 * Uses antd theme.useToken() for consistent typography/spacing.
 */
export function ContextTab() {
  const { token } = theme.useToken();

  // Individual Zustand selectors prevent re-renders on unrelated state changes
  const currentPageContext = useWorkspaceStore((s) => s.currentPageContext);
  const pinnedTabs = useWorkspaceStore((s) => s.pinnedTabs);

  const containerStyle: CSSProperties = {
    padding: `${token.paddingSM}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginSM,
  };

  const cardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    background: token.colorFillTertiary,
    borderRadius: token.borderRadius,
  };

  const urlStyle: CSSProperties = {
    fontSize: token.fontSize,
    color: token.colorTextSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const headingStyle: CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: token.colorText,
    margin: 0,
  };

  // Empty state: no page context and no pinned tabs
  if (!currentPageContext && pinnedTabs.length === 0) {
    return (
      <div style={containerStyle}>
        <Text style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>
          No page context
        </Text>
        <Text style={{ color: token.colorTextSecondary }}>
          Pin a tab using the pin icon in the Side Panel to see context here
        </Text>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Current page context */}
      {currentPageContext && (
        <div>
          <Text style={headingStyle}>Current Page</Text>
          <div style={cardStyle}>
            <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorText }}>
              {currentPageContext.title || 'Untitled'}
            </Text>
            <Text style={urlStyle}>{currentPageContext.url}</Text>
          </div>
        </div>
      )}

      {/* Pinned tabs */}
      {pinnedTabs.length > 0 && (
        <div>
          <Text style={headingStyle}>
            <PushpinOutlined style={{ marginRight: 4 }} />
            Pinned Tabs
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pinnedTabs.map((tab) => (
              <div key={tab.tabId} style={cardStyle}>
                <Text style={{ fontSize: token.fontSize, fontWeight: 600, color: token.colorText }}>
                  {tab.title || `Tab ${tab.tabId}`}
                </Text>
                <Text style={urlStyle}>{tab.url}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
