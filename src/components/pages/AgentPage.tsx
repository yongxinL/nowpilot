import React from 'react';
import { Typography, Empty } from 'antd';
import { t } from '../../core/i18n/strings';

export const AgentPage: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <Empty description={t('agent.empty')}>
        <Typography.Text type="secondary">
          Agent functionality will be implemented in Phase 3 (AI Runtime) and Phase 7 (UI/UX).
        </Typography.Text>
      </Empty>
    </div>
  );
};
