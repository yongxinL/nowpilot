import { useEffect, useState } from 'react';
import { Button, Tooltip, theme } from 'antd';
import { ArrowLeftOutlined, MenuFoldOutlined } from '@ant-design/icons';

export interface StandaloneSiderHeaderProps {
  density: 'expanded' | 'collapsed';
  onCollapseToggle: () => void;
  onSwitchToSidePanel: () => void;
}

export function StandaloneSiderHeader({
  density,
  onCollapseToggle,
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px',
        }}
        data-standalone-sider-header-density="collapsed"
      >
        <div
          aria-label="NowPilot logo"
          style={{
            width: 24,
            height: 24,
            borderRadius: token.borderRadius,
            background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          N
        </div>
      </div>
    );
  }

  return (
    <div
      role="banner"
      aria-label="Standalone sider header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingRight: 16,
        paddingLeft: 26,
      }}
      data-standalone-sider-header-density="expanded"
    >
      <div
        aria-label="NowPilot logo"
        style={{
          width: 24,
          height: 24,
          borderRadius: token.borderRadius,
          background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: 12,
          padding: '12px 0',
        }}
      >
        N
      </div>
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
        <Button
          type="text"
          size="small"
          aria-label="Switch to Side Panel"
          icon={<ArrowLeftOutlined />}
          onClick={onSwitchToSidePanel}
          data-standalone-action="switch-to-sidepanel"
        />
      </Tooltip>
      <Tooltip title="Collapse sider">
        <button
          type="button"
          aria-label="Collapse sider"
          onClick={onCollapseToggle}
          style={{
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            backgroundColor: token.colorFillTertiary,
            color: token.colorTextSecondary,
            cursor: 'pointer',
            border: 'none',
            flexShrink: 0,
          }}
          data-standalone-action="collapse"
        >
          <MenuFoldOutlined style={{ fontSize: 12 }} />
        </button>
      </Tooltip>
    </div>
  );
}
