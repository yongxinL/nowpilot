import { theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

export const APPLICATION_FRAME_SHELL_RADIUS = 16;
export const APPLICATION_FRAME_SIDER_RADIUS = 12;

export interface ApplicationFrameProps {
  children?: ReactNode;
  surface: 'standalone' | 'sidepanel';
  className?: string;
}

export function ApplicationFrame({ children, surface, className }: ApplicationFrameProps) {
  const { token } = theme.useToken();

  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: token.colorBgLayout,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    boxShadow: token.boxShadowSecondary,
  };

  return (
    <div
      role="application"
      aria-label={surface === 'standalone' ? 'NowPilot Standalone' : 'NowPilot Side Panel'}
      data-surface={surface}
      data-application-frame="true"
      data-surface-frame={surface}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}