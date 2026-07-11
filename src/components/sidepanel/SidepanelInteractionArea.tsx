import type { ReactNode } from 'react';
import { findNavItem } from '../../core/navigation/navigationSelectors';

export interface SidepanelInteractionAreaProps {
  activeNavId: string;
  children?: ReactNode;
}

export function SidepanelInteractionArea({ activeNavId, children }: SidepanelInteractionAreaProps) {
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
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {fallback}
    </main>
  );
}
