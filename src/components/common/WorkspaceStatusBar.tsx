import { Flex, theme } from 'antd';
import type { CSSProperties } from 'react';
import { WorkspaceStatusBarLeft, type WorkspaceStatusBarLeftProps } from './WorkspaceStatusBarLeft';
import { WorkspaceStatusBarRight, type WorkspaceStatusBarRightProps } from './WorkspaceStatusBarRight';

export const WORKSPACE_STATUS_BAR_HEIGHT = 38;
export const WORKSPACE_STATUS_BAR_MAX_WIDTH = 790;

export type WorkspaceStatusBarProps = WorkspaceStatusBarLeftProps &
  WorkspaceStatusBarRightProps & {
    surface?: 'sidepanel' | 'standalone';
    height?: number;
    maxWidth?: number;
    /**
     * When `true`, the status bar does not paint its own rounded corners or
     * background — it is flush with the parent shell which owns those styles.
     * Defaults to `true` for both surfaces because the status bar is always
     * rendered inside a rounded shell. Set to `false` to render it standalone.
     */
    flush?: boolean;
  };

export function WorkspaceStatusBar(props: WorkspaceStatusBarProps) {
  const { token } = theme.useToken();
  const compact = props.surface === 'sidepanel';
  const height = props.height ?? WORKSPACE_STATUS_BAR_HEIGHT;
  const maxWidth = props.maxWidth ?? WORKSPACE_STATUS_BAR_MAX_WIDTH;
  const flush = props.flush ?? true;

  const wrapperStyle: CSSProperties = flush
    ? {
        position: 'relative',
        bottom: 0,
        display: 'flex',
        flexShrink: 0,
        height,
        minHeight: height,
        background: 'transparent',
        borderRadius: 0,
        fontSize: compact ? 11 : 12,
      }
    : {
        position: 'relative',
        bottom: 0,
        display: 'flex',
        flexShrink: 0,
        height,
        minHeight: height,
        background: token.colorBgContainer,
        borderBottomLeftRadius: token.borderRadiusLG,
        borderBottomRightRadius: token.borderRadiusLG,
        fontSize: compact ? 11 : 12,
      };

  const innerStyle: CSSProperties = {
    display: 'flex',
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: compact ? '0 8px' : '0 12px',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth,
  };

  return (
    <Flex
      role="status"
      aria-label="workspace status bar"
      align="center"
      justify="space-between"
      data-workspace-status-bar="true"
      data-status-bar-surface={props.surface ?? 'standalone'}
      data-status-bar-flush={flush ? 'true' : 'false'}
      style={wrapperStyle}
    >
      <div data-workspace-status-bar-inner="true" style={innerStyle}>
        <WorkspaceStatusBarLeft
          providerName={props.providerName}
          inputTokens={props.inputTokens}
          sessionTokens={props.sessionTokens}
          compact={compact}
        />
        <WorkspaceStatusBarRight
          onHelp={props.onHelp}
          onFeedback={props.onFeedback}
          compact={compact}
        />
      </div>
    </Flex>
  );
}