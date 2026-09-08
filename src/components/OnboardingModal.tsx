import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Steps, Typography } from 'antd';
import { STR } from '@/core/i18n/strings';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama' },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [current, setCurrent] = useState(0);
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [apiKey, setApiKey] = useState('');
  const [connectionState, setConnectionState] = useState<'idle' | 'deferred'>('idle');

  useEffect(() => {
    if (!open) {
      setCurrent(0);
      setProvider(undefined);
      setApiKey('');
      setConnectionState('idle');
    }
  }, [open]);

  const handleClose = () => {
    setApiKey('');
    setProvider(undefined);
    setConnectionState('idle');
    setCurrent(0);
    onClose();
  };

  const steps = [
    {
      title: 'Meet NowPilot',
      content: (
        <Typography.Paragraph>
          {STR.rich.personaTagline}
        </Typography.Paragraph>
      ),
    },
    {
      title: 'Provider',
      content: (
        <Select
          style={{ width: '100%' }}
          placeholder="Choose an AI provider"
          options={PROVIDER_OPTIONS}
          value={provider}
          onChange={setProvider}
          aria-label="AI provider"
        />
      ),
    },
    {
      title: 'API Key',
      content: (
        <Input.Password
          placeholder="Enter API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          aria-label="API key"
        />
      ),
    },
    {
      title: 'Connect',
      content: (
        <Alert
          type="info"
          showIcon
          message="Connection testing is available in a later version."
          description={connectionState === 'deferred' ? STR.onboarding.failed : 'Provider connection is not configured in this version.'}
        />
      ),
    },
  ];

  const isLast = current === steps.length - 1;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Welcome to NowPilot"
      footer={[
        current > 0 ? (
          <Button key="back" onClick={() => setCurrent((c) => c - 1)}>
            Back
          </Button>
        ) : null,
        isLast ? (
          <Button key="finish" type="primary" onClick={handleClose}>
            Get Started
          </Button>
        ) : (
          <Button key="next" type="primary" onClick={() => setCurrent((c) => c + 1)}>
            Next
          </Button>
        ),
      ]}
    >
      <Steps current={current} items={steps.map((s) => ({ title: s.title }))} size="small" />
      <div style={{ marginTop: 16 }}>{steps[current].content}</div>
    </Modal>
  );
}
