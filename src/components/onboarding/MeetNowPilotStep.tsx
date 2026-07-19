import React from 'react';
import { Typography, theme, Avatar, Flex } from 'antd';
import { BunnyAvatar } from '../common/BunnyAvatar';

const { Text, Title } = Typography;

export interface MeetNowPilotStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function MeetNowPilotStep({ onContinue, onSkip }: MeetNowPilotStepProps) {
  const { token } = theme.useToken();

  const capabilities = [
    { title: 'Summarize Pages', desc: 'Extract key insights from any page' },
    { title: 'Research Topics', desc: 'Search and synthesize information' },
    { title: 'Draft Responses', desc: 'Write professional replies' },
    { title: 'Explain Code', desc: 'Break down complex code/errors' },
  ];

  return (
    <div style={{ textAlign: 'center', padding: token.padding }}>
      {/* Bunny avatar */}
      <Avatar
        size={64}
        icon={<BunnyAvatar />}
        style={{ border: `2px solid ${token.colorPrimary}`, marginBottom: token.marginMD }}
      />
      {/* Identity */}
      <Title level={3} style={{ marginBottom: 4 }}>Meet NowPilot</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: token.marginMD }}>
        Your AI work co-pilot
      </Text>
      {/* Core values */}
      <Flex wrap="wrap" justify="center" gap={token.marginXS} style={{ marginBottom: token.marginLG }}>
        {['Privacy-first', 'Helpful', 'Precise', 'Humble'].map((v) => (
          <span key={v} style={{
            padding: '2px 10px', borderRadius: 12, fontSize: 11,
            background: token.colorFillSecondary, color: token.colorTextSecondary,
          }}>{v}</span>
        ))}
      </Flex>
      {/* Capability preview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: token.marginXS, marginBottom: token.marginLG }}>
        {capabilities.map((c) => (
          <div key={c.title} style={{
            padding: token.paddingXS, borderRadius: token.borderRadius,
            background: token.colorBgLayout, border: `1px solid ${token.colorBorderSecondary}`,
            textAlign: 'left',
          }}>
            <Text strong style={{ fontSize: 12 }}>{c.title}</Text>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{c.desc}</Text>
          </div>
        ))}
      </div>
      {/* CTA buttons */}
      <button
        onClick={onContinue}
        style={{
          width: '100%', background: '#e0582e', color: '#fff', padding: '10px 16px',
          borderRadius: 10, fontWeight: 'bold', fontSize: 14, border: 'none', cursor: 'pointer',
          marginBottom: token.marginSM,
        }}
      >
        Continue
      </button>
      <button
        onClick={onSkip}
        style={{
          background: 'transparent', border: 'none', color: token.colorTextQuaternary,
          fontSize: 13, cursor: 'pointer',
        }}
      >
        Skip for now
      </button>
    </div>
  );
}
