import React from 'react';
import { Typography, theme } from 'antd';

interface MirrorBannerProps {
  onRefocus: () => void;
}

/**
 * D-05 / REQ-F05: the post-handoff Side Panel status banner.
 *
 * Shows when the Side Panel has been demoted to a read-only mirror after
 * a WORKSPACE_HANDOFF broadcast (the Standalone view took primary
 * authorship of the workspace). The disabled composer in ChatComposer
 * communicates the same state — this banner makes the cause explicit and
 * offers a one-click "Refocus here" path back to primary mode.
 *
 * Visual contract (UI-SPEC Visual Anchors):
 *   - 32px tall, full-width
 *   - background: colorPrimaryBg (NOT warning/error — informational)
 *   - hairline colorBorder top + bottom
 *   - left caption "Switched to Standalone." (12px, colorTextBase)
 *   - right action "Refocus here" (12px, colorPrimary, underlined)
 *
 * No remount on refocus — parent clears `mirrored` state, banner
 * unmounts. No `window.location.reload`.
 */
export const MirrorBanner: React.FC<MirrorBannerProps> = ({ onRefocus }) => {
  const { token } = theme.useToken();

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="mirror-banner"
      style={{
        height: 32,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: token.colorPrimaryBg,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <Typography.Text
        style={{
          fontSize: 12,
          color: token.colorTextBase,
          lineHeight: '32px',
        }}
      >
        Switched to Standalone.
      </Typography.Text>
      <Typography.Link
        onClick={onRefocus}
        style={{
          fontSize: 12,
          color: token.colorPrimary,
          textDecoration: 'underline',
          lineHeight: '32px',
          cursor: 'pointer',
        }}
        aria-label="Refocus here and return to primary chat mode"
      >
        Refocus here
      </Typography.Link>
    </div>
  );
};
