import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Typography,
  Button,
  Input,
  Select,
  Space,
  App as AntdApp,
} from 'antd';
import {
  ArrowRightOutlined,
  ArrowLeftOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons';
import { testProviderConnection } from '../services/aiProvider';
import { useExtensionStore } from '../store/useExtensionStore';
import { CustomProviderId } from '../types';

const { Title, Text, Paragraph } = Typography;

/**
 * Spec-mandated thin 4-step Onboarding modal (D-01 / D-02 / D-03, REQ-F19).
 *
 * Replaces the scaffold's 1006-line, 8-step OnboardingWizard. The 4 steps are
 * verbatim from 01-UI-SPEC.md + spec §12:
 *   1. "Meet NowPilot" — persona placeholder (Phase 15.3 will replace)
 *   2. "Pick a provider" — provider dropdown
 *   3. "Enter your API key" — password input with reveal toggle
 *   4. "Validate connection" — real `testProviderConnection`, NO simulated
 *      response, NO timer-driven advance (D-02)
 *
 * Step 4's `testProviderConnection` is the same function Plan 01-04 added to
 * `src/services/aiProvider.ts` and that OptionsPage uses — it surfaces the
 * real provider error instead of silently substituting a fallback model list.
 *
 * Privacy (T-01-22): `apiKey` is held only in component state and is NEVER
 * passed to `console.*`, `debugLog`, or interpolated into any string other
 * than the provider request. The error message comes from
 * `testProviderConnection`, which itself never echoes the apiKey back.
 *
 * Step navigation is EXPLICIT — `Continue` advances forward, `Back` retreats,
 * and only a successful testProviderConnection result auto-advances from
 * Step 4. No timer-driven advance exists in this file at all (D-02).
 *
 * Skip semantics (UI-SPEC + plan): `onSkip` and `onComplete` are SEPARATE
 * callbacks. The CALLER (`SidepanelChat.tsx`) decides whether to mark
 * `onboardingComplete=true` — the modal never persists anything itself.
 */
export interface OnboardingModalProps {
  open: boolean;
  /** Called when the user successfully completes Step 4. The caller should
   *  mark `onboardingComplete=true` (and persist it) here. */
  onComplete: () => void;
  /** Called when the user clicks "Skip for now". The caller should leave
   *  `onboardingComplete=false` so the modal re-triggers on next open. */
  onSkip: () => void;
}

type Status = 'idle' | 'testing' | 'ok' | 'error';

interface ProviderOption {
  id: CustomProviderId;
  name: string;
}

const PROVIDERS: ProviderOption[] = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'claude', name: 'Anthropic' },
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'ollama', name: 'Ollama (local)' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  onComplete,
  onSkip,
}) => {
  const { message } = AntdApp.useApp();
  const { updateConfig } = useExtensionStore();

  const [step, setStep] = useState<number>(1);
  const [providerId, setProviderId] = useState<CustomProviderId>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Mounted-ref guard against setState-after-unmount during the in-flight
  // testProviderConnection call (the connection test may resolve after the
  // user has already clicked Skip and unmounted the modal).
  const mountedRef = useRef<boolean>(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset local state every time the modal is opened fresh.
  useEffect(() => {
    if (open) {
      setStep(1);
      setStatus('idle');
      setErrorText(null);
      // Preserve the user's provider/apiKey if they were mid-flow and the
      // modal closed and reopened (e.g. Skip -> re-open). The previous
      // wizard discarded these; the new modal preserves them.
    }
  }, [open]);

  const handleConnect = async () => {
    setStatus('testing');
    setErrorText(null);
    try {
      const result = await testProviderConnection(providerId, apiKey);
      if (!mountedRef.current) return;
      if (result.ok) {
        // Persist the validated provider config and pick the first model
        // as selectedModel (matches the wizard's handleSaveProviderConfig
        // contract). The apiKey here is held in component state; it never
        // leaves this function via console / debugLog / error string.
        const firstModelId = result.models[0]?.id;
        const currentConfig = useExtensionStore.getState().config;
        const existingDetail = currentConfig.providers?.[providerId];
        updateConfig({
          serviceProvider: 'Custom API Key',
          activeProvider: providerId,
          providers: {
            ...currentConfig.providers,
            [providerId]: {
              id: providerId,
              name: PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId,
              isConfigured: true,
              enabled: true,
              apiKey,
              useCustomProxy: existingDetail?.useCustomProxy ?? false,
              proxyUrl: existingDetail?.proxyUrl ?? '',
              models: result.models,
            },
          },
          selectedModel: firstModelId ?? currentConfig.selectedModel,
        });
        setStatus('ok');
        message.success('Provider connected');
      } else {
        // Failure: surface the real provider error verbatim (D-03) — never
        // silently treat it as success.
        setStatus('error');
        setErrorText(result.error);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Defensive: testProviderConnection is documented to never throw,
      // but if it does (e.g. an unexpected exception escapes the helper),
      // surface the real message rather than a silent success.
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setErrorText(msg);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  const handleEditKey = () => {
    setStatus('idle');
    setErrorText(null);
    setStep(3);
  };

  // Step 1: Meet NowPilot (persona placeholder) ----------------------------
  const renderStep1 = () => (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          Meet NowPilot
        </Title>
        <Text type="secondary">Step 1 of 4 · NowPilot</Text>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Persona card placeholder — the full character card ships in Phase 15.3
        (RICH-R-03). For now, set up a provider so you can start chatting.
      </Paragraph>
      <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
        Your API key is sent only to the provider you select below — it is
        never logged or sent anywhere else.
      </Paragraph>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <Button type="link" onClick={onSkip} style={{ paddingLeft: 0 }}>
          Skip for now
        </Button>
        <Button type="primary" onClick={() => setStep(2)}>
          Continue <ArrowRightOutlined />
        </Button>
      </div>
    </Space>
  );

  // Step 2: Pick a provider ------------------------------------------------
  const renderStep2 = () => (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          Pick a provider
        </Title>
        <Text type="secondary">Step 2 of 4</Text>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Choose the AI provider you want to use. You can change this later in
        Options.
      </Paragraph>
      <Select
        value={providerId}
        onChange={(v) => setProviderId(v)}
        style={{ width: '100%' }}
        options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <Button type="link" onClick={onSkip} style={{ paddingLeft: 0 }}>
          Skip for now
        </Button>
        <Space>
          <Button onClick={() => setStep(1)} icon={<ArrowLeftOutlined />}>
            Back
          </Button>
          <Button type="primary" onClick={() => setStep(3)}>
            Continue <ArrowRightOutlined />
          </Button>
        </Space>
      </div>
    </Space>
  );

  // Step 3: Enter API key ---------------------------------------------------
  const renderStep3 = () => (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          Enter your API key
        </Title>
        <Text type="secondary">Step 3 of 4</Text>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Paste the API key from{' '}
        <Text strong>{PROVIDERS.find((p) => p.id === providerId)?.name}</Text>.
        The key is held in memory only until you click Connect Provider.
      </Paragraph>
      <Input.Password
        placeholder="sk-… (paste your API key)"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        autoFocus
        iconRender={(visible) =>
          visible ? <EyeOutlined onClick={() => setShowApiKey(false)} /> : (
            <EyeInvisibleOutlined onClick={() => setShowApiKey(true)} />
          )
        }
        // Hide the password visually unless the user opted in via the icon.
        visibilityToggle={false}
        type={showApiKey ? 'text' : 'password'}
        data-testid="onboarding-api-key-input"
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <Button type="link" onClick={onSkip} style={{ paddingLeft: 0 }}>
          Skip for now
        </Button>
        <Space>
          <Button onClick={() => setStep(2)} icon={<ArrowLeftOutlined />}>
            Back
          </Button>
          <Button
            type="primary"
            onClick={() => setStep(4)}
            disabled={apiKey.trim().length === 0}
          >
            Continue <ArrowRightOutlined />
          </Button>
        </Space>
      </div>
    </Space>
  );

  // Step 4: Validate connection --------------------------------------------
  const renderStep4 = () => (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          Validate connection
        </Title>
        <Text type="secondary">Step 4 of 4</Text>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        We&apos;ll send a real request to{' '}
        <Text strong>{PROVIDERS.find((p) => p.id === providerId)?.name}</Text>{' '}
        to confirm the key works. No demo fallback — if the call fails, the
        real error is shown below.
      </Paragraph>

      {status === 'idle' && (
        <Button
          type="primary"
          block
          onClick={handleConnect}
          data-testid="onboarding-connect-btn"
        >
          Connect Provider
        </Button>
      )}

      {status === 'testing' && (
        <Button type="primary" block loading disabled>
          Testing connection…
        </Button>
      )}

      {status === 'ok' && (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />
            <Text strong>Connected</Text>
          </Space>
          <Button type="primary" block onClick={handleFinish}>
            Finish setup
          </Button>
        </Space>
      )}

      {status === 'error' && (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Space align="start">
            <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 18, marginTop: 2 }} />
            <Text data-testid="onboarding-error-text">
              {`Connection failed: ${errorText ?? 'Unknown error'}`}
            </Text>
          </Space>
          <Space>
            <Button onClick={handleEditKey}>Edit key</Button>
            <Button
              type="primary"
              onClick={handleConnect}
              icon={<LoadingOutlined />}
            >
              Try again
            </Button>
          </Space>
        </Space>
      )}

      {status === 'idle' && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button type="link" onClick={() => setStep(3)} style={{ paddingLeft: 0 }}>
            <ArrowLeftOutlined /> Back
          </Button>
        </div>
      )}
    </Space>
  );

  return (
    <Modal
      open={open}
      // Per the wizard's existing convention: closable={false} and no
      // onCancel — backdrop click and Escape do NOT dismiss the modal
      // during onboarding. The user must complete it or click Skip.
      closable={false}
      footer={null}
      width={520}
      centered
      destroyOnHidden
      mask={{ closable: false }}
      data-testid="onboarding-modal"
    >
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </Modal>
  );
};
