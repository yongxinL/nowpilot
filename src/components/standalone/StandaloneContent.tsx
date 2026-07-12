import type { ReactNode } from 'react';
import { findNavItem } from '../../core/navigation/navigationSelectors';

export interface StandaloneContentProps {
  activeNavId: string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function StandaloneContent({ activeNavId, footer, children }: StandaloneContentProps) {
  const item = findNavItem(activeNavId);
  const fallback = children ?? (
    <div
      style={{ padding: '24px 32px' }}
      aria-label={item?.label ?? 'Page'}
      data-standalone-empty-state="true"
    >
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
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '12px 16px 0',
        }}
      >
        {fallback}
      </div>
      {footer ? (
        <div data-standalone-status-bar="true">{footer}</div>
      ) : null}
    </main>
  );
}