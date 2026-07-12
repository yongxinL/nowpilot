import type { CSSProperties, MouseEvent } from 'react';

export interface WorkspaceStatusBarRightProps {
  onHelp?: () => void;
  onFeedback?: () => void;
  compact?: boolean;
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
};

const linkBaseStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: 24,
  height: 24,
  cursor: 'pointer',
  color: 'var(--ant-color-text-tertiary, rgba(10,13,51,0.45))',
  background: 'transparent',
  border: 'none',
  padding: 0,
};

const iconBoxStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

function HelpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden="true">
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

function FeedbackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden="true">
      <g fill="currentColor">
        <path d="M4.571 4.762a.525.525 0 0 0-.742.743L5.144 6.82a2.625 2.625 0 0 0 3.712 0l1.315-1.315a.525.525 0 1 0-.742-.743L8.114 6.077a1.575 1.575 0 0 1-2.228 0z" />
        <path
          fillRule="evenodd"
          d="M9.496 1.575H4.504c-.569 0-1.028 0-1.4.03-.382.032-.718.098-1.03.256A2.63 2.63 0 0 0 .929 3.008c-.159.311-.225.647-.256 1.03-.03.372-.03.83-.03 1.4v3.124c0 .57 0 1.028.03 1.4.031.383.097.719.256 1.03.251.494.653.895 1.147 1.147.31.158.647.224 1.03.256.371.03.83.03 1.4.03h4.99c.57 0 1.029 0 1.4-.03.383-.032.72-.098 1.03-.256a2.62 2.62 0 0 0 1.147-1.147c.159-.311.225-.647.256-1.03.03-.372.03-.83.03-1.4V5.438c0-.57 0-1.028-.03-1.4-.031-.383-.097-.719-.256-1.03a2.63 2.63 0 0 0-1.147-1.147c-.31-.158-.647-.224-1.03-.256-.371-.03-.83-.03-1.4-.03M2.552 2.797c.138-.07.32-.12.638-.145.324-.027.74-.027 1.337-.027h4.946c.597 0 1.013 0 1.337.027.318.026.5.074.638.145.297.15.538.392.689.688.07.138.118.32.144.638.027.324.027.74.027 1.337v3.08c0 .597 0 1.013-.027 1.336-.026.318-.074.5-.144.639a1.58 1.58 0 0 1-.689.688c-.138.07-.32.12-.638.145-.324.026-.74.027-1.337.027H4.527c-.597 0-1.013 0-1.337-.027-.318-.026-.5-.074-.638-.145a1.58 1.58 0 0 1-.689-.688c-.07-.138-.119-.32-.144-.639-.027-.323-.027-.74-.027-1.336V5.46c0-.597 0-1.013.027-1.337.025-.317.074-.5.144-.638.151-.296.392-.537.689-.688"
          clipRule="evenodd"
        />
      </g>
    </svg>
  );
}

export function WorkspaceStatusBarRight({
  onHelp,
  onFeedback,
  compact: _compact,
}: WorkspaceStatusBarRightProps) {
  const handleClick = (handler?: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handler?.();
  };

  return (
    <div
      data-workspace-status-bar-right="true"
      style={wrapperStyle}
      aria-label="workspace status right"
    >
      <button
        type="button"
        aria-label="Help Center"
        data-status-action="help"
        onClick={handleClick(onHelp)}
        style={linkBaseStyle}
      >
        <span style={iconBoxStyle}>
          <HelpIcon />
        </span>
      </button>
      <button
        type="button"
        aria-label="Feedback"
        data-status-action="feedback"
        onClick={handleClick(onFeedback)}
        style={linkBaseStyle}
      >
        <span style={iconBoxStyle}>
          <FeedbackIcon />
        </span>
      </button>
    </div>
  );
}