import React, { useEffect, useState } from 'react';
import { Avatar, Popover, message, theme } from 'antd';
import {
  UserOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  MailOutlined,
  LogoutOutlined,
} from '@ant-design/icons';

// SVG representation of the cute bunny avatar for George Li
const GeorgeLiAvatar = () => (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#2D3748', display: 'block' }}>
    <circle cx="50" cy="50" r="40" fill="#EDF2F7" />
    <ellipse cx="40" cy="20" rx="8" ry="18" fill="#EDF2F7" />
    <ellipse cx="40" cy="20" rx="4" ry="12" fill="#FED7D7" />
    <ellipse cx="60" cy="20" rx="8" ry="18" fill="#EDF2F7" />
    <ellipse cx="60" cy="20" rx="4" ry="12" fill="#FED7D7" />
    <circle cx="42" cy="48" r="4" fill="#2D3748" />
    <circle cx="58" cy="48" r="4" fill="#2D3748" />
    <circle cx="50" cy="54" r="2.5" fill="#E53E3E" />
    <circle cx="36" cy="54" r="5" fill="#FED7D7" opacity="0.6" />
    <circle cx="64" cy="54" r="5" fill="#FED7D7" opacity="0.6" />
    <path d="M47,58 Q50,60 53,58" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export interface UserAvatarMenuProps {
  userName?: string;
  userEmail?: string;
  avatarSrc?: string;
  onSelect?: (key: string) => void;
  size?: 'small' | 'default' | 'large';
  mode?: 'sidepanel' | 'standalone';
}

const defaultMenuKeys = [
  'profile',
  'appearance',
  'diagnostics',
  'help-center',
  'feedback',
  'about',
] as const;

export function UserAvatarMenu({
  userName: propUserName,
  userEmail: propUserEmail,
  avatarSrc: propAvatarSrc,
  onSelect,
  size = 'default',
  mode = 'standalone',
}: UserAvatarMenuProps) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string }>({
    name: propUserName || 'George Li',
    email: propUserEmail || 'oraclexp@hotmail.com',
    avatar: propAvatarSrc || 'george-li-bunny',
  });

  const loadProfile = async () => {
    try {
      const result = await chrome.storage.local.get('np_google_profile');
      if (result.np_google_profile) {
        setProfile(result.np_google_profile);
      } else {
        setProfile({
          name: propUserName || 'George Li',
          email: propUserEmail || 'oraclexp@hotmail.com',
          avatar: propAvatarSrc || 'george-li-bunny',
        });
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadProfile();
  }, [propUserName, propUserEmail, propAvatarSrc]);

  // Load profile when popover opens to ensure fresh data
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      loadProfile();
    }
  };

  const handleLogout = async () => {
    try {
      await chrome.storage.local.remove('np_google_profile');
      setProfile({
        name: 'George Li',
        email: 'oraclexp@hotmail.com',
        avatar: 'george-li-bunny',
      });
      message.success('Logged out successfully');
      setOpen(false);
      onSelect?.('logout');
    } catch {
      message.error('Failed to log out');
    }
  };

  const handleItemClick = (key: string) => {
    setOpen(false);
    if (key === 'logout') {
      handleLogout();
    } else {
      onSelect?.(key);
    }
  };

  // Define menu items depending on mode (sidepanel vs standalone)
  const menuItems = mode === 'sidepanel'
    ? [
        { key: 'appearance', label: 'My account', icon: <UserOutlined /> },
        { key: 'help-center', label: 'Help center', icon: <QuestionCircleOutlined /> },
        { key: 'logout', label: 'Log out', icon: <LogoutOutlined /> },
      ]
    : [
        { key: 'whats-new', label: "What's new", icon: <BellOutlined /> },
        { key: 'appearance', label: 'My account', icon: <UserOutlined /> },
        { key: 'help-center', label: 'Help center', icon: <QuestionCircleOutlined /> },
        { key: 'feedback', label: 'Feedback', icon: <MailOutlined /> },
        { key: 'logout', label: 'Log out', icon: <LogoutOutlined /> },
      ];

  // Inner hover item component for modern visuals
  const MenuItem = ({ item }: { item: typeof menuItems[0] }) => {
    const [hovered, setHovered] = useState(false);
    
    const isLogout = item.key === 'logout';

    return (
      <div
        role="menuitem"
        onClick={() => handleItemClick(item.key)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderRadius: '12px',
          cursor: 'pointer',
          background: hovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        <span
          style={{
            fontSize: '16px',
            marginRight: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            color: isLogout && hovered ? '#EF4444' : hovered ? token.colorPrimary : '#4B5563',
            transition: 'color 0.15s ease-in-out',
          }}
        >
          {item.icon}
        </span>
        <span
          style={{
            fontSize: '13.5px',
            fontWeight: 500,
            color: isLogout && hovered ? '#EF4444' : hovered ? '#111827' : '#374151',
            transition: 'color 0.15s ease-in-out',
          }}
        >
          {item.label}
        </span>
      </div>
    );
  };

  const popoverContent = (
    <div
      style={{
        width: 250,
        background: '#FFFFFF',
        color: '#1F2937',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header Profile Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '20px 20px 12px 20px',
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          {profile.avatar === 'george-li-bunny' ? (
            <GeorgeLiAvatar />
          ) : (
            <Avatar size={40} src={profile.avatar} icon={<UserOutlined />} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: '14.5px',
              fontWeight: 600,
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {profile.name}
          </span>
          <span
            style={{
              fontSize: '11.5px',
              color: '#6B7280',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px',
            }}
          >
            {profile.email}
          </span>
        </div>
      </div>

      {/* Menu Options */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          padding: '0 8px 12px 8px',
        }}
      >
        {menuItems.map((item) => (
          <MenuItem key={item.key} item={item} />
        ))}
      </div>
    </div>
  );

  const displayAvatar = () => {
    if (profile.avatar === 'george-li-bunny') {
      return (
        <Avatar
          size={size}
          style={{
            background: '#2D3748',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', height: '100%' }}>
            <GeorgeLiAvatar />
          </div>
        </Avatar>
      );
    }

    return (
      <Avatar size={size} src={profile.avatar} icon={<UserOutlined />}>
        {profile.name?.slice(0, 1)?.toUpperCase()}
      </Avatar>
    );
  };

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      arrow={false}
      placement="topRight"
      styles={{
        body: { padding: 0 },
        container: {
          padding: 0,
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 10px 32px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(0, 0, 0, 0.04)',
        }
      }}
    >
      <button
        type="button"
        aria-label={profile ? `User menu for ${profile.name}` : 'User menu'}
        style={{
          background: 'transparent',
          padding: 0,
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
        }}
      >
        {displayAvatar()}
      </button>
    </Popover>
  );
}

export { defaultMenuKeys };
