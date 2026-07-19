import { Tag, theme } from 'antd';
import {
  FileTextOutlined,
  PushpinOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { ReferenceToken } from '../../core/references/ReferenceToken';

const ICON_MAP: Record<string, ReactNode> = {
  FileTextOutlined: <FileTextOutlined />,
  PushpinOutlined: <PushpinOutlined />,
  MessageOutlined: <MessageOutlined />,
};

export interface MentionChipProps {
  token: ReferenceToken;
  icon?: string;
  color?: string;
  stale?: boolean;
  onRemove?: () => void;
}

export function MentionChip({ token, icon, color, stale, onRemove }: MentionChipProps) {
  const { token: antdToken } = theme.useToken();
  const chipColor = color === 'colorPrimary' ? antdToken.colorPrimary
    : color === 'colorInfo' ? antdToken.colorInfo
    : color === 'colorSuccess' ? antdToken.colorSuccess
    : antdToken.colorPrimary;

  return (
    <Tag
      closable={!stale}
      onClose={onRemove}
      icon={icon ? ICON_MAP[icon] : undefined}
      style={{
        background: stale ? `${antdToken.colorBgContainerDisabled}40` : `${chipColor}18`,
        borderColor: stale ? `${antdToken.colorBorder}40` : `${chipColor}40`,
        color: stale ? antdToken.colorTextDisabled : chipColor,
        opacity: stale ? 0.5 : 1,
        margin: 0,
        borderRadius: antdToken.borderRadiusSM,
      }}
    >
      {token.displayLabel}
    </Tag>
  );
}
