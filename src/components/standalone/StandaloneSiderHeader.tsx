import { useEffect, useState } from 'react';
import { Tooltip, theme } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export interface StandaloneSiderHeaderProps {
  density: 'expanded' | 'collapsed';
  onCollapseToggle: () => void;
  onSwitchToSidePanel: () => void;
}

const collapsedLogoStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
};

const collapsedContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 8px 8px',
};

const expandedContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingRight: 16,
  paddingLeft: 24,
  paddingTop: 12,
  paddingBottom: 12,
};

const actionButtonStyle: CSSProperties = {
  width: 20,
  height: 20,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  cursor: 'pointer',
  border: 'none',
  flexShrink: 0,
};

export function StandaloneSiderHeader({
  density,
  onCollapseToggle: _onCollapseToggle,
  onSwitchToSidePanel,
}: StandaloneSiderHeaderProps) {
  const { token } = theme.useToken();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setIsMac(true);
    }
  }, []);

  if (density === 'collapsed') {
    return (
      <div
        role="banner"
        aria-label="Standalone sider header"
        style={collapsedContainerStyle}
        data-standalone-sider-header-density="collapsed"
      >
        <Tooltip title="NowPilot" placement="right">
          <div
            aria-label="NowPilot logo"
            style={{
              ...collapsedLogoStyle,
              background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
            }}
            data-standalone-logo="collapsed"
          >
            N
          </div>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      role="banner"
      aria-label="Standalone sider header"
      style={expandedContainerStyle}
      data-standalone-sider-header-density="expanded"
    >
      <Tooltip title="NowPilot" placement="right">
        <div
          aria-label="NowPilot logo"
          style={{
            ...collapsedLogoStyle,
            background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
          }}
          data-standalone-logo="expanded"
        >
          N
        </div>
      </Tooltip>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 14,
          fontWeight: 600,
          color: token.colorText,
        }}
      >
        NowPilot
      </span>
      <Tooltip title={`Switch to Side Panel (${isMac ? '⌘' : 'Ctrl'}+Shift+S)`}>
        <button
          type="button"
          aria-label="Switch to Side Panel"
          onClick={onSwitchToSidePanel}
          style={{
            ...actionButtonStyle,
            backgroundColor: 'transparent',
            color: token.colorTextSecondary,
          }}
          data-standalone-action="switch-to-sidepanel"
        >
          <ArrowLeftOutlined style={{ fontSize: 12 }} />
        </button>
      </Tooltip>
    </div>
  );
}