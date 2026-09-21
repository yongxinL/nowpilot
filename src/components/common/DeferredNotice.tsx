import React from 'react';
import { Alert, Tag, Tooltip, Typography, theme } from 'antd';
import { format, t } from '../../core/i18n/strings';

/**
 * The Phase-1 fixture/deferred marking convention — one component, one type,
 * one greppable DOM attribute.
 *
 * ## The DOM convention
 *
 * Every region whose behaviour is **not** production-live carries the marker
 * attribute (`data-np-` + `backing`) with one of the two `Phase1Backing`
 * literals on its **outermost** element. The value is always a literal from
 * `Phase1Backing` — never an ad-hoc string, never a template literal, never a
 * variable. Live regions carry **no** attribute at all, and this component
 * never renders the attribute itself: the marker belongs to the marked region,
 * so a marker cannot be applied twice or by accident.
 *
 * A repository-wide scan for the marker attribute is the single audit surface
 * for the rule, and `tests/components/pages/chat-page.test.tsx` enforces both
 * directions (no third value anywhere; every preserved page marked). The
 * attribute name is spelled out only in the regions themselves — this doc
 * comment deliberately does not repeat it, so a provenance note cannot trip
 * the scan it describes.
 *
 * ## The six hard rules (UI-SPEC § Fixture-Backed & Deferred Marking)
 *
 * 1. No present-but-inert control may appear enabled and functional. It is
 *    either `disabled` + marked, or not rendered at all.
 * 2. Absent elements need no marker. Absence makes no claim, so an omitted
 *    account block or an omitted Add-ons group is not marked.
 * 3. No fabricated signal: no green health dot, no fake provider or model
 *    name, no simulated stream, no timer-driven success, and no fixture value
 *    presented as user data.
 * 4. No fixture data reaches a persistent store — not `chrome.storage`, not
 *    IndexedDB, not `localStorage`/`sessionStorage`, not the URL, not
 *    `BroadcastBus`, not `RuntimeEnvelope`, not logs, diagnostics, exports,
 *    snapshots or screenshot fixtures.
 * 5. Markers are **removed**, never weakened, when a later phase makes the
 *    behaviour live. A stale marker is a defect.
 * 6. The marker is not a substitute for a region's real states: a live control
 *    still needs its own loading/error/disabled treatment. A skeleton is never
 *    a deferred state.
 */

/** The two Phase-1 backing literals. There is no third value. */
export type Phase1Backing = 'fixture' | 'deferred';

export interface DeferredNoticeProps {
  /**
   * The region's backing state. Absent (or not one of the two literals) means
   * the region is live, so the component renders nothing.
   */
  backing?: Phase1Backing;
  /**
   * `inline` → an AntD `Tag` placed immediately adjacent to the affected
   * control. `block` → an AntD warning `Alert` at the top of the affected
   * region. Both are visible without hover.
   */
  variant?: 'inline' | 'block';
  /**
   * The roadmap phase that owns the functionality. When supplied, the
   * canonical owning-phase sentence (`deferred.phaseBody`) is appended to the
   * block body and to the accessible label.
   */
  phase?: number;
  /**
   * Optional extra detail rendered in a `Tooltip`. The tooltip is **additive**:
   * the visible marker and its full-sentence `aria-label` stand on their own
   * without it.
   */
  tooltip?: string;
  style?: React.CSSProperties;
}

/** Narrow an arbitrary value to a `Phase1Backing` literal, or `null`. */
export function resolveBacking(backing?: Phase1Backing): Phase1Backing | null {
  return backing === 'fixture' || backing === 'deferred' ? backing : null;
}

/** The short, always-visible marker copy for a backing value. */
export function deferredShortCopy(backing: Phase1Backing): string {
  return backing === 'fixture' ? t('deferred.fixtureTag') : t('deferred.tag');
}

/**
 * The **full sentence** a marker discloses — the reason copy, plus the
 * owning-phase sentence when one is supplied. This is what the accessible
 * label carries; the short copy is never used as the label.
 */
export function deferredSentence(backing: Phase1Backing, phase?: number): string {
  const reason =
    backing === 'fixture' ? t('deferred.reasonFixture') : t('deferred.reasonDeferred');
  if (phase === undefined) return reason;
  return `${reason} ${format('deferred.phaseBody', { phase })}`;
}

/**
 * One of the two AntD elements — warning-toned, visible without hover, and
 * always carrying the full sentence as its accessible name.
 */
export const DeferredNotice: React.FC<DeferredNoticeProps> = ({
  backing,
  variant = 'inline',
  phase,
  tooltip,
  style,
}) => {
  const { token } = theme.useToken();
  const resolved = resolveBacking(backing);

  // Absence is expressible: no backing value means the region is live, so
  // there is no marker to render.
  if (resolved === null) return null;

  const sentence = deferredSentence(resolved, phase);

  if (variant === 'block') {
    return (
      <Alert
        type="warning"
        showIcon
        aria-label={sentence}
        title={deferredShortCopy(resolved)}
        description={<Typography.Text>{sentence}</Typography.Text>}
        style={style}
      />
    );
  }

  const tag = (
    <Tag
      aria-label={sentence}
      style={{
        marginInlineStart: token.marginXS,
        color: token.colorWarningText,
        background: token.colorWarningBg,
        borderColor: token.colorWarningBorder,
        ...style,
      }}
    >
      {deferredShortCopy(resolved)}
    </Tag>
  );

  return tooltip ? <Tooltip title={tooltip}>{tag}</Tooltip> : tag;
};
