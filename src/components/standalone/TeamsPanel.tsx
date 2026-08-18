import React from 'react';
import { Typography, Card, Tag } from 'antd';
import { TeamOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export const TeamsPanel: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto p-6 sm:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
          <TeamOutlined />
        </div>
        <Title level={2} style={{ margin: 0 }}>
          Teams & Collaborative Workspaces
        </Title>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Share prompts, team models, and research workspaces across your organization.
      </Paragraph>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Shared Prompt Library" size="small">
          <p className="text-xs text-zinc-500 mb-3">
            Synchronize company-wide AI prompt templates and workflows across members.
          </p>
          <Tag color="green">14 Active Team Prompts</Tag>
        </Card>
        <Card title="Shared Model Access" size="small">
          <p className="text-xs text-zinc-500 mb-3">
            Centralized API key management with usage limits and quota protection.
          </p>
          <Tag color="blue">Managed Endpoint</Tag>
        </Card>
      </div>
    </div>
  );
};
