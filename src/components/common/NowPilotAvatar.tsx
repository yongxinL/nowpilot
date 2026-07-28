import React from 'react';
import avatarImg from '../../assets/avatar.png';

interface NowPilotAvatarProps {
  className?: string;
  size?: number;
}

export const NowPilotAvatar: React.FC<NowPilotAvatarProps> = ({ className = 'w-full h-full', size }) => {
  return (
    <img
      src={avatarImg}
      alt="NowPilot Avatar"
      referrerPolicy="no-referrer"
      style={size ? { width: size, height: size } : undefined}
      className={`rounded-full object-cover ${className}`}
    />
  );
};


