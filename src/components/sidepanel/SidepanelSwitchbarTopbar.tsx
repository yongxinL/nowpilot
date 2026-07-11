import { Tooltip, theme } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ExpandOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export interface SidepanelSwitchbarTopbarProps {
  density: 'expanded' | 'narrow';
  onCollapse: () => void;
  onOpenStandalone: () => void;
}

export function SidepanelSwitchbarTopbar({
  density,
  onCollapse,
  onOpenStandalone,
}: SidepanelSwitchbarTopbarProps) {
  const { token } = theme.useToken();
  const buttonStyle: CSSProperties = {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: token.borderRadius,
    backgroundColor: token.colorFillTertiary,
    color: token.colorTextSecondary,
    cursor: 'pointer',
    border: 'none',
    transition: `background-color ${token.motionDurationMid} ${token.motionEaseOut}`,
  };

  if (density === 'expanded') {
    return (
      <div
        role="toolbar"
        aria-label="Switchbar topbar"
        style={{ display: 'flex', gap: 6, padding: '4px 6px' }}
      >
        <Tooltip title="Collapse navbar">
          <button
            type="button"
            aria-label="Collapse navbar"
            onClick={onCollapse}
            style={buttonStyle}
            data-sidepanel-action="collapse"
          >
            <ArrowLeftOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Open Standalone">
          <button
            type="button"
            aria-label="Open Standalone"
            onClick={onOpenStandalone}
            style={buttonStyle}
            data-sidepanel-action="open-standalone"
          >
            <ExpandOutlined />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Switchbar topbar"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}
    >
      <Tooltip title="Collapse navbar" placement="left">
        <button
          type="button"
          aria-label="Collapse navbar"
          onClick={onCollapse}
          style={buttonStyle}
          data-sidepanel-action="collapse"
        >
          <ArrowLeftOutlined />
        </button>
      </Tooltip>
      <Tooltip title="Open Standalone" placement="left">
        <button
          type="button"
          aria-label="Open Standalone"
          onClick={onOpenStandalone}
          style={buttonStyle}
          data-sidepanel-action="open-standalone"
        >
          <ExpandOutlined />
        </button>
      </Tooltip>
    </div>
  );
}

export function SidepanelSwitchbarExpandIcon() {
  return <ArrowRightOutlined />;
}
