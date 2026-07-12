import { theme } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { SiderMenu } from '../sider/SiderMenu';
import { UserAvatarMenu } from '../common/UserAvatarMenu';
import { SidepanelSiderHeader } from './SidepanelSiderHeader';

export type SidepanelSiderDensity = 'expanded' | 'narrow';

export const SIDEPANEL_SWITCHBAR_WIDTH = 60;
export const SIDEPANEL_NARROW_WIDTH = 44;
export const SIDEPANEL_NARROW_MAX_WIDTH = 400;

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
  const width = density === 'expanded' ? SIDEPANEL_SWITCHBAR_WIDTH : SIDEPANEL_NARROW_WIDTH;

  const containerStyle: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    paddingTop: 20,
    paddingBottom: 12,
    background: 'transparent',
    transition: `width ${token.motionDurationMid} ${token.motionEaseOut}`,
    overflow: 'hidden',
    flexShrink: 0,
  };

  const menuStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    width: '100%',
    padding: '12px 0',
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 'auto',
    paddingTop: 8,
    flexShrink: 0,
  };

  return (
    <aside
      role="navigation"
      aria-label="Side panel sider"
      data-sidepanel-sider-density={density}
      data-sidepanel-sider-width={width}
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
        showGroups={true}
        showArrows={false}
        showSeparator={true}
        style={menuStyle}
      />

      <div
        role="group"
        aria-label="Sidepanel sider footer"
        data-sidepanel-sider-footer="true"
        style={footerStyle}
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