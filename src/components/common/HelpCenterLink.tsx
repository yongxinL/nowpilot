import { QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';

interface HelpCenterLinkProps {
  onClick?: () => void;
  compact?: boolean;
}

export function HelpCenterLink({ onClick, compact }: HelpCenterLinkProps) {
  const { token: antdToken } = theme.useToken();
  return (
    <Tooltip title="Help Center">
      <Button
        type="text"
        size={compact ? 'small' : 'middle'}
        aria-label="Help Center"
        icon={<QuestionCircleOutlined />}
        onClick={onClick}
        style={{ color: antdToken.colorTextSecondary }}
      />
    </Tooltip>
  );
}
