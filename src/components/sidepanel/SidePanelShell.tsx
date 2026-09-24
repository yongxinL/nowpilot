import React, { useState } from 'react';
import { Button, Skeleton, Tooltip, Typography, theme } from 'antd';
import {
  SettingOutlined,
  ExpandAltOutlined,
  PaperClipOutlined,
  HistoryOutlined,
  FormOutlined,
  ArrowUpOutlined,
  QuestionCircleOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { MirrorBanner } from '../common/MirrorBanner';
import { t } from '../../core/i18n/strings';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { requestRefocus } from '../../core/workspace/WriterElection';
import { useExtensionStore, type HydrationStatus } from '../../store/useExtensionStore';

/**
 * The Phase-1 workflow display label. The workflow registry is Phase 15
 * (DEC-HTML-01 forbids exposing a raw model identifier), so Phase 1 renders
 * the canonical default `Auto` as a **non-interactive read-only** display.
 */
const WORKFLOW_DISPLAY_LABEL = 'Auto';

const HEADER_HEIGHT = 52;
const TOOLBAR_HEIGHT = 44;
const STATUS_BAR_HEIGHT = 28;
const INPUT_MIN_HEIGHT = 60;
const INPUT_MAX_HEIGHT = 160;

/**
 * The conversation region's presentation for one D2-18 hydration status
 * (02-UI-SPEC § Phase 2 UI Surface Contracts item 1). One status, one
 * treatment — no status falls through to another's presentation:
 *
 *   `idle`              — nothing at all: before a read is attempted the
 *                         region makes no hydration-dependent claim, so it
 *                         renders neither the empty presentation nor a ready
 *                         one
 *   `hydrating`         — an AntD `Skeleton` filling the region. Content areas
 *                         use skeletons; an inline spinner is reserved for
 *                         inline and in-button use, so it never appears here
 *   `ready`             — the hydrated projection. Phase 2 ships no
 *                         conversation renderer (D2-18: do not redesign the
 *                         Chat interface), so the projection stays reachable
 *                         through the store contract and the conversation list
 *                         itself is Phase 15's. The region is deliberately
 *                         blank in this state, not blank by omission
 *   `empty`             — the approved empty presentation, reachable **only**
 *                         from a successful read that found nothing
 *   `failed`            — the pinned failure line plus the retry action
 *   `recovery required` — the same presentation; retry re-drives recovery
 *                         without discarding the recoverable journal state
 *
 * The typed hydration error is deliberately never rendered: the region names
 * no record id, storage key, journal stage or error code (D2-11/D2-13/D2-16).
 */
function conversationRegionContent(status: HydrationStatus, retry: () => void): React.ReactNode {
  switch (status) {
    case 'idle':
    case 'ready':
      return null;

    case 'hydrating':
      return <Skeleton active style={{ width: '100%' }} />;

    case 'empty':
      return (
        <>
          <NowPilotAvatar size={64} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('chat.empty')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t('chat.emptyBody')}
          </Typography.Paragraph>
        </>
      );

    case 'failed':
    case 'recovery required':
      return (
        <>
          <Typography.Title level={4} type="danger" style={{ margin: 0 }}>
            {t('storage.hydrationFailed')}
          </Typography.Title>
          <Button type="link" onClick={retry}>
            {t('common.retry')}
          </Button>
        </>
      );
  }
}

export interface SidePanelShellProps {
  onOpenStandalone: () => void;
  onOpenOptions: () => void;
  /**
   * WR-07 / D-13: reports the live composer draft to the surface root, which
   * hands it to `openStandalone`. The draft travels through the validated
   * handoff projection only — never the URL, never storage. The shell keeps
   * owning the textarea state; this is a notification, not a lift.
   */
  onDraftChange?: (draft: string) => void;
}

