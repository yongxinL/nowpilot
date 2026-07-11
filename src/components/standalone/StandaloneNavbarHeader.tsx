import { useEffect, useState } from 'react';
import { Button, Flex, Tooltip, theme } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

export interface StandaloneNavbarHeaderProps {
  density: 'expanded' | 'collapsed';
  onCollapseToggle: () => void;
  onSwitchToSidePanel: () => void;
}

export function StandaloneNavbarHeader({
  density,
  onCollapseToggle,
  onSwitchToSidePanel,
}: StandaloneNavbarHeaderProps) {
  const { token } = theme.useToken();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setIsMac(true);
    }
  }, []);

  const iconBtn: CSSProperties = {
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
    marginLeft: 'auto',
  };

  if (density === 'collapsed') {
    return (
      <div
        role="banner"
        aria-label="Standalone navbar header"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 8,
        }}
        data-standalone-header-density="collapsed"
      >
        <Tooltip title="Expand navbar" placement="right">
          <Button
            type="text"
            size="small"
            aria-label="Expand navbar"
            icon={<MenuUnfoldOutlined />}
            onClick={onCollapseToggle}
            data-standalone-action="expand"
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      role="banner"
      aria-label="Standalone navbar header"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 12px',
        gap: 8,
        minHeight: 56,
      }}
      data-standalone-header-density="expanded"
    >
      <div
        aria-label="NowPilot logo"
        style={{
          width: 28,
          height: 28,
          borderRadius: token.borderRadius,
          background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorInfo})`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
        }}
      >
        N
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: token.colorText,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
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
      <Tooltip title="Collapse navbar">
        <button
          type="button"
          aria-label="Collapse navbar"
          onClick={onCollapseToggle}
          style={iconBtn}
          data-standalone-action="collapse"
        >
          <MenuFoldOutlined />
        </button>
      </Tooltip>
    </div>
  );
}

export function StandaloneNavbarFooterExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Expand navbar" placement="right">
      <Button
        type="text"
        size="small"
        aria-label="Expand navbar"
        icon={<ArrowRightOutlined />}
        onClick={onClick}
        style={{ width: 32, height: 32 }}
        data-standalone-action="expand"
      />
    </Tooltip>
  );
}
