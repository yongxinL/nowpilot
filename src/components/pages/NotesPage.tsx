import React from 'react';
import { Typography, Empty } from 'antd';
import { t } from '../../core/i18n/strings';

export const NotesPage: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <Empty description={t('notes.empty')}>
        <Typography.Text type="secondary">
          Notes functionality will be implemented in Phase 5 (Knowledge Base).
        </Typography.Text>
      </Empty>
    </div>
  );
};
