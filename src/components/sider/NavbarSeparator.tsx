import { theme } from 'antd';
import type { CSSProperties } from 'react';

export interface NavbarSeparatorProps {
  surface?: 'standalone' | 'sidepanel';
}

export function NavbarSeparator({ surface = 'standalone' }: NavbarSeparatorProps) {
  const { token } = theme.useToken();

  const style: CSSProperties = {
    width: '100%',
    height: 1,
    flexShrink: 0,
    backgroundColor: token.colorBorderSecondary,
    margin: surface === 'standalone' ? '8px 0' : '6px 0',
  };

  return <div role="separator" aria-orientation="horizontal" data-navbar-separator="true" style={style} />;
}