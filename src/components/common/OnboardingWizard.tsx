import React, { useState } from 'react';
import { Modal, Steps, Card, Typography, Button, Space } from 'antd';
import {
  MessageOutlined,
  FileTextOutlined,
  BulbOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const STEPS = [
  { title: 'Chat with AI' },
  { title: 'Capture Knowledge' },
  { title: 'Your Workspace, Your Way' },
];

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ open, onComplete }) => {
  const [step, setStep] = useState(0);

  const stepContent = (idx: number) => {
    switch (idx) {
      case 0:
        return {
          icon: <MessageOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
          heading: 'Chat with AI',
          body: 'Ask questions, brainstorm ideas, and get help with any task — powered by your own AI providers.',
        };
      case 1:
        return {
          icon: <FileTextOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
          heading: 'Capture Knowledge',
          body: 'Save important insights as atomic notes with automatic tagging and organization.',
        };
      case 2:
        return {
          icon: <BulbOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
          heading: 'Your Workspace, Your Way',
          body: 'Toggle between light and dark themes. Open the full app for deep work and configuration.',
        };
      default:
        return { icon: null, heading: '', body: '' };
    }
  };

  const content = stepContent(step);

  return (
    <Modal open={open} closable={false} footer={null} width={480} centered>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Welcome to NowPilot</Title>
        <Text type="secondary">
          Your personal AI assistant and knowledge workspace — right in your browser.
        </Text>
      </div>

      <Steps current={step} size="small" items={STEPS} style={{ marginBottom: 24 }} />

      <Card
        style={{ marginBottom: 24, textAlign: 'center' }}
        styles={{ body: { padding: 24 } }}
      >
        <div
          style={{
            width: '100%',
            height: 120,
            background: '#f5f5f5',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          {content.icon}
        </div>
        <Title level={5} style={{ marginBottom: 8 }}>{content.heading}</Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {content.body}
        </Paragraph>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          type="default"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Previous Step
        </Button>

        {step < 2 ? (
          <Button type="primary" onClick={() => setStep((s) => s + 1)}>
            Next Step
          </Button>
        ) : (
          <Button type="primary" onClick={onComplete}>
            Start Exploring
          </Button>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Button type="link" onClick={onComplete}>
          Skip Onboarding
        </Button>
      </div>
    </Modal>
  );
};
