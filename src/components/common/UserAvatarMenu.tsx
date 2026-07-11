import { Avatar, Dropdown, type MenuProps } from 'antd';
import { UserOutlined } from '@ant-design/icons';

export interface UserAvatarMenuProps {
  userName?: string;
  userEmail?: string;
  avatarSrc?: string;
  onSelect?: (key: string) => void;
  size?: 'small' | 'default' | 'large';
}

const defaultMenuKeys = [
  'profile',
  'appearance',
  'providers',
  'diagnostics',
  'help-center',
  'feedback',
  'about',
] as const;

export function UserAvatarMenu({
  userName,
  userEmail,
  avatarSrc,
  onSelect,
  size = 'default',
}: UserAvatarMenuProps) {
  const items: MenuProps['items'] = (
    [
      { key: 'profile', label: 'Profile' },
      { key: 'appearance', label: 'Appearance' },
      { key: 'providers', label: 'Providers' },
      { key: 'diagnostics', label: 'Diagnostics' },
      { key: 'help-center', label: 'Help Center' },
      { key: 'feedback', label: 'Feedback' },
      { key: 'about', label: 'About' },
    ] as const
  ).map(({ key, label }) => ({ key, label }));

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => onSelect?.(key),
      }}
      trigger={['click']}
      placement="topRight"
    >
      <button
        type="button"
        aria-label={userName ? `User menu for ${userName}` : 'User menu'}
        style={{
          background: 'transparent',
          padding: 0,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Avatar size={size} src={avatarSrc} icon={!avatarSrc ? <UserOutlined /> : undefined}>
          {avatarSrc ? undefined : userName?.slice(0, 1)?.toUpperCase()}
        </Avatar>
      </button>
    </Dropdown>
  );
}

export { defaultMenuKeys };
