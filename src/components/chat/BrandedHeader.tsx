import React from 'react';
import { Flex, Typography, Button, Tooltip, theme, Avatar } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { BunnyAvatar } from '../common/BunnyAvatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BrandedHeaderProps {
  userGreeting?: string;       // D-23: e.g., "Good morning, George"
  contextualMessage?: string;  // D-23: e.g., "You're working on: INC0012345"
  onClose?: () => void;
}

const { Text } = Typography;

// ---------------------------------------------------------------------------
// BrandedHeader — AI identity bar above message list (D-05 / RICH-H-01)
// Extended with dynamic greeting props (D-23)
// ---------------------------------------------------------------------------
export function BrandedHeader({ userGreeting, contextualMessage, onClose }: BrandedHeaderProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      align="center"
      gap={token.marginSM}
      style={{
        padding: `${token.paddingSM}px ${token.padding}px`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
      }}
    >
      {/* Bunny avatar with accent ring */}
      <Avatar
        size={32}
        icon={<BunnyAvatar />}
        style={{
          border: `2px solid ${token.colorPrimary}`,
          flexShrink: 0,
        }}
      />

      {/* Name + tagline — now dynamic with greeting props (D-23) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Text strong style={{ fontSize: userGreeting ? 20 : 16, lineHeight: '22px' }}>
          {userGreeting || 'NowPilot'}
        </Text>
        <Text type="secondary" style={{ fontSize: 12, lineHeight: '16px' }}>
          {contextualMessage || 'Your AI work co-pilot'}
        </Text>
      </div>

      {/* Close button */}
      <Tooltip title="Hide this header">
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="Hide this header"
        />
      </Tooltip>
    </Flex>
  );
}
