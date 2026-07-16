import React, { useState, useEffect } from 'react';
import { Select, Switch, Typography, Button, App, theme, Modal, Input, Form, Slider } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  BgColorsOutlined,
  GlobalOutlined,
  ExportOutlined,
  EditOutlined,
  SyncOutlined,
  PlusOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeMode } from '../../core/stores/themeStore';
import { useProviderStore } from '../../core/stores/providerStore';
import { modelDiscovery, estimateContextWindow } from '../../core/ai/providers/modelDiscovery';
import { providerRegistry } from '../../core/ai/providers/ProviderRegistry';

const { Text } = Typography;

type ServiceProvider = 'custom-api' | 'chatgpt-webapp' | 'copilot';
type DisplayLanguage = 'english' | 'spanish' | 'chinese' | 'japanese' | 'french' | 'german';

interface ProviderInfo {
  id: string;
  name: string;
  type: 'api' | 'webapp';
  enabled: boolean;
}

// High-fidelity custom brand logos
const OpenAILogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: '#10A37F' }}>
    <path d="M21.3,11.1c0-0.7-0.4-1.3-1.1-1.5c0.1-0.3,0.1-0.6,0.1-0.9c0-0.9-0.7-1.7-1.7-1.7c-0.1,0-0.3,0-0.4,0C18.1,6,17.2,5.4,16.1,5.4c-0.4,0-0.8,0.1-1.1,0.3c-0.4-0.6-1-1-1.8-1c-0.2,0-0.3,0-0.5,0.1C12.1,4.3,11.2,4,10.2,4C8.9,4,7.8,4.9,7.5,6.1C7.2,6,6.9,6,6.6,6C5.3,6,4.3,7,4.3,8.3c0,0.4,0.1,0.7,0.3,1C4,9.6,3.6,10.3,3.6,11.1c0,0.7,0.4,1.3,1.1,1.5c-0.1,0.3-0.1,0.6-0.1,0.9c0,0.9,0.7,1.7,1.7,1.7c0.1,0,0.3,0,0.4,0c0.3,1,1.2,1.6,2.3,1.6c0.4,0,0.8-0.1,1.1-0.3c0.4,0.6,1,1,1.8,1c0.2,0,0.3,0,0.5-0.1c0.6,0.5,1.5,0.8,2.5,0.8c1.3,0,2.4-0.9,2.7-2.1c0.3,0.1,0.6,0.1,0.9,0.1c1.3,0,2.3-1,2.3-2.3c0-0.4-0.1-0.7-0.3-1C20.9,12.6,21.3,11.9,21.3,11.1z M12,14.6l-2.6-1.5V10l2.6,1.5V14.6z M13.1,14.6l2.6-1.5V10l-2.6,1.5V14.6z M12.5,8.8l2.6-1.5l-2.6-1.5L9.9,7.3L12.5,8.8z M8.8,10.6l2.6,1.5v3l-2.6-1.5V10.6z M8.2,11.2l-2.6-1.5v3l2.6,1.5V11.2z M15.2,11.2l2.6-1.5v3l-2.6,1.5V11.2z"/>
  </svg>
);

const GoogleGeminiLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.23-.67-.35-1.37-.35-2.09V14.09z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const OllamaLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, color: '#000000' }}>
    <path d="M12 2a4 4 0 0 0-4 4v4H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm-2 4a2 2 0 1 1 4 0v4h-4V6zm-2 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm6 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" />
  </svg>
);

const AnthropicLogo = () => (
  <div style={{
    width: 20,
    height: 20,
    borderRadius: 4,
    background: '#E0582E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'serif',
    flexShrink: 0,
  }}>
    A
  </div>
);

