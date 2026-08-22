import React, { useState } from 'react';
import { AI_AVATAR_ICON } from '../../assets/icons/avatarData';

interface NowPilotAvatarProps {
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
}

export const NowPilotAvatar: React.FC<NowPilotAvatarProps> = ({
  className = '',
  size = 24,
  style,
}) => {
  const [hasError, setHasError] = useState(false);
  const sizeNum = typeof size === 'number' ? size : parseInt(String(size), 10) || 24;
  const sizePx = `${sizeNum}px`;

  if (hasError || !AI_AVATAR_ICON) {
    return (
      <div
        style={{
          width: sizePx,
          height: sizePx,
          minWidth: sizePx,
          minHeight: sizePx,
          maxWidth: sizePx,
          maxHeight: sizePx,
          backgroundColor: 'var(--np-primary, #1677ff)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          userSelect: 'none',
          ...style,
        }}
        className={className}
        title="NowPilot AI"
      >
        <svg
          width={Math.round(sizeNum * 0.6)}
          height={Math.round(sizeNum * 0.6)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={AI_AVATAR_ICON}
      alt="NowPilot AI Avatar"
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



