import { theme } from 'antd';
import type { ReactNode } from 'react';

export interface StickyTableWrapperProps {
  children?: ReactNode;
}

export function StickyTableWrapper({ children, ...props }: StickyTableWrapperProps) {
  const { token } = theme.useToken();

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <style>{`
        .sticky-header-table { border-collapse: collapse; width: 100%; }
        .sticky-header-table thead th {
          position: sticky; top: 0;
          background: ${token.colorBgContainer};
          z-index: 1;
        }
        .sticky-header-table thead th::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0;
          border-bottom: 1px solid ${token.colorBorderSecondary};
        }
      `}</style>
      <table className="sticky-header-table" {...props}>
        {children}
      </table>
    </div>
  );
}