/**
 * Side Panel — Chat only (UI-SPEC § Phase 1 Surface Contracts, extended by
 * the Phase-2 hydration contract below).
 *
 * Compact density, no `Layout`, no navigation rail, exactly two trailing
 * header controls. Everything that is not live in Phase 1 is either a live
 * control (the composer draft) or `disabled` + `data-np-backing="deferred"`
 * with a tooltip — never an enabled control whose behaviour does not exist.
 *
 * Phase 2 makes the conversation region live: it renders the store's six
 * hydration states (D2-18) and nothing else changes with them. The region is
 * live behaviour, so it is never marked deferred.
 */
export const SidePanelShell: React.FC<SidePanelShellProps> = ({
  onOpenStandalone,
  onOpenOptions,
  onDraftChange,
}) => {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState('');
  // D2-18: the conversation region is driven by the store's hydration status
  // and nothing else. The read path lives in the store (it hydrates, recovers
  // the journal, migrates and validates) — this shell never touches
  // IndexedDB, a transaction, the journal or the legacy blob (D2-20).
  const hydrationStatus = useExtensionStore((state) => state.hydrationStatus);
  const retryHydration = useExtensionStore((state) => state.retryHydration);
  // D-12 / D2-34: the banner's visibility is a pure function of the store's
  // writer state. The shell derives no mirror decision, holds no local flag and
  // is never told by an event — a surface that merely *opened* is not a mirror.
  const writerState = useWorkspaceStore((state) => state.writerState);

  const iconButtonStyle: React.CSSProperties = {
    color: token.colorTextSecondary,
    width: 32,
    height: 32,
  };

  /**
   * The three composer actions and the send control are Phase-15/16
   * capabilities. They are rendered `disabled` and marked so the words and
   * the control agree — no fabricated response, no simulated stream, no
   * timer-driven success.
   */
  const deferredControls: {
    key: string;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: 'attach', label: t('a11y.attach'), icon: <PaperClipOutlined /> },
    { key: 'history', label: t('a11y.chatHistory'), icon: <HistoryOutlined /> },
    { key: 'new-chat', label: t('a11y.newChat'), icon: <FormOutlined /> },
  ];

  return (
    <div
      data-testid="np-sidepanel-shell"
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: token.colorBgLayout,
        color: token.colorText,
        fontFamily: token.fontFamily,
      }}
    >
      {/* Header — 52px. Exactly two trailing controls (no provider chip,
          no nav rail, no theme control). */}
      <header
        style={{
          height: HEADER_HEIGHT,
          minHeight: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: token.padding,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          backgroundColor: token.colorBgContainer,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: token.paddingXS }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: token.borderRadiusSM,
              backgroundColor: token.colorPrimary,
              color: token.colorTextLightSolid,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            N
          </span>
          <Typography.Text strong>{t('app.name')}</Typography.Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: token.paddingXS }}>
          <Tooltip title={t('a11y.options')}>
            <Button
              type="text"
              style={iconButtonStyle}
              icon={<SettingOutlined />}
              aria-label={t('a11y.options')}
              onClick={onOpenOptions}
            />
          </Tooltip>
          <Tooltip title={t('a11y.switchToFullChat')}>
            <Button
              type="text"
              style={iconButtonStyle}
              icon={<ExpandAltOutlined />}
              aria-label={t('a11y.switchToFullChat')}
              onClick={onOpenStandalone}
            />
          </Tooltip>
        </div>
      </header>

      {/* The single cross-surface status banner (D-12 carry-forward, D2-34),
          immediately above the conversation region and mounted for exactly one
          writer state. Its action asks the registered election to promote this
          surface and changes nothing locally: a promotion unmounts the banner
          through authoritative state, and a refocus that does not reach
          primary reports through the election-failure channel. No optimistic
          hide, no success message, no reload. */}
      {writerState === 'mirror' && (
        <MirrorBanner
          onRefocus={() => {
            void requestRefocus();
          }}
        />
      )}

      {/* Conversation — fills and scrolls. The region varies only with the
          store's hydration status (D2-18); the header, composer, toolbar and
          status bar are unchanged by it. The region is live behaviour, so it
          carries no `data-np-backing` marker — a marker here would declare a
          capability this surface actually has. */}
      <main
        data-testid="np-sidepanel-conversation"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowAnchor: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: token.paddingSM,
          padding: token.paddingLG,
          textAlign: 'center',
        }}
      >
        {conversationRegionContent(hydrationStatus, () => {
          void retryHydration();
        })}
      </main>

      {/* Composer block — toolbar (44px) → input (min 60px) → status bar (28px). */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          backgroundColor: token.colorBgContainer,
        }}
      >
        <div
          data-testid="np-composer-toolbar"
          style={{
            height: TOOLBAR_HEIGHT,
            minHeight: TOOLBAR_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: token.padding,
          }}
        >
          <span
            data-testid="np-workflow-control"
            style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}
          >
            {WORKFLOW_DISPLAY_LABEL}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: token.paddingXS }}>
            {deferredControls.map((control) => (
              <Tooltip key={control.key} title={control.label}>
                <span>
                  <Button
                    type="text"
                    disabled
                    data-np-backing="deferred"
                    style={iconButtonStyle}
                    icon={control.icon}
                    aria-label={control.label}
                  />
                </span>
              </Tooltip>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', paddingInline: token.padding }}>
          <textarea
            data-testid="np-composer-input"
            aria-label={t('chat.composerPlaceholder')}
            placeholder={t('chat.composerPlaceholder')}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              onDraftChange?.(event.target.value);
            }}
            onKeyDown={(event) => {
              // Enter must not send in Phase 1 (the send path is disabled);
              // Shift+Enter keeps its newline.
              if (event.key === 'Enter' && !event.shiftKey) event.preventDefault();
            }}
            style={{
              width: '100%',
              minHeight: INPUT_MIN_HEIGHT,
              maxHeight: INPUT_MAX_HEIGHT,
              resize: 'none',
              overflowY: 'auto',
              borderRadius: 12,
              border: `1px solid ${token.colorBorder}`,
              backgroundColor: token.colorBgContainer,
              color: token.colorText,
              fontFamily: token.fontFamily,
              fontSize: token.fontSize,
              padding: token.paddingSM,
              paddingBottom: 40,
              outline: 'none',
            }}
          />
          <Tooltip title={t('a11y.send')}>
            <span
              style={{
                position: 'absolute',
                right: token.padding + token.paddingXS,
                bottom: token.paddingXS,
              }}
            >
              <Button
                data-testid="np-composer-send"
                data-np-backing="deferred"
                shape="circle"
                type="primary"
                disabled
                icon={<ArrowUpOutlined />}
                aria-label={t('a11y.send')}
              />
            </span>
          </Tooltip>
        </div>

        {/* Status bar — 28px. No provider is resolved in Phase 1, so the
            caption states that instead of inventing a provider or a health
            signal. The dot is neutral and always paired with text. */}
        <div
          data-testid="np-status-bar"
          style={{
            height: STATUS_BAR_HEIGHT,
            minHeight: STATUS_BAR_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: token.padding,
            color: token.colorTextTertiary,
            fontSize: token.fontSizeSM,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: token.paddingXS,
              minWidth: 0,
            }}
          >
            <span data-testid="np-status-workflow">{WORKFLOW_DISPLAY_LABEL}</span>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: token.colorTextQuaternary,
                flexShrink: 0,
              }}
            />
            <span
              data-testid="np-status-caption"
              title={t('chat.noProvider')}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {t('chat.noProvider')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: token.paddingXS }}>
            <Tooltip title={t('a11y.help')}>
              <span>
                <Button
                  type="text"
                  disabled
                  data-np-backing="deferred"
                  size="small"
                  style={{ color: token.colorTextTertiary }}
                  icon={<QuestionCircleOutlined />}
                  aria-label={t('a11y.help')}
                />
              </span>
            </Tooltip>
            <Tooltip title={t('a11y.feedback')}>
              <span>
                <Button
                  type="text"
                  disabled
                  data-np-backing="deferred"
                  size="small"
                  style={{ color: token.colorTextTertiary }}
                  icon={<MailOutlined />}
                  aria-label={t('a11y.feedback')}
                />
              </span>
            </Tooltip>
          </div>
        </div>
      </section>
    </div>
  );
};
