import type { CSSProperties } from 'react';

export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export interface WorkspaceStatusBarLeftProps {
  providerName?: string;
  inputTokens?: number | null;
  sessionTokens?: number | null;
  compact?: boolean;
}

const ICON_COLOR = '#6366F1';
const ITEM_GAP = 2;
const ITEM_MARGIN_END = 6;
const TOKEN_GAP = 5;

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: ITEM_GAP,
  marginInlineEnd: ITEM_MARGIN_END,
  fontSize: 'inherit',
  color: 'var(--ant-color-text-tertiary, rgba(10,13,51,0.6))',
};

const tokenLabelStyle: CSSProperties = {
  paddingLeft: TOKEN_GAP,
};

const wrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  flex: 1,
};

function ZapIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, color: ICON_COLOR, display: 'block' }}
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, color: ICON_COLOR, display: 'block' }}
    >
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

export function WorkspaceStatusBarLeft({
  providerName,
  inputTokens,
  sessionTokens,
  compact: _compact,
}: WorkspaceStatusBarLeftProps) {
  const resolvedProvider = providerName ?? 'NowPilot';
  const hasTokens = inputTokens != null || sessionTokens != null;
  const inText = inputTokens != null ? formatTokenCount(inputTokens) : null;
  const totalSource = sessionTokens ?? inputTokens ?? 0;
  const totalText = hasTokens ? formatTokenCount(totalSource) : null;

  return (
    <div data-workspace-status-bar-left="true" style={wrapperStyle} aria-label="workspace status left">
      <div style={itemStyle} data-status-item="provider">
        <span>{resolvedProvider}</span>
      </div>
      <div style={itemStyle} data-status-item="zap" aria-hidden="true">
        <ZapIcon />
      </div>
      <div style={itemStyle} data-status-item="server" aria-hidden="true">
        <ServerIcon />
      </div>
      {hasTokens ? (
        <div style={itemStyle} data-status-item="tokens">
          <CoinsIcon />
          <span style={tokenLabelStyle}>
            {inText != null ? `In: ${inText} | Total: ${totalText}` : `Total: ${totalText}`}
          </span>
        </div>
      ) : null}
    </div>
  );
}