const GeorgeLiAvatar = () => (
  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#2D3748' }}>
    <circle cx="50" cy="50" r="40" fill="#EDF2F7" />
    <ellipse cx="40" cy="20" rx="8" ry="18" fill="#EDF2F7" />
    <ellipse cx="40" cy="20" rx="4" ry="12" fill="#FED7D7" />
    <ellipse cx="60" cy="20" rx="8" ry="18" fill="#EDF2F7" />
    <ellipse cx="60" cy="20" rx="4" ry="12" fill="#FED7D7" />
    <circle cx="42" cy="48" r="4" fill="#2D3748" />
    <circle cx="58" cy="48" r="4" fill="#2D3748" />
    <circle cx="50" cy="54" r="2.5" fill="#E53E3E" />
    <circle cx="36" cy="54" r="5" fill="#FED7D7" opacity="0.6" />
    <circle cx="64" cy="54" r="5" fill="#FED7D7" opacity="0.6" />
    <path d="M47,58 Q50,60 53,58" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const getRegistryDescription = (providerId: string, providerName: string): string => {
  switch (providerId) {
    case 'openai':
      return 'Use OpenAI GPT-4o models for analytical scripting and parsing actions.';
    case 'google':
      return 'Use Google Gemini models for multimodality, fast response, and code understanding.';
    case 'ollama':
      return 'Use Ollama local registry models for offline, zero-latency privacy preservation.';
    case 'anthropic':
      return 'Use Anthropic Claude models for deep reasoning and code generation tasks.';
    default:
      return `Connect to ${providerName} registry services to execute smart parsing actions.`;
  }
};

export function GeneralSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const { mode, setMode, isDark } = useTheme();
  const apiKeys = useProviderStore((s) => s.apiKeys);
  const setApiKey = useProviderStore((s) => s.setApiKey);

  const [serviceProvider, setServiceProvider] = useState<ServiceProvider>('custom-api');
  const [displayLanguage, setDisplayLanguage] = useState<DisplayLanguage>('english');
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string } | null>(null);

  const [customEndpointEnabled, setCustomEndpointEnabled] = useState(false);

  // Read aloud (speech synthesis) state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [defaultVoice, setDefaultVoice] = useState<string>('default');
  const [defaultSpeed, setDefaultSpeed] = useState<number>(1.0);

  const [providers, setProviders] = useState<ProviderInfo[]>([
    { id: 'openai', name: 'OpenAI', type: 'api', enabled: false },
    { id: 'google', name: 'Google (Gemini)', type: 'api', enabled: false },
    { id: 'ollama', name: 'Ollama', type: 'api', enabled: false },
    { id: 'anthropic', name: 'Anthropic (Claude)', type: 'api', enabled: false },
  ]);

  // Modal setup state
  const [setupModal, setSetupModal] = useState<{ open: boolean; providerId: string | null }>({
    open: false,
    providerId: null,
  });

  // Active provider modal inputs
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modalModels, setModalModels] = useState<string[]>([]);
  const [modalEnabledModels, setModalEnabledModels] = useState<string[]>([]);
  const [modalCustomModels, setModalCustomModels] = useState<string[]>([]);

  // Connection testing states
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  // Custom model creation modal
  const [customModelModal, setCustomModelModal] = useState(false);
  const [customModelNameInput, setCustomModelNameInput] = useState('');

  // ChatGPT webapp refresh action simulation
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        setVoices(window.speechSynthesis.getVoices());
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadConfigs();
  }, []);

  const loadProfile = async () => {
    try {
      const result = await chrome.storage.local.get('np_google_profile');
      const profileData = result.np_google_profile as { name: string; email: string; avatar: string } | undefined;
      if (profileData) {
        setProfile(profileData);
      } else {
        // Default seed to match the screenshot 'nowpilot_page_options_01_general.png'
        setProfile({
          name: 'George Li',
          email: 'oraclexp@hotmail.com',
          avatar: 'george-li-bunny',
        });
      }
    } catch {
      // Fallback seed
      setProfile({
        name: 'George Li',
        email: 'oraclexp@hotmail.com',
        avatar: 'george-li-bunny',
      });
    }
  };

  const loadConfigs = async () => {
    try {
      // Load service provider
      const spResult = await chrome.storage.local.get('np_service_provider');
      if (spResult.np_service_provider) {
        setServiceProvider(spResult.np_service_provider as ServiceProvider);
      }

      // Load language
      const langResult = await chrome.storage.local.get('np_display_language');
      if (langResult.np_display_language) {
        setDisplayLanguage(langResult.np_display_language as DisplayLanguage);
      }

      // Load read aloud settings
      const ttsVoiceResult = await chrome.storage.local.get('np_tts_voice');
      if (ttsVoiceResult.np_tts_voice) {
        setDefaultVoice(ttsVoiceResult.np_tts_voice);
      }
      const ttsSpeedResult = await chrome.storage.local.get('np_tts_speed');
      if (ttsSpeedResult.np_tts_speed) {
        setDefaultSpeed(ttsSpeedResult.np_tts_speed);
      }

      // Load each provider's config
      const updatedProviders = await Promise.all(
        providers.map(async (p) => {
          const key = `np_provider_config_${p.id}`;
          const result = await chrome.storage.local.get(key);
          const config = result[key] || {};
          return {
            ...p,
            enabled: config.enabled !== undefined ? config.enabled : !!apiKeys[p.name],
          };
        })
      );
      setProviders(updatedProviders);
      syncModelEntries();
    } catch (err) {
      console.error('Failed to load configs:', err);
    }
  };

  const syncModelEntries = async () => {
    try {
      await providerRegistry.initialize(true);
      const allModels = providerRegistry.listModels();
      // Filter to only enabled models per provider config
      const filtered: typeof allModels = [];
      for (const model of allModels) {
        const ppKey = `np_provider_config_${model.providerId}`;
        const ppResult = await chrome.storage.local.get(ppKey);
        const ppConfig = ppResult[ppKey] as { enabledModels?: string[] } | undefined;
        if (ppConfig?.enabledModels && Array.isArray(ppConfig.enabledModels)) {
          if (ppConfig.enabledModels.includes(model.modelId)) {
            filtered.push(model);
          }
        } else {
          filtered.push(model);
        }
      }
      useProviderStore.getState().setModelEntries(filtered.length > 0 ? filtered : allModels);
    } catch (err) {
      console.error('Failed to sync model entries:', err);
    }
  };

  const handleLogout = async () => {
    await chrome.storage.local.remove('np_google_profile');
    setProfile(null);
    message.success('Logged out successfully');
  };

  const handleSignIn = async () => {
    const mockProfile = {
      name: 'George Li',
      email: 'oraclexp@hotmail.com',
      avatar: 'george-li-bunny',
    };
    await chrome.storage.local.set({ np_google_profile: mockProfile });
    setProfile(mockProfile);
    message.success('Signed in as George Li');
  };

  const handleThemeChange = (value: ThemeMode) => {
    setMode(value);
    message.success(`Theme mode updated to ${value}`);
  };

  const handleDisplayLanguageChange = (value: DisplayLanguage) => {
    setDisplayLanguage(value);
    chrome.storage.local.set({ np_display_language: value });
    message.success(`Language changed to ${value === 'english' ? 'English' : value}`);
  };

  const handleServiceProviderChange = (value: ServiceProvider) => {
    setServiceProvider(value);
    chrome.storage.local.set({ np_service_provider: value });
    message.success(`Service provider updated`);
  };

  const toggleProvider = async (id: string, checked: boolean) => {
    const updated = providers.map((p) => (p.id === id ? { ...p, enabled: checked } : p));
    setProviders(updated);

    const key = `np_provider_config_${id}`;
    const result = await chrome.storage.local.get(key);
    const config = result[key] || {};
    config.enabled = checked;
    await chrome.storage.local.set({ [key]: config });

    if (checked && apiKeys[id]) {
      await providerRegistry.discoverModels(id);
    }

    // Sync to np_provider_configs array so ProviderRegistry reads the correct enabled state
    const allConfigsResult = await chrome.storage.local.get('np_provider_configs');
    let allConfigs = allConfigsResult.np_provider_configs || [];
    if (!Array.isArray(allConfigs)) allConfigs = [];
    const existingIdx = allConfigs.findIndex((c: any) => c.id === id || c.name === providers.find((p) => p.id === id)?.name);
    const provider = providers.find((p) => p.id === id);
    const configItem = {
      id,
      name: provider?.name || id,
      enabled: checked,
    };
    if (existingIdx >= 0) {
      allConfigs[existingIdx] = { ...allConfigs[existingIdx], enabled: checked };
    } else {
      allConfigs.push(configItem);
    }
    await chrome.storage.local.set({ np_provider_configs: allConfigs });

    syncModelEntries();
    message.success(`${providers.find((p) => p.id === id)?.name} ${checked ? 'enabled' : 'disabled'}`);
  };

  const openSetupModal = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    const key = `np_provider_config_${providerId}`;
    const result = await chrome.storage.local.get(key);
    const config = result[key] || {};

    setApiKeyInput(config.apiKey || apiKeys[provider.name] || '');
    setBaseUrlInput(config.baseURL || '');
    setCustomEndpointEnabled(config.customEndpointEnabled !== undefined ? config.customEndpointEnabled : !!config.baseURL);

    const regProvider = providerRegistry['listProviders']().find(p => p.id === providerId);
    const regModels = regProvider?.models?.map(m => m.modelId) || [];
    const savedModels = (config.models && config.models.length > 0) ? config.models : regModels;
    setModalModels(savedModels);
    setModalEnabledModels(config.enabledModels || savedModels);

    setConnectionStatus('idle');
    setConnectionMessage('');
    setSetupModal({ open: true, providerId });
  };

  const handleSaveSetup = async () => {
    const { providerId } = setupModal;
    if (!providerId) return;

    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    const key = `np_provider_config_${providerId}`;
    const config = {
      apiKey: apiKeyInput,
      baseURL: customEndpointEnabled ? baseUrlInput : '',
      customEndpointEnabled: customEndpointEnabled,
      enabled: apiKeyInput ? true : provider.enabled,
      models: modalModels,
      enabledModels: modalEnabledModels,
    };

    await chrome.storage.local.set({ [key]: config });

    // Sync key to state
    if (apiKeyInput) {
      setApiKey(provider.name, apiKeyInput);
    }

    // Sync to np_provider_configs array
    const allConfigsResult = await chrome.storage.local.get('np_provider_configs');
    let allConfigs = allConfigsResult.np_provider_configs || [];
    if (!Array.isArray(allConfigs)) allConfigs = [];
    const existingIdx = allConfigs.findIndex((c: any) => c.name === provider.name);
    const newConfigItem = {
      id: providerId,
      name: provider.name,
      type: providerId === 'google' ? 'google' : providerId === 'anthropic' ? 'anthropic' : providerId === 'ollama' ? 'ollama' : 'openai',
      apiKey: apiKeyInput,
      baseURL: customEndpointEnabled ? baseUrlInput : '',
      enabled: config.enabled,
    };
    if (existingIdx >= 0) {
      allConfigs[existingIdx] = newConfigItem;
    } else {
      allConfigs.push(newConfigItem);
    }
    await chrome.storage.local.set({ np_provider_configs: allConfigs });

    const updated = providers.map((p) =>
      p.id === providerId ? { ...p, enabled: config.enabled } : p
    );
    setProviders(updated);
    syncModelEntries();

    setSetupModal({ open: false, providerId: null });
    message.success(`${provider.name} settings saved`);
  };

  const handleTestConnection = async () => {
    const { providerId } = setupModal;
    if (!providerId) return;
    const provider = providers.find((p) => p.id === providerId);

    setConnectionStatus('testing');
    setConnectionMessage('');

    let url = baseUrlInput.trim();
    if (!url) {
      if (providerId === 'ollama') url = 'http://localhost:11434/v1';
      else if (providerId === 'openai') url = 'https://api.openai.com/v1';
      else if (providerId === 'google') url = 'https://generativelanguage.googleapis.com/v1';
      else if (providerId === 'anthropic') url = 'https://api.anthropic.com/v1';
    }

    const type = providerId === 'google' ? 'google' as const
      : providerId === 'anthropic' ? 'anthropic' as const
      : providerId === 'ollama' ? 'ollama' as const
      : 'openai' as const;

    try {
      const discovered = await modelDiscovery.discover(url, apiKeyInput, type);
      setConnectionStatus('success');
      setConnectionMessage('Connection established. Provider is reachable and responding.');

      if (discovered.length > 0) {
        const modelIds = discovered.map(m => m.modelId).filter(Boolean) as string[];
        setModalModels(modelIds);
        setModalEnabledModels(modelIds);
        message.success(`Retrieved ${discovered.length} live models!`);
      } else {
        message.warning('Connected but no models were found.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setConnectionStatus('error');
      setConnectionMessage(`Connection failed: ${errorMsg}`);
      message.error('Connection test failed');
    }
  };

  const handleAuthenticateOnly = async () => {
    return; // Placeholder — reserved for future use
  };

  const handleUpdateModelList = async () => {
    const { providerId } = setupModal;
    if (!providerId) return;

    message.loading({ content: 'Updating models from provider...', key: 'model_update' });

    let url = baseUrlInput.trim();
    if (!url) {
      if (providerId === 'ollama') url = 'http://localhost:11434/v1';
      else if (providerId === 'openai') url = 'https://api.openai.com/v1';
      else if (providerId === 'google') url = 'https://generativelanguage.googleapis.com/v1';
      else if (providerId === 'anthropic') url = 'https://api.anthropic.com/v1';
    }

    const type = providerId === 'google' ? 'google' as const
      : providerId === 'anthropic' ? 'anthropic' as const
      : providerId === 'ollama' ? 'ollama' as const
      : 'openai' as const;

    try {
      const discovered = await modelDiscovery.discover(url, apiKeyInput, type);

      if (discovered.length === 0) {
        throw new Error('No models found in the endpoint response');
      }

      const modelIds = discovered.map(m => m.modelId).filter(Boolean) as string[];
      setModalModels(modelIds);
      setModalEnabledModels(modelIds);

      message.success({ content: `Successfully loaded ${discovered.length} models from provider!`, key: 'model_update' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      message.warning({
        content: `Could not fetch live models (${errorMsg}). Enter model names manually.`,
        key: 'model_update',
        duration: 5
      });
    }
  };

  const handleAddCustomModelName = () => {
    const name = customModelNameInput.trim();
    if (!name) {
      message.error('Model name cannot be empty');
      return;
    }
    if (modalModels.includes(name)) {
      message.error('Model already exists in the list');
      return;
    }

    const updatedCustom = [...modalCustomModels, name];
    setModalCustomModels(updatedCustom);
    setModalModels([...modalModels, name]);
    setModalEnabledModels([...modalEnabledModels, name]);
    
    setCustomModelNameInput('');
    setCustomModelModal(false);
    message.success(`Custom model "${name}" added`);
  };

  const toggleModelSelection = (modelId: string, checked: boolean) => {
    if (checked) {
      setModalEnabledModels([...modalEnabledModels, modelId]);
    } else {
      setModalEnabledModels(modalEnabledModels.filter((m) => m !== modelId));
    }
  };

  const toggleSelectDeselectAll = (checked: boolean) => {
    if (checked) {
      setModalEnabledModels([...modalModels]);
    } else {
      setModalEnabledModels([]);
    }
  };

  const handleRefreshChatGPTWebappModels = async () => {
    setIsRefreshingModels(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshingModels(false);
    message.success('ChatGPT models refreshed successfully');
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 600,
    lineHeight: '28px',
    color: token.colorText,
  };

  const sectionDesc: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: '20px',
    color: token.colorTextSecondary,
  };

  const optionCard: React.CSSProperties = {
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02)',
    borderRadius: 12,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
  };

  const providerLabel: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 500,
    color: token.colorText,
  };

  const providerRowStyle = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: token.colorBgContainer,
  };

  return (
    <div data-options-section="general" style={{ maxWidth: 768, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        
        {/* Account Section */}
        <div id="account-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={sectionTitle}>Account</div>
          <div style={optionCard}>
            <div style={{ padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
              {profile ? (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    {profile.avatar === 'george-li-bunny' ? (
                      <GeorgeLiAvatar />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserOutlined style={{ fontSize: 24, color: token.colorTextDisabled }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginRight: 'auto' }}>
                    <div style={{ fontWeight: 600, color: token.colorText, fontSize: 16 }}>{profile.name}</div>
                    <div style={{ fontSize: 14, color: token.colorTextSecondary }}>{profile.email}</div>
                  </div>
                  <Button
                    onClick={handleLogout}
                    style={{ borderRadius: 9999, borderColor: token.colorBorder, color: token.colorText, fontWeight: 500 }}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: token.colorBgLayout, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserOutlined style={{ fontSize: 24, color: token.colorTextDisabled }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginRight: 'auto' }}>
                    <div style={{ fontWeight: 600, color: token.colorTextDisabled }}>Not signed in</div>
                    <div style={{ fontSize: 14, color: token.colorTextDisabled }}>Sign in to sync your preferences</div>
                  </div>
                  <Button
                    type="primary"
                    onClick={handleSignIn}
                    style={{ borderRadius: 9999, paddingInline: 20, fontWeight: 500 }}
                  >
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Access Section */}
        <div id="ai-access-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={sectionTitle}>AI access</div>
          <div style={optionCard}>
            
            {/* Service Provider Select Block */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: token.colorText }}>Service provider</div>
              <Select
                value={serviceProvider}
                onChange={handleServiceProviderChange}
                style={{ width: 220, height: 38 }}
                options={[
                  { value: 'custom-api', label: 'Custom API Key' },
                  { value: 'chatgpt-webapp', label: 'ChatGPT Webapp' },
                  { value: 'copilot', label: 'Copilot Webapp' },
                ]}
              />
            </div>

            {/* Sub-panels based on provider selection */}
            {serviceProvider === 'custom-api' ? (
              <>
                <div style={{ padding: '0 24px 20px', ...sectionDesc, fontSize: 13, color: token.colorTextSecondary }}>
                  Your API key is stored locally in your browser and is never sent elsewhere.
                  <b> Note:</b> Some features are limited to Sider mode for technical reasons.
                </div>
                <div style={{ height: 1, background: token.colorBorderSecondary, marginInline: 24 }} />
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {providers.map((provider) => {
                      const logo = provider.id === 'openai' ? <OpenAILogo />
                        : provider.id === 'google' ? <GoogleGeminiLogo />
                        : provider.id === 'ollama' ? <OllamaLogo />
                        : <AnthropicLogo />;

                      return (
                        <div key={provider.id} style={providerRowStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {logo}
                            <span style={providerLabel}>{provider.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                            {provider.enabled ? (
                              <>
                                <EditOutlined
                                  style={{ fontSize: 16, color: '#4B5563', cursor: 'pointer' }}
                                  onClick={() => openSetupModal(provider.id)}
                                />
                                <Switch
                                  size="small"
                                  checked={provider.enabled}
                                  onChange={(checked) => toggleProvider(provider.id, checked)}
                                />
                              </>
                            ) : (
                              <span
                                style={{ cursor: 'pointer', color: '#4F46E5', fontWeight: 500, fontSize: 14 }}
                                onClick={() => openSetupModal(provider.id)}
                              >
                                Set up
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: '0 24px 24px' }}>
                <div style={{ color: '#4B5563', fontSize: 13, marginBottom: 16 }}>
                  Experience may vary for visitors and logged-in users due to {serviceProvider === 'chatgpt-webapp' ? "OpenAI's" : "Microsoft's"} restrictions.
                </div>
                
                <Button
                  icon={<SyncOutlined spin={isRefreshingModels} />}
                  onClick={handleRefreshChatGPTWebappModels}
                  loading={isRefreshingModels}
                  style={{
                    borderRadius: 9999,
                    border: '1px solid #E5E7EB',
                    color: '#374151',
                    fontWeight: 500,
                    height: 38,
                    paddingInline: 18,
                    marginBottom: 20,
                  }}
                >
                  Refresh models
                </Button>

                {/* Important reminders Box */}
                <div style={{
                  background: '#F4FBF7',
                  border: '1px solid #D1FAE5',
                  borderRadius: 12,
                  padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065F46', fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                    <InfoCircleOutlined style={{ fontSize: 16 }} />
                    <span>Important reminders</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#047857', fontSize: 13, lineHeight: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li>Remain logged in to your account.</li>
                    <li>This service may be unstable due to {serviceProvider === 'chatgpt-webapp' ? 'OpenAI' : 'Microsoft'} policy changes. For fast and stable performance, we recommend using Sider.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Appearance Section */}
        <div id="appearance-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={sectionTitle}>Appearance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Display mode and Language card */}
            <div style={optionCard}>
              {/* Display mode */}
              <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Display mode</div>
                <Select
                  value={mode}
                  onChange={handleThemeChange}
                  style={{ width: 220, height: 38 }}
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </div>
              <div style={{ height: 1, background: token.colorBorderSecondary }} />
              {/* Display Language */}
              <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Display language</div>
                <Select
                  value={displayLanguage}
                  onChange={handleDisplayLanguageChange}
                  style={{ width: 220, height: 38 }}
                  options={[
                    { value: 'english', label: 'English' },
                    { value: 'spanish', label: 'Spanish' },
                    { value: 'chinese', label: 'Chinese' },
                    { value: 'japanese', label: 'Japanese' },
                    { value: 'french', label: 'French' },
                    { value: 'german', label: 'German' },
                  ]}
                />
              </div>
            </div>

            {/* Side panel position card */}
            <div style={optionCard}>
              <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Side panel position</div>
                  <div style={{ fontSize: 13, color: token.colorTextSecondary }}>For Chrome 114 or higher, can only be changed in browser settings</div>
                </div>
                <Button 
                  type="text" 
                  icon={<ExportOutlined style={{ fontSize: 16, color: token.colorTextSecondary }} />} 
                  onClick={() => window.open('https://support.google.com/chrome', '_blank')}
                />
              </div>
            </div>

            {/* Read aloud card */}
            <div style={{ ...sectionTitle, marginTop: 16 }}>Read aloud</div>
            <div style={optionCard}>
              {/* Default voice */}
              <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Default voice</div>
                  <div style={{ fontSize: 13, color: token.colorTextSecondary }}>Choose the default text-to-speech voice for reading aloud</div>
                </div>
                <Select
                  value={defaultVoice}
                  onChange={async (val) => {
                    setDefaultVoice(val);
                    await chrome.storage.local.set({ np_tts_voice: val });
                    message.success('Default voice updated');
                  }}
                  style={{ width: 220 }}
                  options={[
                    { value: 'default', label: 'System Default' },
                    ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` })),
                  ]}
                />
              </div>
              
              <div style={{ height: 1, background: token.colorBorderSecondary }} />

              {/* Default speed */}
              <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}>Default speed</div>
                  <div style={{ fontSize: 13, color: token.colorTextSecondary }}>Adjust the speech rate multiplier (current: {defaultSpeed}x)</div>
                </div>
                <div style={{ width: 220, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Slider
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    value={defaultSpeed}
                    onChange={async (val) => {
                      setDefaultSpeed(val);
                      await chrome.storage.local.set({ np_tts_speed: val });
                    }}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#4B5563', minWidth: 32 }}>
                    {defaultSpeed.toFixed(1)}x
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* SETUP PROVIDER MODAL (From 72-options-general-serviceprovider-setup.png) */}
      <Modal
        title={null}
        open={setupModal.open}
        onCancel={() => setSetupModal({ open: false, providerId: null })}
        footer={null}
        width={560}
        centered
        closeIcon={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#F3F4F6' }}><CloseOutlined style={{ fontSize: 12, color: '#4B5563' }} /></div>}
        styles={{ body: { padding: '24px 32px' } }}
      >
        {setupModal.providerId && (() => {
          const provider = providers.find((p) => p.id === setupModal.providerId);
          const providerName = provider?.name || '';
          const providerId = setupModal.providerId;

          return (
            <div>
              {/* Header */}
              <div style={{ fontSize: 24, fontWeight: 700, color: token.colorText, marginBottom: 24 }}>
                Configure {providerName}
              </div>

              {/* Connection Info Card */}
              <div style={{
                background: token.colorBgLayout,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: isDark ? '#064e3b' : '#ECFDF5',
                  border: `1px solid ${isDark ? '#065f46' : '#D1FAE5'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? '#34d399' : '#10B981',
                  flexShrink: 0,
                }}>
                  <ApiOutlined style={{ fontSize: 20 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: token.colorText }}>
                    {providerName} Registry Connection
                  </div>
                  <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: '16px' }}>
                    {getRegistryDescription(providerId, providerName)}
                  </div>
                </div>
              </div>

              <Form layout="vertical">
                {/* API Key */}
                <Form.Item 
                  label={<span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>API Secret Key</span>}
                  style={{ marginBottom: 20 }}
                >
                  <Input.Password
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter API Key"
                    autoComplete="off"
                    style={{ height: 40, borderRadius: 8 }}
                  />
                  <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>
                    Saved locally inside your browser's client sandboxed storage container.
                  </div>
                </Form.Item>

                {/* Enable Custom Endpoint Switch */}
                <div style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: token.colorBgContainer
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>Enable Custom Endpoint</div>
                    <div style={{ fontSize: 12, color: token.colorTextSecondary }}>Use custom base URL instead of vendor default endpoint</div>
                  </div>
                  <Switch
                    checked={customEndpointEnabled}
                    onChange={(checked) => setCustomEndpointEnabled(checked)}
                  />
                </div>

                {/* API Proxy URL (Shown only when Custom Endpoint is enabled) */}
                {customEndpointEnabled && (
                  <Form.Item 
                    label={<span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>API proxy URL</span>}
                    style={{ marginBottom: 24 }}
                  >
                    <Input
                      value={baseUrlInput}
                      onChange={(e) => setBaseUrlInput(e.target.value)}
                      placeholder={
                        providerId === 'ollama' ? 'http://localhost:11434/v1' 
                        : providerId === 'openai' ? 'http://localhost:12380/v1' 
                        : 'https://api.openai.com/v1'
                      }
                      style={{ height: 40, borderRadius: 8 }}
                    />
                  </Form.Item>
                )}
              </Form>

              {/* Test Connection Results Alert */}
              {connectionStatus !== 'idle' && connectionStatus !== 'testing' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 20,
                  background: connectionStatus === 'success' ? '#ECFDF5' : '#FEF2F2',
                  border: connectionStatus === 'success' ? '1px solid #A7F3D0' : '1px solid #FCA5A5',
                  color: connectionStatus === 'success' ? '#065F46' : '#991B1B',
                  fontSize: 13,
                }}>
                  {connectionStatus === 'success' ? <CheckCircleOutlined style={{ color: '#10B981' }} /> : <ExclamationCircleOutlined style={{ color: '#EF4444' }} />}
                  <span style={{ fontWeight: 500 }}>{connectionMessage}</span>
                </div>
              )}

              {/* Model List Actions Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                marginTop: 24,
              }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#4B5563', letterSpacing: '0.05em' }}>
                  AVAILABLE MODEL NAMESPACES
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Update list button: only available when the connection is successful, and icon only without title */}
                  {connectionStatus === 'success' && (
                    <Button
                      type="text"
                      icon={<SyncOutlined />}
                      onClick={handleUpdateModelList}
                      style={{
                        padding: 0,
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#4B5563',
                      }}
                      title="Update list"
                    />
                  )}

                  {/* Select/Deselect all text link */}
                  <Button
                    type="link"
                    onClick={() => {
                      const allSelected = modalEnabledModels.length === modalModels.length;
                      toggleSelectDeselectAll(!allSelected);
                    }}
                    style={{
                      padding: 0,
                      height: 'auto',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#4F46E5',
                    }}
                  >
                    {modalEnabledModels.length === modalModels.length && modalModels.length > 0 ? 'Deselect all' : 'Select all'}
                  </Button>
                </div>
              </div>

              {/* Scrollable Model List */}
              <div style={{
                maxHeight: 280,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 24,
                paddingRight: 4,
              }}>
                {modalModels.map((mId) => {
                  const isEnabled = modalEnabledModels.includes(mId);

                  return (
                    <div
                      key={mId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 12,
                        background: token.colorBgContainer,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600, color: token.colorText, fontSize: 14 }}>{mId}</span>
                        <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>Context Window: {estimateContextWindow(mId).toLocaleString()} tokens</span>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onChange={(checked) => toggleModelSelection(mId, checked)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Modal Bottom Save & Check Connection Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <Button
                  onClick={handleTestConnection}
                  loading={connectionStatus === 'testing'}
                  style={{ borderRadius: 8, height: 40, paddingInline: 20, fontWeight: 500 }}
                >
                  Test Connection
                </Button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Button
                    onClick={() => setSetupModal({ open: false, providerId: null })}
                    style={{ borderRadius: 8, height: 40, paddingInline: 20, fontWeight: 500 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    onClick={handleSaveSetup}
                    style={{ borderRadius: 8, height: 40, paddingInline: 24, fontWeight: 600, background: '#4F46E5', borderColor: '#4F46E5' }}
                  >
                    Save settings
                  </Button>
                </div>
              </div>

            </div>
          );
        })()}
      </Modal>

    </div>
  );
}
