import type { ReactNode } from 'react';
import { Flex } from 'antd';

export interface NavGroupProps {
  title?: string;
  children: ReactNode;
  density?: 'expanded' | 'narrow';
  surface?: 'sidepanel' | 'standalone';
}

export function NavGroup({ title, children, density = 'expanded', surface = 'standalone' }: NavGroupProps) {
  const labelVisible = density === 'expanded';
  const padding = labelVisible ? '8px 12px 4px' : '4px 0';
  const fontSize = labelVisible ? 11 : 10;
  return (
    <Flex vertical role="group" aria-label={title} style={{ width: '100%' }}>
      {labelVisible && title ? (
        <div
          style={{
            padding,
            color: 'var(--nowpilot-color-text-tertiary, rgba(0,0,0,0.45))',
            fontSize,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
          aria-hidden={surface === 'sidepanel'}
        >
          {title}
        </div>
      ) : null}
      <Flex vertical role="list" style={{ width: '100%', gap: 4, padding: '0 8px' }}>
        {children}
      </Flex>
    </Flex>
  );
}
