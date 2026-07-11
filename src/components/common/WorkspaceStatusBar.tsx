import { Flex } from 'antd';
import { WorkspaceStatusBarLeft, type WorkspaceStatusBarLeftProps } from './WorkspaceStatusBarLeft';
import { WorkspaceStatusBarRight, type WorkspaceStatusBarRightProps } from './WorkspaceStatusBarRight';

export type WorkspaceStatusBarProps = WorkspaceStatusBarLeftProps &
  WorkspaceStatusBarRightProps & {
    surface?: 'sidepanel' | 'standalone';
  };

export function WorkspaceStatusBar(props: WorkspaceStatusBarProps) {
  const compact = props.surface === 'sidepanel';
  return (
    <Flex
      role="status"
      aria-label="workspace status bar"
      align="center"
      justify="space-between"
      style={{
        width: '100%',
        padding: compact ? '4px 8px' : '6px 16px',
        fontSize: compact ? 11 : 12,
      }}
    >
      <WorkspaceStatusBarLeft
        providerName={props.providerName}
        inputTokens={props.inputTokens}
        sessionTokens={props.sessionTokens}
      />
      <WorkspaceStatusBarRight
        mcpEnabled={props.mcpEnabled}
        onHelp={props.onHelp}
        onFeedback={props.onFeedback}
        compact={compact}
      />
    </Flex>
  );
}
