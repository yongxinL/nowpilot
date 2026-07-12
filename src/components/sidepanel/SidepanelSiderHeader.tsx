import { Tooltip, theme } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, ExpandOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export interface SidepanelSiderHeaderProps {
  density: 'expanded' | 'narrow';
  onCollapse: () => void;
  onOpenStandalone: () => void;
}

const btnBase: CSSProperties = {
  width: 14,
  height: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 2,
  color: 'var(--ant-color-text-secondary, #666)',
  cursor: 'pointer',
  background: 'var(--ant-color-fill-tertiary, rgba(0,0,0,0.04))',
  border: 'none',
  fontSize: 10,
};

export function SidepanelSiderHeader({
  density,
  onCollapse,
  onOpenStandalone,
}: SidepanelSiderHeaderProps) {
  if (density === 'expanded') {
    return (
      <div
        role="toolbar"
        aria-label="Sidepanel sider header"
        style={{ display: 'flex', gap: 6 }}
      >
        <Tooltip title="Collapse panel">
          <button
            type="button"
            aria-label="Collapse panel"
            onClick={onCollapse}
            style={btnBase}
            data-sidepanel-action="collapse"
          >
            <ArrowLeftOutlined style={{ fontSize: 10 }} />
          </button>
        </Tooltip>
        <Tooltip title="Open Standalone">
          <button
            type="button"
            aria-label="Open Standalone"
            onClick={onOpenStandalone}
            style={btnBase}
            data-sidepanel-action="open-standalone"
          >
            <ExpandOutlined style={{ fontSize: 10 }} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Sidepanel sider header"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
    >
      <Tooltip title="Collapse panel" placement="left">
        <button
          type="button"
          aria-label="Collapse panel"
          onClick={onCollapse}
          style={btnBase}
          data-sidepanel-action="collapse"
        >
          <ArrowLeftOutlined style={{ fontSize: 10 }} />
        </button>
      </Tooltip>
      <Tooltip title="Open Standalone" placement="left">
        <button
          type="button"
          aria-label="Open Standalone"
          onClick={onOpenStandalone}
          style={btnBase}
          data-sidepanel-action="open-standalone"
        >
          <ExpandOutlined style={{ fontSize: 10 }} />
        </button>
      </Tooltip>
    </div>
  );
}
