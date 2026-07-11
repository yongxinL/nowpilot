import { Space } from 'antd';
import { HelpCenterLink } from './HelpCenterLink';
import { FeedbackLink } from './FeedbackLink';
import { MCPStatusIndicator } from './MCPStatusIndicator';

export interface WorkspaceStatusBarRightProps {
  mcpEnabled?: boolean;
  onHelp?: () => void;
  onFeedback?: () => void;
  compact?: boolean;
}

export function WorkspaceStatusBarRight({
  mcpEnabled,
  onHelp,
  onFeedback,
  compact,
}: WorkspaceStatusBarRightProps) {
  return (
    <Space size={compact ? 'small' : 'middle'} aria-label="workspace status right">
      <MCPStatusIndicator enabled={mcpEnabled} />
      <HelpCenterLink onClick={onHelp} compact={compact} />
      <FeedbackLink onClick={onFeedback} compact={compact} />
    </Space>
  );
}
