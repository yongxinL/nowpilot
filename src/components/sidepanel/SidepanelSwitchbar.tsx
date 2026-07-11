import { useMemo } from 'react';
import { Avatar, Divider, theme } from 'antd';
import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { selectNavItems } from '../../core/navigation/navigationSelectors';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { NavItemButton } from '../navigation/NavItemButton';
import { UserAvatarMenu } from '../common/UserAvatarMenu';
import { SidepanelSwitchbarTopbar } from './SidepanelSwitchbarTopbar';

export type SidepanelSwitchbarDensity = 'expanded' | 'narrow';

export interface SidepanelSwitchbarProps {
  density: SidepanelSwitchbarDensity;
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  onCollapse: () => void;
  onOpenStandalone: () => void;
  onOpenOptions?: () => void;
}

export function SidepanelSwitchbar({
  density,
  activeId,
  onSelect,
  onCollapse,
  onOpenStandalone,
  onOpenOptions,
}: SidepanelSwitchbarProps) {
  const { token } = theme.useToken();
  const width = density === 'expanded' ? 60 : 45;

  const groupA = useMemo(() => selectNavItems({ surface: 'sidepanel', group: 'A' }), []);
  const groupB = useMemo(() => selectNavItems({ surface: 'sidepanel', group: 'B' }), []);

  const containerStyle: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: token.colorBgContainer,
    borderLeft: `1px solid ${token.colorBorderSecondary}`,
    transition: `width ${token.motionDurationMid} ${token.motionEaseOut}`,
    overflow: 'hidden',
  };

  const navRowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 4px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
  };

  const groupItemStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  return (
    <aside
      role="navigation"
      aria-label="Side panel switchbar"
      data-sidepanel-density={density}
      style={containerStyle}
    >
      <SidepanelSwitchbarTopbar
        density={density}
        onCollapse={onCollapse}
        onOpenStandalone={onOpenStandalone}
      />

      <div style={navRowStyle} role="group" aria-label="Primary navigation">
        {groupA.map((item) => (
          <div key={item.id} style={groupItemStyle}>
            <NavItemButton
              item={item}
              active={item.id === activeId}
              density={density === 'expanded' ? 'expanded' : 'narrow'}
              surface="sidepanel"
              onClick={onSelect}
              showArrow={false}
            />
          </div>
        ))}
      </div>

      <Divider style={{ margin: '4px 8px', borderColor: token.colorBorderSecondary }} />

      <div style={navRowStyle} role="group" aria-label="Secondary navigation">
        {groupB.map((item) => (
          <div key={item.id} style={groupItemStyle}>
            <NavItemButton
              item={item}
              active={item.id === activeId}
              density={density === 'expanded' ? 'expanded' : 'narrow'}
              surface="sidepanel"
              onClick={onSelect}
              showArrow={false}
            />
          </div>
        ))}
      </div>

      <div
        role="group"
        aria-label="Footer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '8px 4px',
        }}
      >
        <button
          type="button"
          aria-label="Open Options"
          onClick={onOpenOptions}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: token.colorTextSecondary,
            padding: 6,
            borderRadius: token.borderRadius,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          data-sidepanel-action="open-options"
        >
          <Avatar size={28} icon={<SettingOutlined />} />
        </button>
        <UserAvatarMenu
          size="small"
          onSelect={(key) => {
            if (key === 'appearance') onOpenOptions?.();
          }}
        />
      </div>
    </aside>
  );
}
