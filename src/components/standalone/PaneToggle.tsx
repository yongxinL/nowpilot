import { type CSSProperties, useCallback } from 'react';
import { Button, theme } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useRightPaneStore } from '../../core/stores/RightPaneStore';

/**
 * PaneToggle — Vertical divider button cycling pane width states (D-03)
 *
 * Click cycle: compact (320px) → expanded (45%) → collapsed (hidden + tab strip)
 * Title attribute reflects current state for accessibility per UI-SPEC.
 * Uses MenuFoldOutlined / MenuUnfoldOutlined icons.
 */
export function PaneToggle() {
  const { token } = theme.useToken();
  const visible = useRightPaneStore((s) => s.visible);
  const width = useRightPaneStore((s) => s.width);
  const setVisible = useRightPaneStore((s) => s.setVisible);
  const toggleWidth = useRightPaneStore((s) => s.toggleWidth);

  const handleClick = useCallback(() => {
    if (!visible) {
      // Collapsed → compact: restore with compact width
      setVisible(true);
    } else if (width === 'compact') {
      // Compact → expanded
      toggleWidth();
    } else {
      // Expanded → collapsed
      setVisible(false);
    }
  }, [visible, width, setVisible, toggleWidth]);

  const isCollapsed = !visible;
  const title = isCollapsed ? 'Expand right pane' : 'Collapse right pane';

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    minWidth: 20,
    cursor: 'pointer',
    borderLeft: `1px solid ${token.colorBorderSecondary}`,
    userSelect: 'none' as const,
  };

  const buttonStyle: CSSProperties = {
    writingMode: 'vertical-lr' as any,
    padding: '4px 0',
    height: 'auto',
    fontSize: token.fontSize,
    color: token.colorTextSecondary,
  };

  // Collapsed state shows a narrow tab strip as re-expand affordance (D-02)
  return (
    <div style={containerStyle}>
      <Button
        type="text"
        icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={handleClick}
        title={title}
        aria-label={title}
        style={buttonStyle}
      />
    </div>
  );
}
