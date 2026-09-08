import { Typography } from 'antd';
import { STR } from '@/core/i18n/strings';

export function NotesPage() {
  return <Typography.Text type="secondary">{STR.notes.empty}</Typography.Text>;
}
