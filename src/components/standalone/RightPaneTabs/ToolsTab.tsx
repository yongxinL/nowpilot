import { useState, type CSSProperties } from 'react';
import { Badge, Collapse, Typography, theme } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useRightPaneStore } from '../../../core/stores/RightPaneStore';

const { Text } = Typography;

/**
 * ToolsTab — MCP tool status with expandable capability details (D-05, D-07)
 *
 * Displays connected/disconnected MCP tools with status badges.
 * Each tool can be expanded via Collapse to show capabilities and input schemas.
 * Empty state shown when no tools configured.
 * Uses antd theme.useToken() for consistent typography/spacing.
 */
export function ToolsTab() {
  const { token } = theme.useToken();
  const expandedToolId = useRightPaneStore((s) => s.expandedToolId);
  const setExpandedToolId = useRightPaneStore((s) => s.setExpandedToolId);

  const containerStyle: CSSProperties = {
    padding: `${token.paddingSM}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginSM,
  };

  const emptyStateStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginXS,
    padding: `${token.padding}px 0`,
  };

  // Mock: no tools configured (real MCP config integration happens later)
  const hasTools = false;

  if (!hasTools) {
    return (
      <div style={containerStyle}>
        <div style={emptyStateStyle}>
          <Text style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>
            No tools configured
          </Text>
          <Text style={{ color: token.colorTextSecondary }}>
            Connect MCP servers in Options to see tools here
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
        <ToolOutlined />
        <Text style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>
          Connected Tools
        </Text>
      </div>

      <Collapse
        items={[
          {
            key: 'sample',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge status="success" />
                <Text>Sample Tool</Text>
              </div>
            ),
            children: <Text style={{ color: token.colorTextSecondary }}>Tool capabilities and schemas</Text>,
          },
        ]}
        ghost
      />
    </div>
  );
}
