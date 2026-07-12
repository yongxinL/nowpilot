import { Button, Divider, Flex, Popover, theme } from 'antd';
import { ExpandOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { SiderMenu } from './SiderMenu';
import { UserAvatarMenu } from '../common/UserAvatarMenu';

export interface SiderPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  onExpand: () => void;
  onOpenStandalone: () => void;
  onOpenOptions?: () => void;
}

export function SiderPopup({
  open,
  onOpenChange,
  activeId,
  onSelect,
  onExpand,
  onOpenStandalone,
  onOpenOptions,
}: SiderPopupProps) {
  const { token } = theme.useToken();

  const content = (
    <div style={{ width: 280 }} role="dialog" aria-label="Collapsed sider popup">
      <Flex gap={6} style={{ padding: '0 4px 8px' }} role="toolbar" aria-label="Popup topbar">
        <Button
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={onExpand}
          aria-label="Expand sider"
          data-sider-action="expand"
        >
          Expand sider
        </Button>
        <Button
          size="small"
          icon={<ExpandOutlined />}
          onClick={onOpenStandalone}
          aria-label="Open Standalone"
          data-sider-action="open-standalone"
        >
          Open Standalone
        </Button>
      </Flex>
      <Divider style={{ margin: '4px 0' }} />
      <SiderMenu
        surface="sidepanel"
        density="expanded"
        activeId={activeId}
        onSelect={onSelect}
        showGroups={false}
        showArrows={false}
        style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      />
      <Divider style={{ margin: '4px 0' }} />
      <Flex
        align="center"
        justify="space-between"
        role="group"
        aria-label="Popup footer"
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
