import React, { useState } from 'react';
import { USER_AVATAR_ICON } from '../../assets/icons/avatarData';

interface UserAvatarProps {
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  className = '',
  size = 28,
  style,
}) => {
  const [hasError, setHasError] = useState(false);
  const sizeNum = typeof size === 'number' ? size : parseInt(String(size), 10) || 28;
  const sizePx = `${sizeNum}px`;

  if (hasError || !USER_AVATAR_ICON) {
    return (
      <div
        style={{
          width: sizePx,
          height: sizePx,
          minWidth: sizePx,
          minHeight: sizePx,
          maxWidth: sizePx,
          maxHeight: sizePx,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--muted) 0%, var(--border) 100%)',
          color: 'var(--muted-foreground)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          userSelect: 'none',
          ...style,
        }}
        className={className}
        title="User"
      >
        <svg
          width={Math.round(sizeNum * 0.55)}
          height={Math.round(sizeNum * 0.55)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={USER_AVATAR_ICON}
      alt="User Avatar"
      onError={() => setHasError(true)}
      style={{
        width: sizePx,
        height: sizePx,
        minWidth: sizePx,
        minHeight: sizePx,
        maxWidth: sizePx,
        maxHeight: sizePx,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        border: 0,
        userSelect: 'none',
        ...style,
      }}
      className={className}
      draggable={false}
    />
  );
};



