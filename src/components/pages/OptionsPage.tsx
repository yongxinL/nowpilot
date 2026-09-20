import React from 'react';
import { Typography, Empty, theme } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { t } from '../../core/i18n/strings';

export const OptionsPage: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: token.paddingLG,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <SettingOutlined style={{ fontSize: 24 }} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          Options
        </Typography.Title>
      </div>

      <Empty description={t('options.loading')}>
        <Typography.Text type="secondary">
          Configuration and settings will be implemented in Phase 7 (Workspace Experience).
          Provider configuration in Phase 3 (AI Runtime).
        </Typography.Text>
      </Empty>
    </div>
  );
};
