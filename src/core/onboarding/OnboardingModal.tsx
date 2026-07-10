import React, { useState } from 'react';
import { Modal, Steps, Button, Space, Select, Input, Typography, Result, App } from 'antd';

const { Paragraph } = Typography;

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

const steps = [{ title: 'Welcome' }, { title: 'Provider' }, { title: 'API Key' }, { title: 'Done' }];

const providerOptions = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'custom', label: 'OpenAI-Compatible' },
];

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const { message } = App.useApp();

  const handleNext = () => {
    if (step === 1 && !selectedProvider) {
      message.warning('Please select a provider');
      return;
    }
    if (step === 2) {
      if (!selectedProvider) {
        message.warning('Please select a provider first');
        return;
      }
      if (selectedProvider !== 'ollama' && !apiKey.trim()) {
        message.warning('Please enter your API key');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => Math.max(0, s - 1));
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <Paragraph>
            NowPilot is your privacy-first AI assistant. Everything runs locally — no data leaves your
            machine. Let's set up your first AI provider.
          </Paragraph>
        );
      case 1:
        return (
          <div>
            <Paragraph>Select your AI provider</Paragraph>
            <Select
              style={{ width: '100%' }}
              placeholder="Choose a provider..."
              value={selectedProvider}
              onChange={setSelectedProvider}
              options={providerOptions}
            />
          </div>
        );
      case 2:
        return (
          <div>
            <Paragraph>Enter your API key for {selectedProvider}</Paragraph>
            <Input.Password
              placeholder={selectedProvider === 'ollama' ? 'Not required for local providers' : 'sk-...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              visibilityToggle
              style={{ width: '100%' }}
            />
            {selectedProvider === 'ollama' && (
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                Not required for local providers
              </Paragraph>
            )}
          </div>
        );
      case 3:
        return (
          <Result
            status="success"
            title="You're all set!"
            subTitle={`Provider: ${selectedProvider}`}
            extra={[
              <Button key="start" type="primary" onClick={onComplete}>
                Get Started
              </Button>,
            ]}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal open={open} closable={false} maskClosable={false} footer={null} title="Welcome to NowPilot">
      <Steps current={step} items={steps} style={{ marginBottom: 24 }} />
      {renderStepContent()}
      {step < 3 && (
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {step > 0 && <Button onClick={handleBack}>Back</Button>}
            <Button type="primary" onClick={handleNext}>
              Next
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
}
