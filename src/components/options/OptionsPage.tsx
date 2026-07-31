import React, { useState, useMemo } from 'react';
import { Modal, Input, Select, Button, Switch, Typography, Form, App } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LogoutOutlined,
  CheckOutlined,
  CloseOutlined,
  ControlOutlined,
  LayoutOutlined,
  MenuOutlined,
  TranslationOutlined,
  GlobalOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

import { useExtensionStore } from '../../store/useExtensionStore';
import { useThemeStore } from '../../core/theme/ThemeStore';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { AppearanceSettings } from '../../entrypoints/options/components/AppearanceSettings';
import { UserAvatar } from '../common/UserAvatar';
import { PromptCategory, CustomProviderId, CustomModelItem, CustomProviderDetail } from '../../types';
import { createOpenAIAdapter } from '../../core/ai/providers/openai';
import { createAnthropicAdapter } from '../../core/ai/providers/anthropic';
import { createGeminiAdapter } from '../../core/ai/providers/gemini';
import { createOllamaAdapter } from '../../core/ai/providers/ollama';
import { fetchProviderModels } from '../../services/aiProvider';
import type { ProviderAdapter } from '../../core/ai/providers/ProviderAdapter';

const { Title } = Typography;

// Provider SVG Icons
const OpenAiIcon: React.FC = () => (
  <svg className="w-4 h-4 text-zinc-800 dark:text-zinc-200" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.47 4.47 0 0 1-.5355-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4997 4.4997 0 0 1-6.1408-1.6464zM2.3423 8.587a4.4652 4.4652 0 0 1 2.3655-1.9728V12.15a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.5045 4.5045 0 0 1 2.3423 8.587zm16.5963 3.8558L13.101 9.0792l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.682a.7901.7901 0 0 0-.407-.686zm2.0107-3.0231l-.142-.0852-4.7735-2.7582a.7712.7712 0 0 0-.7806 0L9.4104 9.9448V7.6124a.0757.0757 0 0 1 .0332-.0615l4.8303-2.7866a4.4997 4.4997 0 0 1 6.6802 4.6577zm-12.6403 1.2827l2.8344-1.6325 2.8344 1.6325v3.265l-2.8344 1.6326-2.8344-1.6326z" />
  </svg>
);

const GoogleGeminiIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const OllamaIcon: React.FC = () => (
  <svg className="w-4 h-4 text-zinc-800 dark:text-zinc-200" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-3-9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-6.8 4a5 5 0 0 0 7.6 0 .8.8 0 0 0-1.2-1 3.4 3.4 0 0 1-5.2 0 .8.8 0 0 0-1.2 1z"/>
  </svg>
);

const ClaudeIcon: React.FC = () => (
  <svg className="w-4 h-4 text-zinc-800 dark:text-zinc-200" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 22h4l2-4h8l2 4h4L12 2zm-2.5 12L12 8.5l2.5 5.5h-5z" />
  </svg>
);

