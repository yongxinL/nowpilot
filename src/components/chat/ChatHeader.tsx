import React from 'react';
import { Tooltip, theme } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { NowPilotAvatar } from '../common/NowPilotAvatar';

interface ChatHeaderProps {
  onOpenOptions?: () => void;
  onOpenStandalone?: () => void;
  onOpenOnboarding: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onOpenOptions,
  onOpenStandalone,
  onOpenOnboarding,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid',
        borderBottomColor: token.colorBorderSecondary,
        background: token.colorBgContainer,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <NowPilotAvatar style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: token.colorText }}>NowPilot</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Onboarding Tour */}
        <Tooltip title="Onboarding Tour">
          <button
            type="button"
            onClick={onOpenOnboarding}
            style={{
              padding: 6,
              borderRadius: 8,
              color: token.colorTextTertiary,
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
            }}
          >
            <BulbOutlined style={{ color: '#f59e0b', fontSize: 12 }} />
          </button>
        </Tooltip>

        {/* Open Options */}
        <Tooltip title="Options">
          <button
            type="button"
            onClick={onOpenOptions}
            style={{
              padding: 6,
              borderRadius: 8,
              color: token.colorTextTertiary,
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 60 60">
              <path fill="currentColor" fillRule="evenodd" d="M24.455 4.367h11.089c2.682 0 4.536-.002 6.236.55a11.25 11.25 0 0 1 4.051 2.34c1.329 1.196 2.255 2.802 3.595 5.125l.18.31 5.185 8.983.18.31c1.342 2.322 2.269 3.927 2.64 5.676a11.25 11.25 0 0 1 0 4.678c-.371 1.749-1.298 3.354-2.64 5.676l-.18.31-5.186 8.983-.179.31c-1.34 2.323-2.266 3.929-3.595 5.125a11.25 11.25 0 0 1-4.05 2.34c-1.701.552-3.555.55-6.236.55h-11.09c-2.682 0-4.535.002-6.235-.55a11.25 11.25 0 0 1-4.052-2.34c-1.328-1.196-2.254-2.802-3.594-5.125l-.18-.31-5.186-8.983-.18-.31c1.341-2.322-2.268-3.927-2.64-5.676a11.25 11.25 0 0 1 0-4.678c.372-1.749 1.299-3.354 2.64-5.676l.18-.31 5.186-8.983.18-.31c1.34-2.323 2.266-3.929 3.594-5.125a11.25 11.25 0 0 1 4.052-2.34c1.7-.552 3.553-.55 6.235-.55m.359 4.5c-3.18 0-4.268.026-5.204.33a6.75 6.75 0 0 0-2.43 1.404c-.732.659-1.298 1.587-2.889 4.341l-5.186 8.983c1.59 2.754-2.11 3.709-2.315 4.672a6.75 6.75 0 0 0 0 2.806c.204.963.725 1.918 2.315 4.672l5.186 8.983c1.59 2.754 2.157 3.682 2.888 4.34a6.75 6.75 0 0 0 2.431 1.404c.936.304 2.023.33 5.204.33h10.372c3.18 0 4.267-.026 5.203-.33A6.75 6.75 0 0 0 42.82 49.4c.732-.659 1.298-1.587 2.888-4.341l5.186-8.983c1.59-2.754 2.111-3.709 2.316-4.672a6.75 6.75 0 0 0 0-2.806c-.205-.963-.725-1.918-2.316-4.672l-5.186-8.983c-1.59-2.754-2.156-3.682-2.888-4.34a6.75 6.75 0 0 0-2.43-1.404c-.937-.305-2.023-.33-5.204-.33zM30 21.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5M17.25 30c0-7.042 5.708-12.75 12.75-12.75S42.75 22.958 42.75 30 37.04 42.75 30 42.75 17.25 37.042 17.25 30" clipRule="evenodd"></path>
            </svg>
          </button>
        </Tooltip>

        {/* Open Standalone Workspace */}
        <Tooltip title="Full page">
          <button
            type="button"
            onClick={onOpenStandalone}
            style={{
              padding: 6,
              borderRadius: 8,
              color: token.colorTextTertiary,
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
              <path fill="currentColor" d="M4.762 3.362a.525.525 0 0 1 .743.743L2.609 7l2.896 2.895a.525.525 0 1 1-.743.743L1.825 7.7a.99.99 0 0 1 0-1.402zm4.476 0a.525.525 0 0 0-.743.743L11.391 7 8.495 9.895a.525.525 0 0 0 .743.743L12.175 7.7a.99.99 0 0 0 0-1.402z"></path>
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
