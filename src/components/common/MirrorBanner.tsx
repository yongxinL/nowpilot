import React from 'react';
import { Typography, theme } from 'antd';
import { t } from '../../core/i18n/strings';

interface MirrorBannerProps {
  onRefocus: () => void;
}

/**
 * D-05 / REQ-F05: the post-election Side Panel status banner.
 *
 * The **single** surface that reports cross-surface writer state (D-12
 * carry-forward). Its activation is a pure function of authoritative election
 * state — the parent renders it only while the store reports `mirror` — never
 * because the Standalone view merely opened. Every other writer state
 * (`primary`, `election-pending`, `handoff-pending`, `handoff-failed`,
 * `writer-unavailable`) renders no banner, and an election or storage failure
 * uses the notification path instead: the banner never renders an error state,
 * which would be a second, competing error surface.
 *
 * Copy is canonical and resolved through `t()` — no inline user-visible literal
 * survives here (02-UI-SPEC § Copywriting Contract):
 *   - caption `workspace.mirroringNotice`
 *   - action label `workspace.mirrorRefocus`, accessible name
 *     `workspace.mirrorRefocusA11y`
 *
 * Visual contract (UI-SPEC Visual Anchors):
 *   - `min-height: 32px`, full-width, and it **grows** rather than clipping:
 *     the canonical caption wraps at 400 px instead of being cut off
 *   - background: colorPrimaryBg (NOT warning/error — informational)
 *   - hairline colorBorder top + bottom
 *   - caption 12px colorTextBase, action 12px colorPrimary underlined
 *
 * No optimistic state change: the action changes nothing on its own, the
 * banner stays mounted until authoritative election state reports `primary`,
 * and it never hides on click or claims a promotion the election has not
 * acknowledged. No remount on refocus — the parent clears its state and the
 * banner unmounts. No `window.location.reload`.
 */
export const MirrorBanner: React.FC<MirrorBannerProps> = ({ onRefocus }) => {
  const { token } = theme.useToken();

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="mirror-banner"
      style={{
        minHeight: 32,
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
        {t('workspace.mirroringNotice')}
      </Typography.Text>
      <Typography.Link
        onClick={onRefocus}
        // The action returns this surface to primary mode — it performs an
        // action, it does not navigate, so it is announced as a button and
        // carries the keyboard affordances an `<a>` without `href` lacks
        // (02-UI-SPEC § Phase 2 UI Surface Contracts item 2: "a real control
        // ... keyboard-reachable").
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onRefocus();
        }}
        style={{
          fontSize: 12,
          color: token.colorPrimary,
          textDecoration: 'underline',
          lineHeight: '32px',
          cursor: 'pointer',
        }}
        aria-label={t('workspace.mirrorRefocusA11y')}
      >
        {t('workspace.mirrorRefocus')}
      </Typography.Link>
    </div>
  );
};