const PROVIDER_INFO: Record<CustomProviderId, { name: string; icon: React.ReactNode; defaultProxy: string; defaultModels: string[] }> = {
  openai: {
    name: 'OpenAI',
    icon: <OpenAiIcon />,
    defaultProxy: '',
    defaultModels: ['gemma-4-e2b-it-4bit', 'gpt-4o', 'gpt-4o-mini'],
  },
  gemini: {
    name: 'Google (Gemini)',
    icon: <GoogleGeminiIcon />,
    defaultProxy: 'https://generativelanguage.googleapis.com',
    defaultModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
  },
  ollama: {
    name: 'Ollama',
    icon: <OllamaIcon />,
    defaultProxy: 'http://localhost:11434',
    defaultModels: ['llama3.2', 'deepseek-r1:8b', 'qwen2.5-coder:7b'],
  },
  claude: {
    name: 'Anthropic (Claude)',
    icon: <ClaudeIcon />,
    defaultProxy: 'https://api.anthropic.com',
    defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
};

export const OptionsPage: React.FC = () => {
  const { message: antMessage } = App.useApp();
  const { config, updateConfig, prompts, addPrompt, updatePrompt, deletePrompt } = useExtensionStore();

  const [activeTab, setActiveTab] = useState<'General' | 'Translate' | 'Prompts'>('General');

  const availableTranslationModels = useMemo(() => {
    const models: { value: string; label: string }[] = [];
    if (config.providers) {
      (Object.values(config.providers) as CustomProviderDetail[]).forEach(p => {
        p.models?.forEach(m => {
          if (m.enabled && !models.some(x => x.value === m.name)) {
            models.push({ value: m.name, label: m.name });
          }
        });
      });
    }

    const defaults = [
      'gemma-4-e2b-it-4bit',
      'gpt-4o',
      'gpt-4o-mini',
      'claude-3-5-sonnet-20241022',
      'gemini-1.5-pro',
    ];

    defaults.forEach(d => {
      if (!models.some(x => x.value === d)) {
        models.push({ value: d, label: d });
      }
    });

    return models;
  }, [config.providers]);

  const sampleOriginalText = "ChatGPT funciona con el Transformer, un modelo de aprendizaje profundo diseñado para el procesamiento del lenguaje natural, que cuenta con redes neuronales de autoatención y feedforward.";

  const getSampleTranslation = (targetLang?: string) => {
    switch (targetLang) {
      case 'Simplified Chinese':
        return "ChatGPT 由 Transformer 驱动，这是一种专门用于自然语言处理的深度学习模型，具有自注意力机制和前馈神经网络。";
      case 'Traditional Chinese':
        return "ChatGPT 由 Transformer 驅動，這是一種專門用於自然語言處理的深度學習模型，具有自注意力機制和前饋神經網絡。";
      case 'Japanese':
        return "ChatGPT は、セルフアテンションとフィードフォワードニューラルネットワークを備えた、自然言語処理用に設計された深層学習モデルである Transformer によって動かされています。";
      case 'English':
      default:
        return "ChatGPT is powered by the Transformer, a deep learning model designed for natural language processing, featuring self-attention and feedforward neural networks.";
    }
  };

  // Provider Modal state
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [activeModalProviderId, setActiveModalProviderId] = useState<CustomProviderId | null>(null);

  const [modalApiKey, setModalApiKey] = useState('');
  const [modalUseCustomProxy, setModalUseCustomProxy] = useState(false);
  const [modalProxyUrl, setModalProxyUrl] = useState('');
  const [modalModels, setModalModels] = useState<CustomModelItem[]>([]);
  const [modalCheckingConn, setModalCheckingConn] = useState(false);
  const [addCustomModelOpen, setAddCustomModelOpen] = useState(false);
  const [newModelNameInput, setNewModelNameInput] = useState('');

  const [listUpdated, setListUpdated] = useState(false);
  const [editingCustomModelId, setEditingCustomModelId] = useState<string | null>(null);
  const [editingModelNameInput, setEditingModelNameInput] = useState('');

  // Prompts state
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('Writing');
  const [newPromptModalOpen, setNewPromptModalOpen] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const [promptForm] = Form.useForm();

  // Handlers for Provider Configuration Modal
  const handleOpenProviderModal = (providerId: CustomProviderId) => {
    setActiveModalProviderId(providerId);
    const detail = config.providers?.[providerId] || {
      id: providerId,
      name: PROVIDER_INFO[providerId].name,
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: providerId === 'openai' || providerId === 'ollama',
      proxyUrl: PROVIDER_INFO[providerId].defaultProxy,
      models: [],
    };

    setModalApiKey(detail.apiKey || '');
    setModalUseCustomProxy(detail.useCustomProxy ?? (providerId === 'openai' || providerId === 'ollama'));
    setModalProxyUrl(detail.proxyUrl || PROVIDER_INFO[providerId].defaultProxy);
    setModalModels(detail.models || []);
    setModalCheckingConn(false);
    setAddCustomModelOpen(false);
    setNewModelNameInput('');
    setListUpdated(false);
    setEditingCustomModelId(null);
    setProviderModalOpen(true);
  };

  const handleSaveProviderModal = () => {
    if (!activeModalProviderId) return;

    const currentDetail = config.providers?.[activeModalProviderId];
    const isConfigured = modalApiKey.trim().length > 0 || modalModels.length > 0;

    const updatedProviders = {
      ...config.providers,
      [activeModalProviderId]: {
        id: activeModalProviderId,
        name: PROVIDER_INFO[activeModalProviderId].name,
        isConfigured,
        enabled: currentDetail ? currentDetail.enabled : isConfigured,
        apiKey: modalApiKey,
        useCustomProxy: modalUseCustomProxy,
        proxyUrl: modalProxyUrl,
        models: modalModels,
      },
    };

    updateConfig({
      providers: updatedProviders,
      openAiKey: activeModalProviderId === 'openai' ? modalApiKey : config.openAiKey,
      openAiBaseUrl: activeModalProviderId === 'openai' ? modalProxyUrl : config.openAiBaseUrl,
    });

    setProviderModalOpen(false);
    antMessage.success(`${PROVIDER_INFO[activeModalProviderId].name} settings saved`);
  };

  const handleToggleProviderEnabled = (providerId: CustomProviderId, enabled: boolean) => {
    const currentDetail = config.providers?.[providerId];
    if (!currentDetail) return;

    const updatedProviders = {
      ...config.providers,
      [providerId]: {
        ...currentDetail,
        enabled,
      },
    };

    updateConfig({ providers: updatedProviders });
    antMessage.info(`${PROVIDER_INFO[providerId].name} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleCheckConnection = async () => {
    if (!activeModalProviderId) return;
    setModalCheckingConn(true);
    try {
      const proxyUrl = modalUseCustomProxy && modalProxyUrl ? modalProxyUrl : undefined;
      let adapter: ProviderAdapter;
      switch (activeModalProviderId) {
        case 'openai':
          adapter = createOpenAIAdapter(modalApiKey, proxyUrl);
          break;
        case 'claude':
          adapter = createAnthropicAdapter(modalApiKey);
          break;
        case 'gemini':
          adapter = createGeminiAdapter(modalApiKey);
          break;
        case 'ollama':
          adapter = createOllamaAdapter(proxyUrl);
          break;
      }
      const result = await adapter!.validateConnection();
      if (result.ok) {
        antMessage.success('Connection verified successfully!');
        const models = result.models.length > 0
          ? result.models.map((m, idx) => ({ id: m, name: m, enabled: idx < 2 }))
          : PROVIDER_INFO[activeModalProviderId].defaultModels.map((m, idx) => ({
              id: m, name: m, enabled: idx === 1 || idx === 0,
            }));
        setModalModels(models);
      } else {
        antMessage.error('Connection failed. Check your API key and proxy URL.');
      }
    } catch {
      antMessage.error('Connection failed. Check your API key and proxy URL.');
    } finally {
      setModalCheckingConn(false);
    }
  };

  const handleUpdateList = async () => {
    if (!activeModalProviderId) return;
    setListUpdated(true);

    const fetched = await fetchProviderModels(
      activeModalProviderId,
      modalApiKey,
      modalUseCustomProxy ? modalProxyUrl : undefined,
    );

    if (fetched.length > 0) {
      const existingCustoms = modalModels.filter(m => m.isCustom);
      const merged = [
        ...fetched.map((m, idx) => ({
          ...m,
          enabled: idx < 2,
        })),
        ...existingCustoms,
      ];
      setModalModels(merged);
      antMessage.success(`Updated model list (${merged.length} models available)`);
    } else {
      const defaults = PROVIDER_INFO[activeModalProviderId].defaultModels;
      const existingCustoms = modalModels.filter(m => m.isCustom);
      const newStandards = defaults.map((m, idx) => {
        const existing = modalModels.find(x => x.id === m);
        return existing || { id: m, name: m, enabled: idx === 1 };
      });
      const merged = [...newStandards, ...existingCustoms];
      setModalModels(merged);
      antMessage.success(`Updated model list (${merged.length} models available)`);
    }
  };

  const handleAddCustomModel = () => {
    if (!newModelNameInput.trim()) return;
    const newName = newModelNameInput.trim();
    if (modalModels.some(m => m.id === newName || m.name === newName)) {
      antMessage.warning('Model already exists in the list');
      return;
    }

    const newModelItem: CustomModelItem = {
      id: newName,
      name: newName,
      enabled: true,
      isCustom: true,
    };

    setModalModels(prev => [newModelItem, ...prev]);
    setNewModelNameInput('');
    setAddCustomModelOpen(false);
    antMessage.success(`Added model: ${newName}`);
  };

  const handleSaveEditingCustomModel = () => {
    if (!editingCustomModelId || !editingModelNameInput.trim()) return;
    const newName = editingModelNameInput.trim();
    setModalModels(prev => prev.map(m => m.id === editingCustomModelId ? { ...m, name: newName, id: newName } : m));
    setEditingCustomModelId(null);
    setEditingModelNameInput('');
    antMessage.success('Model updated');
  };

  const handleToggleModelInModal = (modelId: string, checked: boolean) => {
    setModalModels(prev => prev.map(m => m.id === modelId ? { ...m, enabled: checked } : m));
  };

  const handleDeleteCustomModel = (modelId: string) => {
    setModalModels(prev => prev.filter(m => m.id !== modelId));
    antMessage.info('Model removed');
  };

  const handleSavePrompt = async () => {
    try {
      const values = await promptForm.validateFields();
      if (editingPromptId) {
        updatePrompt(editingPromptId, values);
        antMessage.success('Prompt updated');
      } else {
        addPrompt({
          id: 'p_' + Date.now(),
          title: values.title,
          content: values.content,
          category: values.category || promptCategory,
          showInList: values.showInList ?? true,
        });
        antMessage.success('Prompt created');
      }
      setNewPromptModalOpen(false);
      promptForm.resetFields();
      setEditingPromptId(null);
    } catch {
      // validation error
    }
  };

  const providerListKeys: CustomProviderId[] = ['openai', 'gemini', 'ollama', 'claude'];

  return (
    <div className="flex h-screen w-screen bg-[var(--np-bg)] text-[var(--np-fg)] font-sans overflow-hidden p-[10px] gap-[10px]">
      {/* Options Sidebar Navigation */}
      <div className="w-60 bg-transparent text-[var(--np-fg)] rounded-[20px] border-none p-4 flex flex-col justify-between flex-shrink-0 select-none">
        <div>
          <div className="flex items-center gap-2.5 px-2 mb-8">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-[var(--np-border)] shadow-xs">
              <NowPilotAvatar className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-base tracking-tight text-[var(--np-fg)]">NowPilot</span>
          </div>

          <div className="space-y-1">
            {[
              { key: 'General', label: 'General', icon: <ControlOutlined /> },
              { key: 'Translate', label: 'Translate', icon: <TranslationOutlined /> },
              { key: 'Prompts', label: 'Prompts', icon: <EditOutlined /> },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-medium cursor-pointer transition-all ${
                  activeTab === item.key
                    ? 'bg-[var(--np-accent)] text-[var(--np-accent-fg)] font-semibold shadow-2xs'
                    : 'text-[var(--np-muted-fg)] hover:bg-[var(--np-muted)]'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <div className="my-2 border-t border-[var(--np-border)]" />

            <a
              href="#"
              onClick={e => { e.preventDefault(); antMessage.info('Help Center opened'); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-base font-medium text-[var(--np-muted-fg)] hover:bg-[var(--np-muted)] transition-all cursor-pointer"
            >
              <span className="flex items-center gap-3">
                <span className="text-lg"><QuestionCircleOutlined /></span>
                <span>Help Center</span>
              </span>
              <span className="text-[var(--np-muted-fg)] text-sm">↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Options Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl bg-transparent">
        {activeTab === 'General' && (
          <div className="space-y-8">
            {/* Account Card */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Title level={3} className="!mb-0 font-bold !text-[var(--np-fg)]">Account</Title>
                {listUpdated && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-2xs">
                    <CheckOutlined className="text-xs" />
                    <span>Model updated successfully</span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-[var(--np-card)] text-[var(--np-fg)] rounded-2xl border border-[var(--np-border)] flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--np-border)]">
                    <UserAvatar className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--np-fg)]">George Li</div>
                    <div className="text-xs text-[var(--np-muted-fg)]">oraclexp@hotmail.com</div>
                  </div>
                </div>
                <Button
                  size="middle"
                  className="!rounded-full !px-5 !border-[var(--np-border)] !text-violet-600 dark:!text-violet-400 font-medium text-xs hover:!border-violet-300"
                >
                  Log out
                </Button>
              </div>
            </div>

            {/* AI Access Settings */}
            <div>
              <Title level={3} className="!mb-4 font-bold !text-[var(--np-fg)]">AI access</Title>
              <div className="p-5 bg-[var(--np-card)] text-[var(--np-fg)] rounded-2xl border border-[var(--np-border)] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[var(--np-fg)]">Service provider</span>
                  <Select
                    value={config.serviceProvider || 'ChatGPT Webapp'}
                    onChange={(val) => updateConfig({ serviceProvider: val })}
                    options={[
                      { value: 'ChatGPT Webapp', label: 'ChatGPT Webapp' },
                      { value: 'Custom API Key', label: 'Custom API Key' },
                    ]}
                    className="w-48"
                  />
                </div>

                {(config.serviceProvider || 'ChatGPT Webapp') === 'ChatGPT Webapp' ? (
                  <>
                    <div className="text-xs text-[var(--np-muted-fg)] leading-relaxed">
                      Experience may vary for visitors and logged-in users due to OpenAI's restrictions.
                    </div>

                    <div className="pt-2 border-t border-[var(--np-border)] space-y-4">
                      <Button
                        onClick={() => {
                          setListUpdated(true);
                          antMessage.success('Model updated successfully');
                          setTimeout(() => setListUpdated(false), 3500);
                        }}
                        className="!rounded-full !px-4 !border-[var(--np-border)] text-xs font-medium text-[var(--np-fg)] flex items-center gap-1.5"
                      >
                        <ReloadOutlined className="text-xs text-[var(--np-muted-fg)]" />
                        <span>Refresh models</span>
                      </Button>

                      {/* Important Reminders Box */}
                      <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/80 dark:border-emerald-900/30 text-xs space-y-2 text-[var(--np-fg)]">
                        <div className="font-bold flex items-center gap-1.5 text-[var(--np-fg)]">
                          <InfoCircleOutlined className="text-emerald-600 dark:text-emerald-400 text-sm" />
                          <span>Important reminders</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-[var(--np-muted-fg)]">
                          <li>Remain logged in to your account.</li>
                          <li>
                            This service may be unstable due to OpenAI policy changes. For fast and stable performance, we recommend using Sider.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-[var(--np-muted-fg)] leading-relaxed">
                      Your API key is stored locally in your browser and is never sent elsewhere.
                    </div>

                    {/* 4 Providers Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {providerListKeys.map((key) => {
                        const info = PROVIDER_INFO[key];
                        const detail = config.providers?.[key] || {
                          id: key,
                          name: info.name,
                          isConfigured: false,
                          enabled: false,
                          apiKey: '',
                          useCustomProxy: false,
                          proxyUrl: '',
                          models: [],
                        };

                        return (
                          <div
                            key={key}
                            className="p-3 bg-[var(--np-muted)] rounded-xl border border-[var(--np-border)] flex items-center justify-between transition-all hover:border-[var(--np-ring)]"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-md bg-[var(--np-card)] border border-[var(--np-border)] flex items-center justify-center shadow-2xs">
                                {info.icon}
                              </div>
                              <span className="font-medium text-xs text-[var(--np-fg)]">
                                {info.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {detail.isConfigured ? (
                                <>
                                  <button
                                    onClick={() => handleOpenProviderModal(key)}
                                    className="text-[var(--np-muted-fg)] hover:text-violet-600 dark:hover:text-violet-400 p-1 transition-colors cursor-pointer"
                                  >
                                    <EditOutlined className="text-xs" />
                                  </button>
                                  <Switch
                                    checked={detail.enabled}
                                    onChange={(checked) => handleToggleProviderEnabled(key, checked)}
                                    size="small"
                                  />
                                </>
                              ) : (
                                <button
                                  onClick={() => handleOpenProviderModal(key)}
                                  className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                                >
                                  Set up
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Appearance Settings */}
            <div>
              <Title level={3} className="!mb-4 font-bold !text-[var(--np-fg)]">Appearance</Title>
              <div className="space-y-4">
                <AppearanceSettings />

                <div className="p-5 bg-[var(--np-card)] rounded-[24px] border border-[var(--np-border)] shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[var(--np-fg)]">Display language</span>
                    <Select
                      value={config.language || 'English'}
                      onChange={val => updateConfig({ language: val })}
                      options={[
                        { value: 'English', label: 'English' },
                        { value: 'Chinese', label: 'Chinese (Simplified)' },
                        { value: 'Japanese', label: 'Japanese' },
                      ]}
                      className="w-48"
                    />
                  </div>
                </div>
              </div>

              {/* Shoutout Banner Box */}
              <div className="mt-4 p-5 bg-[var(--np-card)] rounded-2xl border border-[var(--np-border)] space-y-4 shadow-2xs">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50/80 via-purple-50/50 to-indigo-50/80 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-indigo-950/30 border border-violet-100 dark:border-violet-900/40 space-y-2">
                  <div className="text-xs text-[var(--np-muted-fg)]">
                    Give a shoutout to the Sider extension.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">
                      S
                    </div>
                    <span className="text-xs font-bold text-[var(--np-fg)]">Sider Fusion</span>
                  </div>
                  <div className="text-xs text-[var(--np-muted-fg)] leading-relaxed">
                    Sider enhances browsing with AI, streamlining tasks and boosting productivity. An essential tool for efficient online navigation!
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-semibold text-sm text-[var(--np-fg)]">Font size for message</div>
                  </div>
                  <Select
                    value={config.fontSize || 'Regular'}
                    onChange={val => updateConfig({ fontSize: val })}
                    options={[
                      { value: 'Auto', label: 'Auto' },
                      { value: 'Small', label: 'Small' },
                      { value: 'Regular', label: 'Regular' },
                      { value: 'Large', label: 'Large' },
                    ]}
                    className="w-36"
                  />
                </div>
              </div>
            </div>

            {/* Side panel position */}
            <div className="p-5 bg-[var(--np-card)] rounded-2xl border border-[var(--np-border)] flex items-center justify-between shadow-2xs">
              <div>
                <div className="font-semibold text-sm text-[var(--np-fg)]">Side panel position</div>
                <div className="text-xs text-[var(--np-muted-fg)] mt-0.5">For Chrome 114 or higher, can only be changed in browser settings</div>
              </div>
              <a href="#" onClick={(e) => { e.preventDefault(); antMessage.info('Opened browser settings'); }} className="text-[var(--np-muted-fg)] hover:text-[var(--np-fg)] text-sm">
                ↗
              </a>
            </div>
          </div>
        )}

        {activeTab !== 'General' && activeTab !== 'Translate' && activeTab !== 'Prompts' && (
          <div className="p-8 bg-[var(--np-card)] rounded-2xl border border-[var(--np-border)] space-y-4 max-w-2xl shadow-2xs">
            <Title level={3} className="!mb-2 font-bold !text-[var(--np-fg)]">{activeTab}</Title>
            <p className="text-xs text-[var(--np-muted-fg)] leading-relaxed">
              Configure options and settings for {activeTab}. Preferences are synchronized automatically.
            </p>
          </div>
        )}

        {activeTab === 'Translate' && (
          <div className="space-y-6 max-w-3xl">
            <Title level={2} className="!mb-6 font-bold !text-[var(--np-fg)]">Page translate</Title>

            <div className="p-6 bg-[var(--np-card)] text-[var(--np-fg)] rounded-3xl border border-[var(--np-border)] shadow-2xs space-y-6">
              {/* Sample translation preview box */}
              <div className="p-6 bg-[var(--np-muted)] rounded-2xl border border-[var(--np-border)] shadow-2xs space-y-3">
                {(config.translateDisplayMode || 'Bilingual') === 'Bilingual' && (
                  <p className="text-[var(--np-fg)] font-normal leading-relaxed text-sm">
                    {sampleOriginalText}
                  </p>
                )}
                <p className={`text-sm font-normal leading-relaxed ${
                  (config.translateDisplayStyle || 'Underline') === 'Underline'
                    ? 'text-[var(--np-fg)] underline decoration-dotted decoration-[var(--np-muted-fg)] underline-offset-4'
                    : (config.translateDisplayStyle || 'Underline') === 'Weaken'
                    ? 'text-[var(--np-muted-fg)]'
                    : 'text-[var(--np-fg)]'
                }`}>
                  {getSampleTranslation(config.translateTargetLang || 'English')}
                </p>
              </div>

              {/* Translation service */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-sm text-[var(--np-fg)]">Translation service</span>
                <Select
                  value={config.translateService || 'gemma-4-e2b-it-4bit'}
                  onChange={(val) => updateConfig({ translateService: val })}
                  options={availableTranslationModels.map(m => ({
                    value: m.value,
                    label: (
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="text-xs">⚡</span> {m.label}
                      </span>
                    )
                  }))}
                  className="w-64"
                />
              </div>

              {/* Target language */}
              <div className="flex items-center justify-between border-t border-[var(--np-border)] pt-5">
                <span className="font-bold text-sm text-[var(--np-fg)]">Target language</span>
                <Select
                  value={config.translateTargetLang || 'English'}
                  onChange={(val) => updateConfig({ translateTargetLang: val })}
                  options={[
                    { value: 'English', label: 'English' },
                    { value: 'Simplified Chinese', label: 'Simplified Chinese' },
                    { value: 'Traditional Chinese', label: 'Traditional Chinese' },
                    { value: 'Japanese', label: 'Japanese' },
                  ]}
                  className="w-64"
                />
              </div>

              {/* Display mode */}
              <div className="flex items-center justify-between border-t border-[var(--np-border)] pt-5">
                <span className="font-bold text-sm text-[var(--np-fg)]">Display mode</span>
                <Select
                  value={config.translateDisplayMode || 'Bilingual'}
                  onChange={(val) => updateConfig({ translateDisplayMode: val })}
                  options={[
                    { value: 'Bilingual', label: 'Bilingual' },
                    { value: 'Translation only', label: 'Translation only' },
                  ]}
                  className="w-64"
                />
              </div>

              {/* Display style */}
              <div className="flex items-center justify-between border-t border-[var(--np-border)] pt-5">
                <div>
                  <div className="font-bold text-sm text-[var(--np-fg)]">Display style</div>
                  <div className="text-xs text-[var(--np-muted-fg)] mt-0.5">Only for translations in bilingual comparison mode</div>
                </div>
                <Select
                  value={config.translateDisplayStyle || 'Underline'}
                  onChange={(val) => updateConfig({ translateDisplayStyle: val })}
                  options={[
                    { value: 'None', label: 'None' },
                    { value: 'Underline', label: 'Underline' },
                    { value: 'Weaken', label: 'Weaken' },
                  ]}
                  className="w-64"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Prompts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <Title level={2} className="!m-0 font-bold !text-[var(--np-fg)]">Prompts</Title>
              <div className="flex items-center gap-2">
                <Button icon={<ReloadOutlined />} onClick={() => antMessage.info('Prompts refreshed')}>
                  Refresh
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingPromptId(null);
                    promptForm.resetFields();
                    setNewPromptModalOpen(true);
                  }}
                  style={{ backgroundColor: '#7c3aed', borderRadius: 10 }}
                >
                  New Prompt
                </Button>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 mb-6">
              {(['Chat/Ask', 'Reading', 'Writing'] as PromptCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setPromptCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    promptCategory === cat
                      ? 'bg-[var(--np-accent)] text-[var(--np-accent-fg)] font-bold shadow-2xs'
                      : 'bg-[var(--np-card)] text-[var(--np-muted-fg)] hover:bg-[var(--np-muted)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Side-by-side Draggable List Columns */}
            <div className="grid grid-cols-2 gap-6">
              {/* Show in list Column */}
              <div className="p-4 bg-[var(--np-card)] rounded-2xl border border-[var(--np-border)]">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--np-muted-fg)] uppercase tracking-wider mb-3">
                  <span>Show in list</span>
                </div>
                <div className="space-y-2">
                  {prompts
                    .filter(p => p.category === promptCategory && p.showInList)
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-[var(--np-muted)] rounded-xl border border-[var(--np-border)] text-xs"
                      >
                        <span className="font-semibold text-[var(--np-fg)] truncate">{p.title}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingPromptId(p.id);
                              promptForm.setFieldsValue(p);
                              setNewPromptModalOpen(true);
                            }}
                            className="text-[var(--np-muted-fg)] hover:text-[var(--np-fg)] cursor-pointer"
                          >
                            <EditOutlined />
                          </button>
                          <button
                            onClick={() => {
                              deletePrompt(p.id);
                              antMessage.success('Prompt deleted');
                            }}
                            className="text-[var(--np-muted-fg)] hover:text-red-500 cursor-pointer"
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Hidden in list Column */}
              <div className="p-4 bg-[var(--np-card)] rounded-2xl border border-[var(--np-border)]">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--np-muted-fg)] uppercase tracking-wider mb-3">
                  <span>Hidden in list</span>
                </div>
                <div className="space-y-2">
                  {prompts
                    .filter(p => p.category === promptCategory && !p.showInList)
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-[var(--np-muted)] rounded-xl border border-[var(--np-border)] text-xs opacity-75"
                      >
                        <span className="font-semibold text-[var(--np-fg)] truncate">{p.title}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingPromptId(p.id);
                              promptForm.setFieldsValue(p);
                              setNewPromptModalOpen(true);
                            }}
                            className="text-[var(--np-muted-fg)] hover:text-[var(--np-fg)] cursor-pointer"
                          >
                            <EditOutlined />
                          </button>
                          <button
                            onClick={() => {
                              deletePrompt(p.id);
                              antMessage.success('Prompt deleted');
                            }}
                            className="text-[var(--np-muted-fg)] hover:text-red-500 cursor-pointer"
                          >
                            <DeleteOutlined />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Configuration Modal (Matching Image 03-options-general-customAPI-openAI.png) */}
      <Modal
        open={providerModalOpen}
        onCancel={() => setProviderModalOpen(false)}
        onOk={handleSaveProviderModal}
        okText="Save"
        okButtonProps={{ style: { backgroundColor: '#7c3aed' } }}
        title={
          <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
            {activeModalProviderId ? PROVIDER_INFO[activeModalProviderId].name : ''}
          </span>
        }
        width={480}
      >
        <div className="space-y-5 py-2">
          {/* API key */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              API key
            </label>
            <Input.Password
              placeholder="Enter your API key"
              value={modalApiKey}
              onChange={e => setModalApiKey(e.target.value)}
              iconRender={visible => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
              className="rounded-lg"
            />
          </div>

          {/* API proxy URL (optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                API proxy URL (optional)
              </label>
              <Switch
                checked={modalUseCustomProxy}
                onChange={setModalUseCustomProxy}
                size="small"
              />
            </div>
            {modalUseCustomProxy && (
              <Input
                placeholder={activeModalProviderId ? PROVIDER_INFO[activeModalProviderId].defaultProxy : 'http://localhost:12380/v1'}
                value={modalProxyUrl}
                onChange={e => setModalProxyUrl(e.target.value)}
                className="rounded-lg mt-1"
              />
            )}
          </div>

          {/* Check connection */}
          <div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-0.5">
              Check connection
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Check if your API key and proxy (if used) are valid.</span>
              <Button
                type="primary"
                onClick={handleCheckConnection}
                loading={modalCheckingConn}
                style={{ backgroundColor: '#7c3aed', borderRadius: 8 }}
                size="small"
              >
                Check
              </Button>
            </div>
          </div>

          {/* Model list */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                Model list <span className="text-zinc-400 font-normal ml-1">({modalModels.length} models available)</span>
              </div>
              <div className="flex items-center gap-3">
                {listUpdated ? (
                  <button
                    onClick={handleUpdateList}
                    className="text-emerald-500 dark:text-emerald-400 font-medium flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <CheckOutlined /> Updated
                  </button>
                ) : (
                  <button
                    onClick={handleUpdateList}
                    className="text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 font-normal cursor-pointer text-xs"
                  >
                    <ReloadOutlined /> Update list
                  </button>
                )}
                <button
                  onClick={() => {
                    setAddCustomModelOpen(true);
                    setNewModelNameInput('');
                  }}
                  className="text-zinc-600 dark:text-zinc-300 hover:text-violet-600 font-bold px-1.5 py-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add Custom Model Inline Box matching screenshot */}
            {addCustomModelOpen && (
              <div className="flex items-center justify-between p-2 px-3 mb-2.5 rounded-xl border-2 border-violet-600 dark:border-violet-500 bg-white dark:bg-zinc-900 shadow-2xs">
                <input
                  type="text"
                  placeholder="Enter model name (e.g. test1)"
                  value={newModelNameInput}
                  onChange={e => setNewModelNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustomModel(); }}
                  className="w-full bg-transparent outline-none text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 font-mono"
                  autoFocus
                />
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <button
                    onClick={handleAddCustomModel}
                    className="w-6 h-6 rounded-md bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center text-xs shadow-2xs cursor-pointer transition-colors"
                    title="Confirm"
                  >
                    <CheckOutlined />
                  </button>
                  <button
                    onClick={() => { setAddCustomModelOpen(false); setNewModelNameInput(''); }}
                    className="w-6 h-6 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-xs cursor-pointer transition-colors"
                    title="Cancel"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              </div>
            )}

            {/* Model List Rendering */}
            {modalModels.length === 0 && !addCustomModelOpen ? (
              <div className="text-center py-6 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                No models available. Click 'Update list' or 'Check' to load models, or click '+' to add.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {modalModels.map(m => {
                  if (editingCustomModelId === m.id) {
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 px-3 rounded-xl border-2 border-violet-600 dark:border-violet-500 bg-white dark:bg-zinc-900 shadow-2xs"
                      >
                        <input
                          type="text"
                          value={editingModelNameInput}
                          onChange={e => setEditingModelNameInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEditingCustomModel(); }}
                          className="w-full bg-transparent outline-none text-xs text-zinc-800 dark:text-zinc-200 font-mono"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                          <button
                            onClick={handleSaveEditingCustomModel}
                            className="w-6 h-6 rounded-md bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center text-xs shadow-2xs cursor-pointer transition-colors"
                            title="Save"
                          >
                            <CheckOutlined />
                          </button>
                          <button
                            onClick={() => { setEditingCustomModelId(null); setEditingModelNameInput(''); }}
                            className="w-6 h-6 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center text-xs cursor-pointer transition-colors"
                            title="Cancel"
                          >
                            <CloseOutlined />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 text-xs border border-zinc-100 dark:border-zinc-700/50"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate">{m.name}</span>
                        {m.capabilities?.vision && (
                          <span className="text-blue-500 dark:text-blue-400 text-xs" title="Supports image/vision input">
                            <EyeOutlined />
                          </span>
                        )}
                        {m.isCustom && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              onClick={() => {
                                setEditingCustomModelId(m.id);
                                setEditingModelNameInput(m.name);
                              }}
                              className="text-zinc-400 hover:text-violet-600 cursor-pointer transition-colors p-0.5"
                              title="Edit model name"
                            >
                              <EditOutlined className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomModel(m.id)}
                              className="text-zinc-400 hover:text-red-500 cursor-pointer transition-colors p-0.5"
                              title="Remove custom model"
                            >
                              <DeleteOutlined className="text-xs" />
                            </button>
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={m.enabled}
                        onChange={(checked) => handleToggleModelInModal(m.id, checked)}
                        size="small"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* New / Edit Prompt Modal */}
      <Modal
        open={newPromptModalOpen}
        onCancel={() => setNewPromptModalOpen(false)}
        footer={null}
        title={<span className="font-bold">{editingPromptId ? 'Edit Prompt' : 'New Prompt'}</span>}
      >
        <Form form={promptForm} layout="vertical" onFinish={handleSavePrompt} className="mt-4">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Prompt Title" />
          </Form.Item>
          <Form.Item name="content" label="Prompt Template" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Content..." />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Select options={[{ value: 'Chat/Ask' }, { value: 'Reading' }, { value: 'Writing' }]} />
          </Form.Item>
          <Form.Item name="showInList" label="Show in list" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setNewPromptModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: '#7c3aed' }}>Save</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
