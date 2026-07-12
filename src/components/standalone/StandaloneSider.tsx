import { theme } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { SiderMenu } from '../sider/SiderMenu';
import { SiderTrigger } from '../sider/SiderTrigger';
import { UserAvatarMenu } from '../common/UserAvatarMenu';
import { StandaloneSiderHeader } from './StandaloneSiderHeader';

export interface StandaloneSiderProps {
  density: 'expanded' | 'collapsed';
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  onCollapseToggle: () => void;
  onSwitchToSidePanel: () => void;
  onOpenOptions: () => void;
}

export function StandaloneSider({
  density,
  activeId,
  onSelect,
  onCollapseToggle,
  onSwitchToSidePanel,
  onOpenOptions,
}: StandaloneSiderProps) {
  const { token } = theme.useToken();
  const width = density === 'expanded' ? 240 : 56;

  const containerStyle: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'transparent',
    transition: `width ${token.motionDurationMid} ${token.motionEaseOut}`,
    overflow: 'hidden',
  };

  const menuStyle: CSSProperties =
    density === 'expanded'
      ? { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto', padding: '12px 16px' }
      : { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto', padding: '12px 8px' };

  return (
    <aside
      role="navigation"
      aria-label="Standalone sider"
      data-standalone-sider-density={density}
      style={containerStyle}
    >
      <StandaloneSiderHeader
        density={density}
        onCollapseToggle={onCollapseToggle}
        onSwitchToSidePanel={onSwitchToSidePanel}
      />

      <SiderMenu
        surface="standalone"
        density={density}
        activeId={activeId}
        onSelect={onSelect}
        showGroups={density === 'expanded'}
        showArrows={density === 'expanded'}
        style={menuStyle}
      />

      {density === 'expanded' ? (
        <div
          role="group"
          aria-label="Standalone sider footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 16,
            paddingRight: 16,
            paddingLeft: 32,
            paddingBottom: 6,
            gap: 0,
          }}
        >
          <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserAvatarMenu
              size="default"
              onSelect={(key) => {
                if (key === 'appearance') onOpenOptions();
              }}
            />
          </div>
          <button
            type="button"
            aria-label="Open Options"
            onClick={onOpenOptions}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: token.colorTextSecondary,
              cursor: 'pointer',
            }}
            data-standalone-action="open-options"
          >
            <SettingOutlined style={{ fontSize: 16 }} />
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <SiderTrigger mode="expand-button" onActivate={onCollapseToggle} />
          </div>
        </div>
      ) : (
        <div
          role="group"
          aria-label="Standalone sider footer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 12,
            padding: '0 8px 4px',
          }}
        >
          <button
            type="button"
            aria-label="Open Options"
            onClick={onOpenOptions}
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: token.colorTextSecondary,
              cursor: 'pointer',
              order: 2,
            }}
            data-standalone-action="open-options"
          >
            <SettingOutlined style={{ fontSize: 16 }} />
          </button>
          <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', order: 3 }}>
            <UserAvatarMenu
              size="small"
              onSelect={(key) => {
                if (key === 'appearance') onOpenOptions();
              }}
            />
          </div>
          <div style={{ marginTop: 8, order: 4 }}>
            <SiderTrigger mode="expand-button" onActivate={onCollapseToggle} />
          </div>
        </div>
      )}
    </aside>
  );
}
