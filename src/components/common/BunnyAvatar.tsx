import React from 'react';

export const BunnyAvatar: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#2D3748', display: 'block', ...style }}>
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
