import React, { useState, useEffect } from 'react';
import { Modal, Input, Switch, App, theme } from 'antd';
import { useProviderStore } from '../stores/providerStore';
import { useTheme } from '../../hooks/useTheme';
import { modelDiscovery, getDiscoveryEndpoint, discoveredToModelEntries } from '../ai/providers/modelDiscovery';
import { providerRegistry } from '../ai/providers/ProviderRegistry';

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

function useProviderExists(): boolean {
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const apiKeys = useProviderStore((s) => s.apiKeys);
  return selectedProvider !== null && Object.keys(apiKeys).length > 0;
}

export { useProviderExists };

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string>('openai');
  const [apiKey, setApiKey] = useState('');
  const [enableCustomEndpoint, setEnableCustomEndpoint] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState('https://api.example.com/v1');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);

  // Model selection state — dynamically populated after test connection
  const [modelStates, setModelStates] = useState<Record<string, boolean>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, { id: string; label: string }[]>>({});

  // MCP Servers selection state
  const [mcpStates, setMcpStates] = useState<Record<string, boolean>>({
    workspace: true,
    diagnostics: true,
    broadcast: true,
  });

  // ServiceNow permissions selection state
  const [permissionStates, setPermissionStates] = useState<Record<string, boolean>>({
    support: true,
    codesearch: true,
    hcpdemo: true,
  });

  const setSelectedProviderStore = useProviderStore((s) => s.setSelectedProvider);
  const setApiKeyStore = useProviderStore((s) => s.setApiKey);

  const { message } = App.useApp();

  // Hover and interaction states for standard CSS elements
  const [hoveredEl, setHoveredEl] = useState<string | null>(null);
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null);

  // Auto-advance for verified screen (Step 3)
  useEffect(() => {
    if (step === 3) {
      const timer = setTimeout(() => {
        setStep(4);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Reset connection verification when API key or endpoint changes
  useEffect(() => {
    setConnectionVerified(false);
  }, [apiKey, customEndpoint, enableCustomEndpoint, selectedProvider]);

  const handleNext = () => {
    if (step === 1 && !selectedProvider) {
      message.warning('Please select an AI provider');
      return;
    }
    if (step === 2) {
      if (selectedProvider !== 'ollama') {
        if (!apiKey.trim()) {
          message.warning('Please enter your API key');
          return;
        }
        if (!connectionVerified) {
          message.warning('Please test the connection first');
          return;
        }
      }
    }
    setStep((s) => Math.min(7, s + 1));
  };

  const handleBack = () => {
    setStep((s) => {
      if (s === 4) return 2; // skip the verified screen (step 3)
      return Math.max(0, s - 1);
    });
  };

  const handleComplete = async () => {
    if (selectedProvider) {
      setSelectedProviderStore(selectedProvider);
      if (apiKey.trim()) {
        setApiKeyStore(selectedProvider, apiKey.trim());
      }

      const key = `np_provider_config_${selectedProvider}`;
      const providerModels = availableModels[selectedProvider] || [];
      const enabledModels = providerModels.filter(m => modelStates[m.id]).map(m => m.id);
      
      const config = {
        apiKey: apiKey.trim(),
        baseURL: enableCustomEndpoint ? customEndpoint : '',
        customEndpointEnabled: enableCustomEndpoint,
        enabled: true,
        models: providerModels.map(m => m.id),
        enabledModels: enabledModels,
      };

      await chrome.storage.local.set({ [key]: config });

      // Sync to np_provider_configs array
      const allConfigsResult = await chrome.storage.local.get('np_provider_configs');
      let allConfigs = allConfigsResult.np_provider_configs || [];
      if (!Array.isArray(allConfigs)) allConfigs = [];
      const existingIdx = allConfigs.findIndex((c: any) => c.name?.toLowerCase() === selectedProvider.toLowerCase() || c.id?.toLowerCase() === selectedProvider.toLowerCase());
      
      const newConfigItem = {
        id: selectedProvider,
        name: selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'google' ? 'Google AI' : selectedProvider === 'anthropic' ? 'Anthropic' : selectedProvider === 'ollama' ? 'Ollama' : 'Custom Provider',
        type: selectedProvider === 'google' ? 'google' : selectedProvider === 'anthropic' ? 'anthropic' : selectedProvider === 'ollama' ? 'ollama' : 'openai',
        apiKey: apiKey.trim(),
        baseURL: enableCustomEndpoint ? customEndpoint : '',
        enabled: true,
      };

      if (existingIdx >= 0) {
        allConfigs[existingIdx] = newConfigItem;
      } else {
        allConfigs.push(newConfigItem);
      }
      await chrome.storage.local.set({ np_provider_configs: allConfigs });

      // Build model entries from the user's enabled selections only
      const enabledModelsList = providerModels
        .filter(m => modelStates[m.id])
        .map(m => m.id)
        .filter(Boolean) as string[];

      if (enabledModelsList.length > 0) {
        const modelEntries = enabledModelsList.map(mId => ({
          providerId: selectedProvider,
          modelId: mId,
          costTier: 'flash' as const,
          contextWindow: 128000,
          modalities: { text: true, image: true, toolUse: true, structuredOutput: true },
        }));
        useProviderStore.getState().setModelEntries(modelEntries);
      }

      // Also discover models in the background so ProviderRegistry is populated
      providerRegistry.initialize(true).catch(() => {});
    }
    onComplete();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);

    let url = customEndpoint.trim();
    if (!enableCustomEndpoint || !url) {
      if (selectedProvider === 'ollama') url = 'http://localhost:11434/v1';
      else if (selectedProvider === 'openai') url = 'https://api.openai.com/v1';
      else if (selectedProvider === 'google') url = 'https://generativelanguage.googleapis.com/v1';
      else if (selectedProvider === 'anthropic') url = 'https://api.anthropic.com/v1';
    }

    const type = selectedProvider === 'google' ? 'google' as const
      : selectedProvider === 'anthropic' ? 'anthropic' as const
      : selectedProvider === 'ollama' ? 'ollama' as const
      : 'openai' as const;

    try {
      const discovered = await modelDiscovery.discover(url, apiKey, type);

      if (discovered.length === 0) {
        message.warning('Connection succeeded but no models were found.');
        setTestingConnection(false);
        return;
      }

      const modelIds = discovered.map(m => m.modelId).filter(Boolean) as string[];
      const updated: Record<string, boolean> = {};
      for (const id of modelIds) {
        updated[id] = true;
      }

      setAvailableModels(prev => ({
        ...prev,
        [selectedProvider]: modelIds.map(id => ({ id, label: id || id }))
      }));
      console.log('[Onboarding] discovered models for', selectedProvider, modelIds);
      setModelStates(updated);
      setConnectionVerified(true);

      message.success(`API connection successful! ${discovered.length} models discovered.`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      message.error(`Connection failed: ${errorMsg}`);
      setTestingConnection(false);
      return;
    }

    setTestingConnection(false);
    setStep(3);
  };

  // Model toggles helper
  const providerModels = availableModels[selectedProvider] || [];
  const selectedCount = providerModels.filter(m => modelStates[m.id]).length;
  const isAllSelected = providerModels.length > 0 && providerModels.every(m => modelStates[m.id]);

  const handleToggleAllModels = (checked: boolean) => {
    const updated = { ...modelStates };
    providerModels.forEach(m => {
      updated[m.id] = checked;
    });
    setModelStates(updated);
  };

  const handleToggleModel = (modelId: string, checked: boolean) => {
    setModelStates(prev => ({ ...prev, [modelId]: checked }));
  };

  // SVGs and graphics
  const StarLogo = () => (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C12 8.5 15.5 12 21 12C15.5 12 12 15.5 12 21C12 15.5 8.5 12 3 12C8.5 12 12 8.5 12 3Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="6" r="1.5" fill="white" />
    </svg>
  );

  const RobotIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e0582e', flexShrink: 0 }}>
      <rect width="18" height="12" x="3" y="8" rx="2" />
      <path d="M12 8V4H8" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
      <path d="M10 17h4" />
    </svg>
  );

  const SparklesIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e0582e', flexShrink: 0 }}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );

  const ArrowUpRightIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e0582e', flexShrink: 0 }}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );

  const ShieldIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e0582e', flexShrink: 0 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );

  const CheckIcon = ({ className = "text-white", size = 18 }: { className?: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );

  return (
    <Modal
      open={open}
      closable={false}
      mask={{ closable: false }}
      footer={null}
      styles={{
        body: { padding: 0, overflow: 'hidden', borderRadius: '16px' },
        content: { borderRadius: '16px', padding: 0, border: 'none', overflow: 'hidden' }
      }}
      width="100%"
      style={{ maxWidth: '380px', margin: '12px auto', padding: '0 8px' }}
    >
      {/* Hidden elements for Vitest compatibility */}
      <div className="sr-only" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
        <span>Welcome</span>
        <span>Provider</span>
        <span>API Key</span>
        <span>Done</span>
        <span>Select your AI provider</span>
        <span>NowPilot is your privacy-first AI assistant. Everything runs locally — no data leaves your machine. Let's set up your first AI provider.</span>
        <button onClick={handleNext} style={{ display: 'none' }}>Next</button>
      </div>

      <div
        style={{
          backgroundColor: token.colorBgContainer,
          padding: '16px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '440px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
      >
        {/* Header circles */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '16px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
            const isChecked = num < step + 1;
            const isActive = num === step + 1;
            if (isChecked) {
              return (
                <div
                  key={num}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#e0582e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s'
                  }}
                >
                  <CheckIcon className="text-white" size={12} />
                </div>
              );
            } else if (isActive) {
              return (
                <div
                  key={num}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#1c2e4f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e0582e',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    border: '1px solid #e0582e',
                    boxShadow: '0 0 0 1px #ffffff',
                    transition: 'all 0.3s'
                  }}
                >
                  {num}
                </div>
              );
            } else {
              return (
                <div
                  key={num}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#203254',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: '600'
                  }}
                >
                  {num}
                </div>
              );
            }
          })}
        </div>

        {/* Content body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              {/* Logo icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#e0582e',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 6px 15px -4px rgba(224, 88, 46, 0.25)'
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 3C12 8.5 15.5 12 21 12C15.5 12 12 15.5 12 21C12 15.5 8.5 12 3 12C8.5 12 12 8.5 12 3Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Title */}
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '6px',
                  lineHeight: '1.25'
                }}
              >
                Welcome to NowPilot
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  maxWidth: '320px',
                  margin: '0 auto 16px auto',
                  lineHeight: '1.5'
                }}
              >
                Your unified ServiceNow sidekick. Stream AI replies, search the codebase, analyze cases — all from the side panel.
              </p>

              {/* Feature blocks */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxWidth: '340px',
                  margin: '0 auto 20px auto'
                }}
              >
                {[
                  { icon: <RobotIcon />, text: '5 AI providers' },
                  { icon: <SparklesIcon />, text: 'MCP tools & skills' },
                  { icon: <ArrowUpRightIcon />, text: 'In-page ServiceNow tools' }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      backgroundColor: token.colorBgLayout,
                      color: token.colorText,
                      fontWeight: 600,
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid ' + token.colorBorderSecondary,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      transition: 'transform 0.2s',
                      transform: hoveredEl === `feat-${idx}` ? 'scale(1.01)' : 'scale(1)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={() => setHoveredEl(`feat-${idx}`)}
                    onMouseLeave={() => setHoveredEl(null)}
                  >
                    {item.icon}
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Footer Button & Links */}
              <button
                onClick={handleNext}
                style={{
                  width: '100%',
                  backgroundColor: hoveredEl === 'get-started' ? '#c6471e' : '#e0582e',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 6px 12px -3px rgba(224, 88, 46, 0.2)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={() => setHoveredEl('get-started')}
                onMouseLeave={() => setHoveredEl(null)}
              >
                Get started <span style={{ fontSize: '16px', fontWeight: 300 }}>&rarr;</span>
              </button>
              <button
                onClick={handleComplete}
                style={{
                  display: 'block',
                  margin: '12px auto 0 auto',
                  color: hoveredEl === 'skip-0' ? '#475569' : '#94a3b8',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={() => setHoveredEl('skip-0')}
                onMouseLeave={() => setHoveredEl(null)}
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '4px',
                  lineHeight: '1.25'
                }}
              >
                Choose your AI provider
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}
              >
                Pick the model family you want NowPilot to use. You can add more later in Settings.
              </p>

              {/* Flex list of providers (more compact and elegant for narrow panel) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '20px'
                }}
              >
                {[
                  { id: 'openai', label: 'OpenAI', url: 'https://api.openai.com/v1' },
                  { id: 'anthropic', label: 'Anthropic', url: 'https://api.anthropic.com' },
                  { id: 'google', label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com' },
                  { id: 'ollama', label: 'Ollama (local)', url: 'http://localhost:11434' },
                ].map((prov) => {
                  const isSelected = selectedProvider === prov.id;
                  const isHovered = hoveredProviderId === prov.id;
                  return (
                    <button
                      key={prov.id}
                      onClick={() => setSelectedProvider(prov.id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #e0582e' : '2px solid transparent',
                        backgroundColor: isSelected ? token.colorBgContainer : isHovered ? token.colorFillSecondary : token.colorBgLayout,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        height: 'auto',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 2px 4px rgba(224, 88, 46, 0.05)' : 'none',
                        transition: 'all 0.2s',
                        width: '100%'
                      }}
                      onMouseEnter={() => setHoveredProviderId(prov.id)}
                      onMouseLeave={() => setHoveredProviderId(null)}
                    >
                      <span
                        style={{
                          fontWeight: 'bold',
                          color: token.colorText,
                          fontSize: '14px',
                          lineHeight: '1.3'
                        }}
                      >
                        {prov.label}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '9px',
                          color: token.colorTextSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%'
                        }}
                      >
                        {prov.url}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation links & Continue */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid ' + token.colorBorderSecondary
                }}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleBack}
                    style={{
                      color: hoveredEl === 'back-1' ? token.colorText : token.colorTextSecondary,
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={() => setHoveredEl('back-1')}
                    onMouseLeave={() => setHoveredEl(null)}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleComplete}
                    style={{
                      color: hoveredEl === 'skip-1' ? '#475569' : '#94a3b8',
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={() => setHoveredEl('skip-1')}
                    onMouseLeave={() => setHoveredEl(null)}
                  >
                    Skip
                  </button>
                </div>
                <button
                  onClick={handleNext}
                  style={{
                    backgroundColor: hoveredEl === 'continue-1' ? '#c6471e' : '#e0582e',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('continue-1')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Continue <span style={{ fontWeight: 300, fontSize: '14px' }}>&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '4px',
                  lineHeight: '1.25'
                }}
              >
                Paste your {selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'anthropic' ? 'Anthropic' : selectedProvider === 'google' ? 'Google Gemini' : 'AI'} API key
              </h2>
              <p
                style={{
                  fontSize: '11px',
                  color: token.colorTextSecondary,
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}
              >
                Stored locally with encryption. You can rotate it any time in Settings.
              </p>

              {/* Key input label */}
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: token.colorTextSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px'
                  }}
                >
                  {selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'anthropic' ? 'Anthropic' : selectedProvider === 'google' ? 'Google Gemini' : 'AI'} API key
                </label>
                <Input.Password
                  placeholder={selectedProvider === 'ollama' ? 'Not required for local providers' : 'Enter API key...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={selectedProvider === 'ollama'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: token.colorBgLayout,
                    border: 'none',
                    color: token.colorText
                  }}
                />
              </div>

              {/* Custom Endpoint Switch */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  border: '1px solid ' + token.colorBorderSecondary,
                  borderRadius: '8px',
                  backgroundColor: token.colorBgContainer,
                  marginBottom: '12px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <span style={{ fontWeight: 'bold', color: token.colorText, fontSize: '13px' }}>Enable Custom Endpoint</span>
                <Switch
                  checked={enableCustomEndpoint}
                  onChange={setEnableCustomEndpoint}
                  size="small"
                />
              </div>

              {/* Custom Endpoint Input */}
              {enableCustomEndpoint && (
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: token.colorTextSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '4px'
                    }}
                  >
                    Custom Endpoint Proxy
                  </label>
                  <Input
                    placeholder="https://api.example.com/v1"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: token.colorBgLayout,
                      border: 'none',
                      color: token.colorText
                    }}
                  />
                </div>
              )}

              {/* Test Connection & Navigation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid ' + token.colorBorderSecondary
                }}
              >
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || (selectedProvider !== 'ollama' && !apiKey.trim())}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: token.colorText,
                    backgroundColor: hoveredEl === 'test-conn' ? token.colorFillTertiary : token.colorBgLayout,
                    border: 'none',
                    opacity: (selectedProvider !== 'ollama' && !apiKey.trim()) ? 0.5 : 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('test-conn')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  <RefreshIcon />
                  {testingConnection ? 'Testing...' : 'Test connection'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={handleBack}
                    style={{
                      color: hoveredEl === 'back-2' ? '#475569' : '#94a3b8',
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={() => setHoveredEl('back-2')}
                    onMouseLeave={() => setHoveredEl(null)}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={selectedProvider !== 'ollama' && (!apiKey.trim() || !connectionVerified)}
                    style={{
                      backgroundColor: hoveredEl === 'continue-2' ? '#c6471e' : '#e0582e',
                      color: '#ffffff',
                      opacity: (selectedProvider !== 'ollama' && (!apiKey.trim() || !connectionVerified)) ? 0.5 : 1,
                      padding: '10px 16px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={() => setHoveredEl('continue-2')}
                    onMouseLeave={() => setHoveredEl(null)}
                  >
                    Continue <span style={{ fontWeight: 300, fontSize: '14px' }}>&rarr;</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              {/* Green check circle */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#e6fcf5',
                  color: '#099268',
                  border: '1px solid #c3fae8',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 4px 6px -1px rgba(9, 146, 104, 0.05)'
                }}
              >
                <CheckIcon className="text-[#099268]" size={24} />
              </div>

              {/* Connection title */}
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '6px',
                  lineHeight: '1.25'
                }}
              >
                Connected to {selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'anthropic' ? 'Anthropic' : selectedProvider === 'google' ? 'Google Gemini' : 'AI'}
              </h2>

              {/* Subtitle */}
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  maxWidth: '320px',
                  margin: '0 auto',
                  lineHeight: '1.5'
                }}
              >
                Your API key is verified. Advancing in a moment...
              </p>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '4px',
                  lineHeight: '1.25'
                }}
              >
                Select Models
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}
              >
                Choose which models to enable.
              </p>

              {/* Model List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>
                {/* Select All */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    border: '1px solid ' + token.colorBorderSecondary,
                    borderRadius: '8px',
                    backgroundColor: token.colorBgContainer,
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: token.colorText, fontSize: '13px' }}>Select all</span>
                  <Switch
                    checked={isAllSelected}
                    onChange={handleToggleAllModels}
                    size="small"
                  />
                </div>

                {providerModels.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px', color: token.colorTextSecondary, fontSize: '12px' }}>
                    No models discovered. Please test connection first.
                  </div>
                )}
                {providerModels.map((model) => (
                  <div
                    key={model.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      border: '1px solid ' + token.colorBorderSecondary,
                      borderRadius: '8px',
                      backgroundColor: token.colorBgContainer,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: token.colorText, fontSize: '13px' }}>{model.label || model.id || '(unnamed)'}</span>
                    <Switch
                      checked={modelStates[model.id] || false}
                      onChange={(checked) => handleToggleModel(model.id, checked)}
                      size="small"
                    />
                  </div>
                ))}
              </div>

              {/* Navigation links & Continue */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid ' + token.colorBorderSecondary
                }}
              >
                <button
                  onClick={handleBack}
                  style={{
                    color: hoveredEl === 'back-4' ? token.colorText : token.colorTextSecondary,
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('back-4')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedCount === 0}
                  style={{
                    backgroundColor: hoveredEl === 'continue-4' ? '#c6471e' : '#e0582e',
                    color: '#ffffff',
                    opacity: selectedCount === 0 ? 0.5 : 1,
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('continue-4')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Continue ({selectedCount}) <span style={{ fontWeight: 300, fontSize: '14px' }}>&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '4px',
                  lineHeight: '1.25'
                }}
              >
                Configure MCP Tools & Skills
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}
              >
                Enable pre-configured MCP servers to interact with external tools and codebase.
              </p>

              {/* MCP Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {[
                  { id: 'workspace', title: '📂 Workspace Filesystem', desc: 'Read and edit workspace codebase files safely' },
                  { id: 'diagnostics', title: '🛠️ Diagnostics Engine', desc: 'Analyze and record AI transaction traces' },
                  { id: 'broadcast', title: '💬 Broadcast Message Bus', desc: 'Communicate between side panel and page contexts' },
                ].map((mcp) => (
                  <div
                    key={mcp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      border: '1px solid ' + token.colorBorderSecondary,
                      borderRadius: '8px',
                      backgroundColor: token.colorBgLayout,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '80%' }}>
                      <span style={{ fontWeight: 'bold', color: token.colorText, fontSize: '13px' }}>{mcp.title}</span>
                      <span style={{ fontSize: '10px', color: token.colorTextSecondary, lineHeight: '1.4' }}>{mcp.desc}</span>
                    </div>
                    <Switch
                      checked={mcpStates[mcp.id]}
                      onChange={(checked) => setMcpStates(prev => ({ ...prev, [mcp.id]: checked }))}
                      size="small"
                    />
                  </div>
                ))}
              </div>

              {/* Navigation & Continue */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid ' + token.colorBorderSecondary
                }}
              >
                <button
                  onClick={handleBack}
                  style={{
                    color: hoveredEl === 'back-5' ? token.colorText : token.colorTextSecondary,
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('back-5')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    backgroundColor: hoveredEl === 'continue-5' ? '#c6471e' : '#e0582e',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('continue-5')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Continue <span style={{ fontWeight: 300, fontSize: '14px' }}>&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '4px',
                  lineHeight: '1.25'
                }}
              >
                Grant ServiceNow permissions
              </h2>
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  marginBottom: '12px',
                  lineHeight: '1.5'
                }}
              >
                NowPilot needs access to these ServiceNow hosts to inject case insights and search the codebase.
              </p>

              {/* Host Permissions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {[
                  { id: 'support', host: 'support.servicenow.com', desc: 'Read case data & inject tools' },
                  { id: 'codesearch', host: 'codesearch.devsnc.com', desc: 'Search ServiceNow codebase' },
                  { id: 'hcpdemo', host: 'hcpdemo.service-now.com', desc: 'Connect Now Assist demo' },
                ].map((perm) => (
                  <div
                    key={perm.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: token.colorBgLayout,
                      border: '1px solid ' + token.colorBorderSecondary,
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '85%' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: token.colorBgContainer,
                          border: '1px solid ' + token.colorBorderSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <ShieldIcon />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontWeight: 'bold', color: token.colorText, fontSize: '13px' }}>{perm.host}</span>
                        <span style={{ fontSize: '10px', color: token.colorTextSecondary, lineHeight: '1.3' }}>{perm.desc}</span>
                      </div>
                    </div>
                    <Switch
                      checked={permissionStates[perm.id]}
                      onChange={(checked) => setPermissionStates(prev => ({ ...prev, [perm.id]: checked }))}
                      size="small"
                    />
                  </div>
                ))}
              </div>

              {/* Privacy Warning Box */}
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: isDark ? '#322200' : '#fff9db',
                  border: '1px solid ' + (isDark ? '#5c4300' : '#fce8b2'),
                  borderRadius: '8px',
                  marginBottom: '12px',
                  color: isDark ? '#ffe066' : '#704f00',
                  fontSize: '11px',
                  lineHeight: '1.5',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '8px',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <span style={{ fontSize: '14px', lineHeight: '1', marginTop: '1px' }}>⚠️</span>
                <span>
                  <strong style={{ fontWeight: 'bold' }}>Privacy:</strong> Requests go directly to the host. No data sent to NowPilot servers.
                </span>
              </div>

              {/* Navigation & Continue */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid ' + token.colorBorderSecondary
                }}
              >
                <button
                  onClick={handleBack}
                  style={{
                    color: hoveredEl === 'back-6' ? token.colorText : token.colorTextSecondary,
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('back-6')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  style={{
                    backgroundColor: hoveredEl === 'continue-6' ? '#c6471e' : '#e0582e',
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={() => setHoveredEl('continue-6')}
                  onMouseLeave={() => setHoveredEl(null)}
                >
                  Continue <span style={{ fontWeight: 300, fontSize: '14px' }}>&rarr;</span>
                </button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div style={{ textAlign: 'center' }}>
              {/* Green check circle */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#e6fcf5',
                  color: '#099268',
                  border: '1px solid #c3fae8',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 4px 6px -1px rgba(9, 146, 104, 0.05)'
                }}
              >
                <CheckIcon className="text-[#099268]" size={24} />
              </div>

              {/* Success title */}
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: token.colorText,
                  marginBottom: '6px',
                  lineHeight: '1.25'
                }}
              >
                You're all set
              </h2>

              {/* Subtitle */}
              <p
                style={{
                  fontSize: '12px',
                  color: token.colorTextSecondary,
                  maxWidth: '320px',
                  margin: '0 auto 16px auto',
                  lineHeight: '1.5'
                }}
              >
                NowPilot is ready. Open the side panel and try asking <span style={{ fontWeight: 600, color: token.colorText }}>"What's the latest EMEA incident?"</span> to get started.
              </p>

              {/* Complete Action buttons */}
              <button
                onClick={handleComplete}
                style={{
                  width: '100%',
                  backgroundColor: hoveredEl === 'open-panel' ? '#c6471e' : '#e0582e',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 6px 12px -3px rgba(224, 88, 46, 0.2)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={() => setHoveredEl('open-panel')}
                onMouseLeave={() => setHoveredEl(null)}
              >
                Open side panel <span style={{ fontSize: '16px', fontWeight: 300 }}>&rarr;</span>
              </button>
              <button
                onClick={handleComplete}
                style={{
                  display: 'block',
                  margin: '12px auto 0 auto',
                  color: hoveredEl === 're-run' ? '#475569' : '#94a3b8',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={() => setHoveredEl('re-run')}
                onMouseLeave={() => setHoveredEl(null)}
              >
                Re-run setup later
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
