import { Button, Tooltip, theme } from 'antd';
import type { CSSProperties } from 'react';

interface HelpCenterLinkProps {
  onClick?: () => void;
  compact?: boolean;
}

const iconStyle: CSSProperties = {
  color: 'var(--ant-color-text-tertiary, rgba(10,13,51,0.45))',
};

function HelpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 14 14"
      style={iconStyle}
    >
      <g fill="currentColor">
        <path d="M7 4.025A1.57 1.57 0 0 0 5.425 5.6a.525.525 0 1 1-1.05 0A2.62 2.62 0 0 1 7 2.975 2.625 2.625 0 0 1 8.13 7.97c-.413.197-.605.462-.605.663a.525.525 0 1 1-1.05 0c0-.83.683-1.363 1.202-1.61A1.575 1.575 0 0 0 7 4.025m0 5.892a.583.583 0 0 0 0 1.166h.023a.583.583 0 0 0 0-1.166z" />
        <path
          fillRule="evenodd"
          d="M.642 7a6.358 6.358 0 1 1 12.716 0A6.358 6.358 0 0 1 .642 7M7 1.692a5.308 5.308 0 1 0 0 10.616A5.308 5.308 0 0 0 7 1.692"
          clipRule="evenodd"
        />
      </g>
    </svg>
  );
}

export function HelpCenterLink({ onClick, compact }: HelpCenterLinkProps) {
  const { token: antdToken } = theme.useToken();
  return (
    <Tooltip title="Help Center">
      <Button
        type="text"
        size={compact ? 'small' : 'middle'}
        aria-label="Help Center"
        icon={<HelpIcon />}
        onClick={onClick}
        style={{ color: antdToken.colorTextSecondary }}
      />
    </Tooltip>
  );
}