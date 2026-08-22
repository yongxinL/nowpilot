import React from 'react';
import { Typography, Card, Tag } from 'antd';
import { TeamOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export const TeamsPanel: React.FC = () => {
  return (
    <div style={{
            height: '100%',
            overflowY: 'auto',
            padding: 24,
            maxWidth: 896,
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
          }}>
      <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}>
        <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}>
          <TeamOutlined />
        </div>
        <Title level={2} style={{ margin: 0 }}>
          Teams & Collaborative Workspaces
        </Title>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Share prompts, team models, and research workspaces across your organization.
      </Paragraph>

      <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 16,
          }}>
        <Card title="Shared Prompt Library" size="small">
          <p style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginBottom: 12,
          }}>
            Synchronize company-wide AI prompt templates and workflows across members.
          </p>
          <Tag color="green">14 Active Team Prompts</Tag>
        </Card>
        <Card title="Shared Model Access" size="small">
          <p style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginBottom: 12,
          }}>
            Centralized API key management with usage limits and quota protection.
          </p>
          <Tag color="blue">Managed Endpoint</Tag>
        </Card>
      </div>
    </div>
  );
};
