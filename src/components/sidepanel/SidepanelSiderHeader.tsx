import { Tooltip, theme } from 'antd';
import { ArrowLeftOutlined, ExpandOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export interface SwitchbarTopbarProps {
  density: 'expanded' | 'narrow';
  onCollapse: () => void;
  onOpenStandalone: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: 6,
  paddingTop: 4,
  paddingBottom: 8,
  paddingLeft: 0,
  paddingRight: 0,
  justifyContent: 'center',
  alignItems: 'center',
  flexShrink: 0,
};

const buttonBaseStyle: CSSProperties = {
  width: 14,
  height: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  cursor: 'pointer',
  border: 'none',
  fontSize: 10,
  flexShrink: 0,
};

export function SidepanelSiderHeader({
  density,
  onCollapse,
  onOpenStandalone,
}: SwitchbarTopbarProps) {
  const { token } = theme.useToken();

  const buttonStyle: CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: token.colorFillTertiary,
    color: token.colorTextSecondary,
  };

  const tooltipPlacement = density === 'expanded' ? 'top' : 'left';

  return (
    <div
      role="toolbar"
      aria-label="Switchbar topbar"
      data-switchbar-topbar="true"
      data-switchbar-topbar-density={density}
      style={containerStyle}
    >
      <Tooltip title="Collapse panel" placement={tooltipPlacement}>
        <button
          type="button"
          aria-label="Collapse panel"
          onClick={onCollapse}
          style={buttonStyle}
          data-sidepanel-action="collapse"
        >
          <ArrowLeftOutlined style={{ fontSize: 10 }} />
        </button>
      </Tooltip>
      <Tooltip title="Open Standalone" placement={tooltipPlacement}>
        <button
          type="button"
          aria-label="Open Standalone"
          onClick={onOpenStandalone}
          style={buttonStyle}
          data-sidepanel-action="open-standalone"
        >
          <ExpandOutlined style={{ fontSize: 10 }} />
        </button>
      </Tooltip>
    </div>
  );
}