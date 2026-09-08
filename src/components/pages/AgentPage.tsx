import { Typography } from 'antd';
import { STR } from '@/core/i18n/strings';

export function AgentPage() {
  return <Typography.Text type="secondary">{STR.agent.empty}</Typography.Text>;
}
