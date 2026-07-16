import { theme } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { SiderMenu } from '../sider/SiderMenu';
import { SiderTrigger } from '../sider/SiderTrigger';
import { UserAvatarMenu } from '../common/UserAvatarMenu';
import { StandaloneSiderHeader } from './StandaloneSiderHeader';

export const STANDALONE_NAVBAR_WIDTH = 240;

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
  const width = density === 'expanded' ? STANDALONE_NAVBAR_WIDTH : 56;

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
    flexShrink: 0,
  };

  const menuStyle: CSSProperties =
    density === 'expanded'
      ? {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px 16px',
        }
      : {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '12px 8px',
        };

  const footerExpandedStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginTop: 'auto',
    paddingRight: 16,
    paddingLeft: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
    flexShrink: 0,
  };

  const footerCollapsedStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 'auto',
    padding: '0 8px 8px',
    gap: 4,
    flexShrink: 0,
  };

  return (
    <aside
      role="navigation"
      aria-label="Standalone sider"
      data-standalone-sider-density={density}
      data-standalone-sider-width={width}
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
        showSeparator={density === 'expanded'}
        style={menuStyle}
      />

      {density === 'expanded' ? (
        <div
          role="group"
          aria-label="Standalone sider footer"
          data-standalone-sider-footer="expanded"
          style={footerExpandedStyle}
        >
          <div
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserAvatarMenu
              size="default"
              mode="standalone"
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
          data-standalone-sider-footer="collapsed"
          style={footerCollapsedStyle}
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
          <div
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              order: 3,
            }}
          >
            <UserAvatarMenu
              size="small"
              mode="standalone"
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