import React, { useState } from 'react';
import userAvatarImg from '../../assets/icons/icon-role-user-avatar.png';

interface UserAvatarProps {
  className?: string;
  size?: number;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ className = 'w-full h-full', size }) => {
  const [hasError, setHasError] = useState(false);

  const imgSrc = typeof userAvatarImg === 'string' ? userAvatarImg : (userAvatarImg as { default?: string })?.default || userAvatarImg;

  if (hasError) {
    return (
      <div
        className={`rounded-full bg-violet-600 text-white font-bold flex items-center justify-center shrink-0 ${className}`}
        style={size ? { width: size, height: size } : undefined}
      >
        U
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt="User Avatar"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      style={size ? { width: size, height: size } : undefined}
      className={`rounded-full object-cover ${className}`}
    />
  );
};
