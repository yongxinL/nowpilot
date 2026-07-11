import { useMemo } from 'react';
import { Button, Flex, theme } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { selectNavItems } from '../../core/navigation/navigationSelectors';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { NavItemButton } from '../navigation/NavItemButton';
import { UserAvatarMenu } from '../common/UserAvatarMenu';
import { StandaloneNavbarHeader, StandaloneNavbarFooterExpandButton } from './StandaloneNavbarHeader';

export interface StandaloneNavbarProps {
  density: 'expanded' | 'collapsed';
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  onCollapseToggle: () => void;
  onSwitchToSidePanel: () => void;
  onOpenOptions: () => void;
}

export function StandaloneNavbar({
  density,
  activeId,
  onSelect,
  onCollapseToggle,
  onSwitchToSidePanel,
  onOpenOptions,
}: StandaloneNavbarProps) {
  const { token } = theme.useToken();
  const width = density === 'expanded' ? 240 : 56;

  const groupA = useMemo(() => selectNavItems({ surface: 'standalone', group: 'A' }), []);
  const groupB = useMemo(() => selectNavItems({ surface: 'standalone', group: 'B' }), []);

  const containerStyle: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
    transition: `width ${token.motionDurationMid} ${token.motionEaseOut}`,
    overflow: 'hidden',
  };

  return (
    <aside
      role="navigation"
      aria-label="Standalone navbar"
      data-standalone-navbar-density={density}
      style={containerStyle}
    >
      <StandaloneNavbarHeader
        density={density}
        onCollapseToggle={onCollapseToggle}
        onSwitchToSidePanel={onSwitchToSidePanel}
      />

      <Flex
        vertical
        role="group"
        aria-label="Primary navigation"
        style={{ padding: '12px 8px', gap: 4, flex: 1, overflowY: 'auto' }}
      >
        {groupA.map((item) => (
          <NavItemButton
            key={item.id}
            item={item}
            active={item.id === activeId}
            density={density === 'expanded' ? 'expanded' : 'collapsed'}
            surface="standalone"
            onClick={onSelect}
            showArrow={density === 'expanded' && item.showArrowInStandaloneExpanded === true}
          />
        ))}

        {density === 'expanded' && (
          <div
            style={{
              height: 1,
              backgroundColor: token.colorBorderSecondary,
              margin: '8px 0',
            }}
            role="separator"
          />
        )}

        {groupB.map((item) => (
          <NavItemButton
            key={item.id}
            item={item}
            active={item.id === activeId}
            density={density === 'expanded' ? 'expanded' : 'collapsed'}
            surface="standalone"
            onClick={onSelect}
            showArrow={density === 'expanded' && item.showArrowInStandaloneExpanded === true}
          />
        ))}
      </Flex>

      <Flex
        role="group"
        aria-label="Standalone navbar footer"
        align={density === 'expanded' ? 'center' : 'center'}
        justify={density === 'expanded' ? 'flex-start' : 'center'}
        style={{
          padding: density === 'expanded' ? '12px 12px' : '12px 0',
          gap: 8,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Button
          type="text"
          size="small"
          aria-label="Open Options"
          icon={<SettingOutlined />}
          onClick={onOpenOptions}
          data-standalone-action="open-options"
        >
          {density === 'expanded' ? 'Options' : undefined}
        </Button>
        <UserAvatarMenu
          size={density === 'expanded' ? 'default' : 'small'}
          onSelect={(key) => {
            if (key === 'appearance') onOpenOptions();
          }}
        />
        {density === 'collapsed' && (
          <StandaloneNavbarFooterExpandButton onClick={onCollapseToggle} />
        )}
      </Flex>
    </aside>
  );
}
