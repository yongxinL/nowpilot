import { Typography } from 'antd';
import { STR } from '@/core/i18n/strings';

export function ChatPage() {
  return <Typography.Text type="secondary">{STR.chat.empty}</Typography.Text>;
}
