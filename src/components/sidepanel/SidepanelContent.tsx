import type { CSSProperties, ReactNode } from 'react';
import { theme } from 'antd';
import { findNavItem } from '../../core/navigation/navigationSelectors';
import {
  WorkspaceStatusBar,
  type WorkspaceStatusBarProps,
} from '../common/WorkspaceStatusBar';

export interface SidepanelContentProps {
  activeNavId: string;
  children?: ReactNode;
  showStatusBar?: boolean;
  statusBarProps?: Omit<WorkspaceStatusBarProps, 'surface'>;
}

const MAIN_PADDING = 4;
const SHELL_RADIUS = 12;

export function SidepanelContent({
  activeNavId,
  children,
  showStatusBar = true,
  statusBarProps,
}: SidepanelContentProps) {
  const { token } = theme.useToken();
  const item = findNavItem(activeNavId);
  const fallback = children ?? (
    <div
      style={{ padding: '24px 24px', height: '100%', boxSizing: 'border-box' }}
      aria-label={item?.label ?? 'Page'}
      data-sidepanel-empty-state="true"
    >
      <strong style={{ fontSize: 16 }}>{item?.label ?? 'Page'}</strong>
      <p style={{ marginTop: 8 }}>Coming soon.</p>
    </div>
  );

  const mainStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: MAIN_PADDING,
    paddingRight: MAIN_PADDING,
    paddingBottom: MAIN_PADDING,
    overflow: 'hidden',
  };

  const shellStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: SHELL_RADIUS,
    background: token.colorBgContainer,
    display: 'flex',
    flexDirection: 'column',
  };

  const scrollableStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 0,
  };

  return (
    <main
      role="main"
      aria-label={item?.label ?? 'Active page content'}
      data-sidepanel-content={activeNavId}
      style={mainStyle}
    >
      <div data-sidepanel-content-shell="true" style={shellStyle}>
        <div style={scrollableStyle}>{fallback}</div>
        {showStatusBar ? (
          <WorkspaceStatusBar surface="sidepanel" flush {...(statusBarProps ?? {})} />
        ) : null}
      </div>
    </main>
  );
}