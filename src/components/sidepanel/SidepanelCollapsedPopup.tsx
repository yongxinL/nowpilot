import { Button, Divider, Flex, Popover, theme } from 'antd';
import { ExpandOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { selectNavItems } from '../../core/navigation/navigationSelectors';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { NavItemButton } from '../navigation/NavItemButton';
import { UserAvatarMenu } from '../common/UserAvatarMenu';

export interface SidepanelCollapsedPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  onExpand: () => void;
  onOpenStandalone: () => void;
  onOpenOptions?: () => void;
}

export function SidepanelCollapsedPopup({
  open,
  onOpenChange,
  activeId,
  onSelect,
  onExpand,
  onOpenStandalone,
  onOpenOptions,
}: SidepanelCollapsedPopupProps) {
  const { token } = theme.useToken();
  const groupA = useMemo(() => selectNavItems({ surface: 'sidepanel', group: 'A' }), []);
  const groupB = useMemo(() => selectNavItems({ surface: 'sidepanel', group: 'B' }), []);

  const content = (
    <div style={{ width: 280 }} role="dialog" aria-label="Collapsed navigation popup">
      <Flex gap={6} style={{ padding: '0 4px 8px' }} role="toolbar" aria-label="Collapsed popup topbar">
        <Button
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={onExpand}
          aria-label="Expand navbar"
          data-sidepanel-action="expand"
        >
          Expand navbar
        </Button>
        <Button
          size="small"
          icon={<ExpandOutlined />}
          onClick={onOpenStandalone}
          aria-label="Open Standalone"
          data-sidepanel-action="open-standalone"
        >
          Open Standalone
        </Button>
      </Flex>
      <Divider style={{ margin: '4px 0' }} />
      <Flex vertical role="group" aria-label="Collapsed popup navigation list" gap={2}>
        {[...groupA, ...groupB].map((item) => (
          <NavItemButton
            key={item.id}
            item={item}
            active={item.id === activeId}
            density="expanded"
            surface="sidepanel"
            onClick={onSelect}
            showArrow={false}
          />
        ))}
      </Flex>
      <Divider style={{ margin: '4px 0' }} />
      <Flex
        align="center"
        justify="space-between"
        role="group"
        aria-label="Collapsed popup footer"
        style={{ padding: '4px 8px' }}
      >
        <Button
          type="text"
          size="small"
          icon={<SettingOutlined />}
          onClick={onOpenOptions}
          aria-label="Open Options"
        >
          Options
        </Button>
        <UserAvatarMenu
          size="small"
          onSelect={(key) => {
            if (key === 'appearance') onOpenOptions?.();
          }}
        />
      </Flex>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger="click"
      placement="bottomRight"
      content={content}
      overlayInnerStyle={{ borderRadius: token.borderRadius * 2 }}
    >
      <span />
    </Popover>
  );
}
