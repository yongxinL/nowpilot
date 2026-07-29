import React, { useState } from 'react';
import avatarImg from '../../assets/icons/icon-role-ai-avatar.png';

interface NowPilotAvatarProps {
  className?: string;
  size?: number;
}

export const NowPilotAvatar: React.FC<NowPilotAvatarProps> = ({ className = 'w-full h-full', size }) => {
  const [hasError, setHasError] = useState(false);

  const imgSrc = typeof avatarImg === 'string' ? avatarImg : (avatarImg as { default?: string })?.default || avatarImg;

  if (hasError) {
    return (
      <div
        className={`rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 ${className}`}
        style={size ? { width: size, height: size } : undefined}
      >
        N
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt="NowPilot Avatar"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      style={size ? { width: size, height: size } : undefined}
      className={`rounded-full object-cover ${className}`}
    />
  );
};





