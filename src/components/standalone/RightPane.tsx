import { type CSSProperties, useMemo } from 'react';
import { Tabs, theme } from 'antd';
import { ReadOutlined, FileTextOutlined, ToolOutlined } from '@ant-design/icons';
import { useRightPaneStore } from '../../core/stores/RightPaneStore';
import { ContextTab } from './RightPaneTabs/ContextTab';
import { NotesTab } from './RightPaneTabs/NotesTab';
import { ToolsTab } from './RightPaneTabs/ToolsTab';

/**
 * RightPane — Collapsible right side panel for the standalone layout (D-01 through D-08)
 *
 * Container with antd Tabs hosting three tab panels:
 * - Context: current page context + pinned tabs
 * - Notes: MiniSearch input + inline note preview
 * - Tools: MCP tool status with expandable details
 *
 * Width controlled by parent via the `width` prop (in pixels).
 * Active tab persisted via RightPaneStore.
 */
interface RightPaneProps {
  width: number;
}

export function RightPane({ width }: RightPaneProps) {
  const { token } = theme.useToken();
  const activeTab = useRightPaneStore((s) => s.activeTab);
  const setActiveTab = useRightPaneStore((s) => s.setActiveTab);

  const containerStyle: CSSProperties = useMemo(
    () => ({
      width,
      minWidth: width,
      display: 'flex',
      flexDirection: 'column',
      background: token.colorBgContainer,
      borderLeft: `1px solid ${token.colorBorderSecondary}`,
      overflow: 'hidden',
    }),
    [width, token],
  );

  const tabItems = [
    {
      key: 'context',
      label: 'Context',
      icon: <ReadOutlined />,
      children: <ContextTab />,
    },
    {
      key: 'notes',
      label: 'Notes',
      icon: <FileTextOutlined />,
      children: <NotesTab />,
    },
    {
      key: 'tools',
      label: 'Tools',
      icon: <ToolOutlined />,
      children: <ToolsTab />,
    },
  ];

  return (
    <div style={containerStyle}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'context' | 'notes' | 'tools')}
        items={tabItems}
        size="small"
        tabBarStyle={{
          paddingLeft: token.paddingSM,
          paddingRight: token.paddingSM,
          marginBottom: 0,
        }}
      />
    </div>
  );
}
