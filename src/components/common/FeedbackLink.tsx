import { MailOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';

interface FeedbackLinkProps {
  onClick?: () => void;
  compact?: boolean;
}

export function FeedbackLink({ onClick, compact }: FeedbackLinkProps) {
  const { token: antdToken } = theme.useToken();
  return (
    <Tooltip title="Feedback">
      <Button
        type="text"
        size={compact ? 'small' : 'middle'}
        aria-label="Feedback"
        icon={<MailOutlined />}
        onClick={onClick}
        style={{ color: antdToken.colorTextSecondary }}
      />
    </Tooltip>
  );
}
