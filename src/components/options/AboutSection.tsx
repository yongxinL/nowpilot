import React from 'react';
import { Typography, Descriptions, Space, Tag } from 'antd';

const { Title, Paragraph, Link } = Typography;

export function AboutSection() {
  const appVersion = '0.1.0';
  const buildDate = '2026-07-13';
  const credits = [
    { name: 'Ant Design', url: 'https://ant.design', role: 'UI Framework' },
    { name: 'Ant Design X', url: 'https://x.ant.design', role: 'AI Chat Components' },
    { name: 'WXT', url: 'https://wxt.dev', role: 'Extension Framework' },
    { name: 'Vercel AI SDK', url: 'https://sdk.vercel.ai', role: 'AI Provider Adapters' },
    { name: 'Zustand', url: 'https://zustand-demo.pmnd.rs', role: 'State Management' },
    { name: 'IndexedDB (idb)', url: 'https://github.com/jakearchibald/idb', role: 'Storage' },
  ];

  return (
    <div data-options-section="about" style={{ maxWidth: 720 }}>
      <Title level={4}>About NowPilot</Title>

      <Descriptions column={1} bordered size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Version">{appVersion}</Descriptions.Item>
        <Descriptions.Item label="Build Date">{buildDate}</Descriptions.Item>
        <Descriptions.Item label="Runtime">Chrome MV3 Extension</Descriptions.Item>
        <Descriptions.Item label="Privacy">
          <Tag color="green">Privacy First</Tag>
          All data processed locally against user-configured providers.
        </Descriptions.Item>
      </Descriptions>

      <Title level={5}>Credits</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {credits.map((credit) => (
          <div key={credit.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href={credit.url} target="_blank" rel="noopener noreferrer">
              {credit.name}
            </Link>
            <span style={{ fontSize: 12, color: '#888' }}>{credit.role}</span>
          </div>
        ))}
      </div>

      <Paragraph type="secondary" style={{ marginTop: 24, fontSize: 12 }}>
        NowPilot is not affiliated with ServiceNow. ServiceNow is a registered trademark of
        ServiceNow, Inc. Use of third-party libraries subject to their respective licenses.
      </Paragraph>
    </div>
  );
}
