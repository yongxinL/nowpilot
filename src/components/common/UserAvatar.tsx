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
          ...style,
        }}
        className={`rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-2xs select-none ${className}`}
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
        ...style,
      }}
      className={`rounded-full object-cover border-0 select-none ${className}`}
      draggable={false}
    />
  );
};



