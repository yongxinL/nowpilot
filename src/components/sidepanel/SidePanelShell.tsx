import React, { useState } from 'react';
import { Button, Tooltip, Typography, theme } from 'antd';
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
import { t } from '../../core/i18n/strings';

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

export interface SidePanelShellProps {
  onOpenStandalone: () => void;
  onOpenOptions: () => void;
}

/**
 * Side Panel — Chat only (UI-SPEC § Phase 1 Surface Contracts).
 *
 * Compact density, no `Layout`, no navigation rail, exactly two trailing
 * header controls. Everything that is not live in Phase 1 is either a live
 * control (the composer draft) or `disabled` + `data-np-backing="deferred"`
 * with a tooltip — never an enabled control whose behaviour does not exist.
 */
export const SidePanelShell: React.FC<SidePanelShellProps> = ({
  onOpenStandalone,
  onOpenOptions,
}) => {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState('');

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

      {/* Conversation — fills and scrolls. Phase 1 renders the empty state
          only; no fabricated messages, no skeleton. */}
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
        <NowPilotAvatar size={64} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('chat.empty')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {t('chat.emptyBody')}
        </Typography.Paragraph>
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
            onChange={(event) => setDraft(event.target.value)}
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
