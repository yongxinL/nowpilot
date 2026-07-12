import { theme } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { SiderMenu } from '../sider/SiderMenu';
import { UserAvatarMenu } from '../common/UserAvatarMenu';
import { SidepanelSiderHeader } from './SidepanelSiderHeader';

export type SidepanelSiderDensity = 'expanded' | 'narrow';

export interface SidepanelSiderProps {
  density: SidepanelSiderDensity;
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  onCollapse: () => void;
  onOpenStandalone: () => void;
  onOpenOptions?: () => void;
}

export function SidepanelSider({
  density,
  activeId,
  onSelect,
  onCollapse,
  onOpenStandalone,
  onOpenOptions,
}: SidepanelSiderProps) {
  const { token } = theme.useToken();
  const width = density === 'expanded' ? 60 : 44;

  const containerStyle: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    paddingTop: 20,
    paddingBottom: 12,
    background: 'transparent',
    transition: `width ${token.motionDurationMid} ${token.motionEaseOut}`,
    overflow: 'hidden',
  };

  const menuStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    width: '100%',
  };

  return (
    <aside
      role="navigation"
      aria-label="Side panel sider"
      data-sidepanel-sider-density={density}
      style={containerStyle}
    >
      <SidepanelSiderHeader
        density={density}
        onCollapse={onCollapse}
        onOpenStandalone={onOpenStandalone}
      />

      <SiderMenu
        surface="sidepanel"
        density={density}
        activeId={activeId}
        onSelect={onSelect}
        showGroups={false}
        showArrows={false}
        style={menuStyle}
      />

      <div
        role="group"
        aria-label="Footer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
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
            padding: 4,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          data-sidepanel-action="open-options"
        >
          <SettingOutlined style={{ fontSize: 14 }} />
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
