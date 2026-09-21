import React from 'react';
import { Typography, theme } from 'antd';
import { DeferredNotice } from '../common/DeferredNotice';
import { t } from '../../core/i18n/strings';

/**
 * Standalone Agent page — `deferred-shell` (D-16, owning roadmap phase 15).
 *
 * The agent runtime arrives with the workspace experience in Phase 15; Phase 1
 * keeps the route and names the owning phase. The root carries
 * `data-np-backing="deferred"`; the bare AntD `Empty` the prototype rendered is
 * replaced by an intentional deferred-state panel (UI-SPEC: `Empty` is never
 * used bare), and no skeleton, fake control or loading indicator is rendered.
 */
export const AgentPage: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <div
      data-np-backing="deferred"
      data-testid="np-page-agent"
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
          {t('agent.empty')}
        </Typography.Title>
      </div>
    </div>
  );
};
