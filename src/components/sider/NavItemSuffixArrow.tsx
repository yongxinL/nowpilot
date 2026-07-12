import { theme } from 'antd';
import type { CSSProperties } from 'react';

export interface NavItemSuffixArrowProps {
  visible?: boolean;
}

export function NavItemSuffixArrow({ visible = true }: NavItemSuffixArrowProps) {
  const { token } = theme.useToken();

  if (!visible) return null;

  const wrapperStyle: CSSProperties = {
    flexShrink: 0,
    color: token.colorTextTertiary,
    width: 16,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `transform ${token.motionDurationMid} ${token.motionEaseOut}`,
  };

  return (
    <span
      aria-hidden="true"
      data-nav-item-suffix-arrow="true"
      style={wrapperStyle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 16 16"
        style={{ display: 'block' }}
      >
        <path
          fill="currentColor"
          d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"
        />
      </svg>
    </span>
  );
}