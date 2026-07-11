import type { ReactNode } from 'react';
import { findNavItem } from '../../core/navigation/navigationSelectors';

export interface StandaloneMainAreaProps {
  activeNavId: string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function StandaloneMainArea({ activeNavId, footer, children }: StandaloneMainAreaProps) {
  const item = findNavItem(activeNavId);
  const fallback = children ?? (
    <div style={{ padding: 24 }} aria-label={item?.label ?? 'Page'}>
      <h1 style={{ marginTop: 0 }}>{item?.label ?? 'Page'}</h1>
      <p>Coming soon.</p>
    </div>
  );
  return (
    <main
      role="main"
      aria-label={item?.label ?? 'Active page content'}
      data-standalone-content={activeNavId}
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ant-color-bg-layout, transparent)',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{fallback}</div>
      {footer ? (
        <div
          style={{
            borderTop: '1px solid var(--ant-color-border-secondary)',
            background: 'var(--ant-color-bg-container)',
          }}
        >
          {footer}
        </div>
      ) : null}
    </main>
  );
}
