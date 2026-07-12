import type { ReactNode } from 'react';
import { findNavItem } from '../../core/navigation/navigationSelectors';

export interface SidepanelContentProps {
  activeNavId: string;
  children?: ReactNode;
}

export function SidepanelContent({ activeNavId, children }: SidepanelContentProps) {
  const item = findNavItem(activeNavId);
  const fallback = children ?? (
    <div style={{ padding: 16 }} aria-label={item?.label ?? 'Page'}>
      <strong>{item?.label ?? 'Page'}</strong>
      <p style={{ marginTop: 8 }}>Coming soon.</p>
    </div>
  );
  return (
    <main
      role="main"
      aria-label={item?.label ?? 'Active page content'}
      data-sidepanel-content={activeNavId}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 4,
        paddingRight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          borderRadius: 12,
          background: 'var(--ant-color-bg-container, transparent)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {fallback}
      </div>
    </main>
  );
}
