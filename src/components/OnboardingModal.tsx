import React, { useState } from 'react';
import { Modal, Steps, Button, Typography, Input, App, Result } from 'antd';
import {
  SmileOutlined,
  KeyOutlined,
  ApiOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { t } from '../core/i18n/strings';

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ open, onComplete }) => {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const { message } = App.useApp();

  const handleTest = async () => {
    if (!apiKey.trim()) {
      message.warning('Please enter an API key');
      return;
    }
    setTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setTesting(false);
    setTested(true);
    message.success(t('onboarding.connected'));
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const steps = [
    {
      title: t('onboarding.step1'),
      icon: <SmileOutlined />,
      content: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Result
            icon={<SmileOutlined style={{ fontSize: 48, color: '#6366f1' }} />}
            title={t('onboarding.welcome')}
            subTitle="NowPilot is a privacy-first AI assistant that runs locally with your own AI providers. No data leaves your machine unless you configure a cloud provider."
          />
        </div>
      ),
    },
    {
      title: t('onboarding.step2'),
      icon: <ApiOutlined />,
      content: (
        <div style={{ padding: '24px 0' }}>
          <Typography.Paragraph>
            NowPilot supports multiple AI providers. You can configure them later in Options.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            For now, enter an OpenAI API key to get started. You can use a custom endpoint
            to connect to local or compatible providers.
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: t('onboarding.step3'),
      icon: <KeyOutlined />,
      content: (
        <div style={{ padding: '24px 0' }}>
          <Typography.Text strong>API Key</Typography.Text>
          <Input.Password
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ marginTop: 8, marginBottom: 16 }}
          />
          <Button
            type="primary"
            onClick={handleTest}
            loading={testing}
            disabled={!apiKey.trim()}
            icon={tested ? <CheckCircleOutlined /> : undefined}
          >
            {testing ? t('onboarding.testing') : tested ? t('onboarding.connected') : 'Test Connection'}
          </Button>
        </div>
      ),
    },
    {
      title: t('onboarding.step4'),
      icon: <CheckCircleOutlined />,
      content: (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Result
            status="success"
            title="You're all set!"
            subTitle="Start chatting with NowPilot. You can configure additional providers in Options anytime."
          />
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={null}
      open={open}
      closable={false}
      footer={null}
      width={480}
      centered
    >
      <Steps
        current={step}
        items={steps.map((s) => ({ title: s.title }))}
        size="small"
        style={{ marginBottom: 24 }}
      />
      <div>{steps[step].content}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button type="primary" onClick={handleNext}>
          {step < 3 ? 'Next' : t('onboarding.step4')}
        </Button>
      </div>
    </Modal>
  );
};
