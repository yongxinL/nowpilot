import React from 'react';
import { Typography, theme } from 'antd';
import { DeferredNotice } from '../common/DeferredNotice';
import { t } from '../../core/i18n/strings';

/**
 * Standalone Chat page — `deferred-shell` (D-16, owning roadmap phase 15).
 *
 * Only the route and the canonical shell are required in Phase 1: the chat
 * runtime returns in Phase 15. The root carries `data-np-backing="deferred"`
 * and the panel names the owning phase; there is no skeleton (a skeleton
 * reports active loading, and deferred functionality is not loading), no fake
 * control and no loading indicator.
 *
 * Navigation back to an active Phase-1 surface is the Standalone Sider itself
 * (the shell that renders this page), so no duplicate affordance is added.
 */
export const ChatPage: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <div
      data-np-backing="deferred"
      data-testid="np-page-chat"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: token.paddingLG,
      }}
    >
      <div style={{ maxWidth: 520, width: '100%' }}>
        <DeferredNotice backing="deferred" variant="block" phase={15} />
        <Typography.Title level={4} style={{ marginBottom: token.marginXS }}>
          {t('chat.empty')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('chat.emptyBody')}</Typography.Text>
      </div>
    </div>
  );
};
