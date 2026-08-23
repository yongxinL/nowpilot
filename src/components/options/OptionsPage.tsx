import React, { useState, useMemo } from 'react';
import { Modal, Input, Select, Button, Switch, Typography, Form, App, Segmented } from 'antd';
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
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
} from '@ant-design/icons';

import { useExtensionStore } from '../../store/useExtensionStore';
import { useThemeStore } from '../../core/theme/ThemeStore';
import { COLOR_THEMES } from '../../core/theme/ThemeConfig';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { UserAvatar } from '../common/UserAvatar';
import { PromptsOptionsTab } from './PromptsOptionsTab';
import { PromptCategory, CustomProviderId, CustomModelItem, CustomProviderDetail } from '../../types';
import { testProviderConnection } from '../../services/aiProvider';

const { Title } = Typography;

// Provider SVG Icons
const OpenAiIcon: React.FC = () => (
  <svg style={{
            width: 16,
            height: 16,
            color: 'var(--foreground)',
          }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.47 4.47 0 0 1-.5355-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4997 4.4997 0 0 1-6.1408-1.6464zM2.3423 8.587a4.4652 4.4652 0 0 1 2.3655-1.9728V12.15a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.5045 4.5045 0 0 1 2.3423 8.587zm16.5963 3.8558L13.101 9.0792l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.682a.7901.7901 0 0 0-.407-.686zm2.0107-3.0231l-.142-.0852-4.7735-2.7582a.7712.7712 0 0 0-.7806 0L9.4104 9.9448V7.6124a.0757.0757 0 0 1 .0332-.0615l4.8303-2.7866a4.4997 4.4997 0 0 1 6.6802 4.6577zm-12.6403 1.2827l2.8344-1.6325 2.8344 1.6325v3.265l-2.8344 1.6326-2.8344-1.6326z" />
  </svg>
);

const GoogleGeminiIcon: React.FC = () => (
  <svg style={{
            width: 16,
            height: 16,
          }} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const OllamaIcon: React.FC = () => (
  <svg style={{
            width: 16,
            height: 16,
            color: 'var(--foreground)',
          }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-3-9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm-6.8 4a5 5 0 0 0 7.6 0 .8.8 0 0 0-1.2-1 3.4 3.4 0 0 1-5.2 0 .8.8 0 0 0-1.2 1z"/>
  </svg>
);

const ClaudeIcon: React.FC = () => (
  <svg style={{
            width: 16,
            height: 16,
            color: 'var(--foreground)',
          }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 22h4l2-4h8l2 4h4L12 2zm-2.5 12L12 8.5l2.5 5.5h-5z" />
  </svg>
);

const PROVIDER_INFO: Record<CustomProviderId, { name: string; icon: React.ReactNode; defaultProxy: string; defaultModels: string[] }> = {
  openai: {
    name: 'OpenAI',
    icon: <OpenAiIcon />,
    defaultProxy: 'http://localhost:12380/v1',
    defaultModels: ['Qwen3.5-9B-OptiQ-4bit', 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', 'gemma-4-e2b-it-4bit'],
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
  const colorTheme = useThemeStore((s) => s.colorTheme);
  const setColorTheme = useThemeStore((s) => s.setColorTheme);

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
      'MiniCPM5-1B-OptiQ-4bit',
      'Qwen3.5-9B-OptiQ-4bit',
      'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx',
      'gemma-4-e2b-it-4bit',
      'claude-3-5-sonnet',
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
      // D-12 / D-03: real connection test. The previous 1s setTimeout
      // unconditionally reported success and silently populated defaults
      // — that masked broken credentials / wrong endpoint. testProviderConnection
      // surfaces the real success / failure; on success we still seed the
      // model list with defaults if the user hasn't customised it yet.
      const result = await testProviderConnection(
        activeModalProviderId,
        modalApiKey || undefined,
        modalUseCustomProxy && modalProxyUrl ? modalProxyUrl : undefined,
      );
      if (result.ok) {
        antMessage.success('Connection verified successfully!');
        if (modalModels.length === 0 && activeModalProviderId) {
          const defaults = PROVIDER_INFO[activeModalProviderId].defaultModels.map((m, idx) => ({
            id: m,
            name: m,
            enabled: idx === 1 || idx === 0,
          }));
          setModalModels(defaults);
        }
      } else {
        antMessage.error(result.error);
      }
    } catch (err) {
      // Defensive — testProviderConnection itself doesn't throw, but any
      // unforeseen runtime error in the call chain must NOT leave the UI
      // stuck in a "checking" state.
      const message = err instanceof Error ? err.message : String(err);
      antMessage.error(`Connection test failed: ${message}`);
    } finally {
      setModalCheckingConn(false);
    }
  };

  const handleUpdateList = () => {
    if (!activeModalProviderId) return;
    const defaults = PROVIDER_INFO[activeModalProviderId].defaultModels;

    const existingCustoms = modalModels.filter(m => m.isCustom);
    const newStandards = defaults.map((m, idx) => {
      const existing = modalModels.find(x => x.id === m);
      return existing || { id: m, name: m, enabled: idx === 1 };
    });

    const merged = [...newStandards, ...existingCustoms];
    setModalModels(merged);
    setListUpdated(true);
    antMessage.success(`Updated model list (${merged.length} models available)`);
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
    <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            background: 'var(--muted)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
            padding: 10,
            gap: 10,
          }}>
      {/* Options Sidebar Navigation */}
      <div style={{
            width: 240,
            background: '#f6f6f8',
            borderRadius: 20,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
            userSelect: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 8,
            paddingRight: 8,
            marginBottom: 32,
          }}>
            <div style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
              <NowPilotAvatar style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }} />
            </div>
            <span style={{
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
          }}>NowPilot</span>
          </div>

          <div style={{
            rowGap: 4,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {[
              { key: 'General', label: 'General', icon: <ControlOutlined /> },
              { key: 'Translate', label: 'Translate', icon: <TranslationOutlined /> },
              { key: 'Prompts', label: 'Prompts', icon: <EditOutlined /> },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key as any)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: activeTab === item.key ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  background: activeTab === item.key ? '#ede9fe' : 'transparent',
                  color: activeTab === item.key ? '#6d28d9' : 'var(--muted-foreground)',
                  boxShadow: activeTab === item.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <span style={{
            fontSize: 18,
          }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <div style={{
            marginTop: 8,
            marginBottom: 8,
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
          }} />

            <a
              href="#"
              onClick={e => { e.preventDefault(); antMessage.info('Help Center opened'); }}
              style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            transition: 'all 200ms ease',
            cursor: 'pointer',
          }}
            >
              <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
                <span style={{
            fontSize: 18,
          }}><QuestionCircleOutlined /></span>
                <span>Help Center</span>
              </span>
              <span style={{
            color: 'var(--muted-foreground)',
            fontSize: 14,
          }}>↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Options Content */}
      <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 32,
            maxWidth: 896,
            background: 'transparent',
          }}>
        {activeTab === 'General' && (
          <div style={{
            rowGap: 32,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Account Card */}
            <div>
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}>
                <Title level={3} style={{
            marginBottom: 0,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>Account</Title>
                {listUpdated && (
                  <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
            background: '#ecfdf5',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#a7f3d0',
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 600,
            color: '#059669',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                    <CheckOutlined style={{
            fontSize: 12,
          }} />
                    <span>Model updated successfully</span>
                  </div>
                )}
              </div>
              <div style={{
            padding: 16,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
                  <div style={{
            width: 40,
            height: 40,
            borderRadius: 9999,
            overflow: 'hidden',
          }}>
                    <UserAvatar style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }} />
                  </div>
                  <div>
                    <div style={{
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>George Li</div>
                    <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>oraclexp@hotmail.com</div>
                  </div>
                </div>
                <Button
                  size="middle"
                  style={{
            borderRadius: 9999,
            paddingLeft: 20,
            paddingRight: 20,
            borderColor: 'var(--border)',
            color: '#7c3aed',
            fontWeight: 500,
            fontSize: 12,
          }}
                >
                  Log out
                </Button>
              </div>
            </div>

            {/* AI Access Settings */}
            <div>
              <Title level={3} style={{
            marginBottom: 16,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>AI access</Title>
              <div style={{
            padding: 20,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            rowGap: 16,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Service provider</span>
                  <Select
                    value={config.serviceProvider || 'ChatGPT Webapp'}
                    onChange={(val) => updateConfig({ serviceProvider: val })}
                    options={[
                      { value: 'ChatGPT Webapp', label: 'ChatGPT Webapp' },
                      { value: 'Custom API Key', label: 'Custom API Key' },
                    ]}
                    style={{
            width: 192,
          }}
                  />
                </div>

                {(config.serviceProvider || 'ChatGPT Webapp') === 'ChatGPT Webapp' ? (
                  <>
                    <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            lineHeight: 1.625,
          }}>
                      Experience may vary for visitors and logged-in users due to OpenAI's restrictions.
                    </div>

                    <div style={{
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            rowGap: 16,
            display: 'flex',
            flexDirection: 'column',
          }}>
                      <Button
                        onClick={() => {
                          setListUpdated(true);
                          antMessage.success('Model updated successfully');
                          setTimeout(() => setListUpdated(false), 3500);
                        }}
                        style={{
            borderRadius: 9999,
            paddingLeft: 16,
            paddingRight: 16,
            borderColor: 'var(--border)',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
                      >
                        <ReloadOutlined style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }} />
                        <span>Refresh models</span>
                      </Button>

                      {/* Important Reminders Box */}
                      <div style={{
            padding: 16,
            background: '#ecfdf5',
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#d1fae5',
            fontSize: 12,
            rowGap: 8,
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--muted-foreground)',
          }}>
                        <div style={{
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--foreground)',
          }}>
                          <InfoCircleOutlined style={{
            color: '#059669',
            fontSize: 14,
          }} />
                          <span>Important reminders</span>
                        </div>
                        <ul style={{
            listStyleType: 'disc',
            paddingLeft: 20,
            rowGap: 4,
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--muted-foreground)',
          }}>
                          <li>Remain logged in to your account.</li>
                          <li>
                            This service may be unstable due to OpenAI policy changes. For fast and stable performance, we recommend using NowPilot.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            lineHeight: 1.625,
          }}>
                      Your API key is stored locally in your browser and is never sent elsewhere.
                    </div>

                    {/* 4 Providers Grid */}
                    <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            paddingTop: 8,
          }}>
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
                            style={{
            padding: 12,
            background: 'var(--muted)',
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 200ms ease',
          }}
                          >
                            <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
                              <div style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: 'var(--card)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                                {info.icon}
                              </div>
                              <span style={{
            fontWeight: 500,
            fontSize: 12,
            color: 'var(--foreground)',
          }}>
                                {info.name}
                              </span>
                            </div>

                            <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                              {detail.isConfigured ? (
                                <>
                                  <button
                                    onClick={() => handleOpenProviderModal(key)}
                                    style={{
            color: 'var(--muted-foreground)',
            padding: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}
                                  >
                                    <EditOutlined style={{
            fontSize: 12,
          }} />
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
                                  style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#2563eb',
            cursor: 'pointer',
          }}
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
              <Title level={3} style={{
            marginBottom: 16,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>Appearance</Title>
              <div style={{
            padding: 20,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            rowGap: 20,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                {/* Display mode */}
                <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            paddingBottom: 16,
          }}>
                  <div>
                    <div style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Display mode</div>
                    <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>
                      Choose between light mode, dark mode, or follow your system preferences.
                    </div>
                  </div>
                  <Select
                    value={config.themeMode || 'Auto'}
                    onChange={(val) => {
                      const nextMode = val as 'Auto' | 'Light' | 'Dark';
                      updateConfig({ themeMode: nextMode });
                      useThemeStore.getState().setMode(nextMode.toLowerCase() as any);
                    }}
                    style={{ width: 170 }}
                    options={[
                      {
                        value: 'Auto',
                        label: (
                          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                            <DesktopOutlined style={{
            color: 'var(--muted-foreground)',
          }} />
                            <span>Auto</span>
                          </div>
                        ),
                      },
                      {
                        value: 'Light',
                        label: (
                          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                            <SunOutlined style={{
            color: '#f59e0b',
          }} />
                            <span>Light</span>
                          </div>
                        ),
                      },
                      {
                        value: 'Dark',
                        label: (
                          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                            <MoonOutlined style={{
            color: '#818cf8',
          }} />
                            <span>Dark</span>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                {/* Theme */}
                <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 12,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            paddingBottom: 16,
          }}>
                  <div>
                    <div style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Theme</div>
                    <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>
                      Select the color theme applied across workspace, sidepanel chat, and options.
                    </div>
                  </div>

                  <Select
                    value={colorTheme || 'system'}
                    onChange={(val) => {
                      setColorTheme(val);
                      updateConfig({ colorTheme: val });
                    }}
                    style={{ width: 170 }}
                    options={COLOR_THEMES.map((themeItem) => ({
                      value: themeItem.id,
                      label: (
                        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 9999,
                              flexShrink: 0,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                              backgroundColor: themeItem.primary,
                            }}
                          />
                          <span>{themeItem.name}</span>
                        </div>
                      ),
                    }))}
                  />
                </div>

                {/* Display language */}
                <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Display language</span>
                  <Select
                    value={config.language || 'English'}
                    onChange={val => updateConfig({ language: val })}
                    options={[
                      { value: 'English', label: 'English' },
                    ]}
                    style={{
            width: 144,
          }}
                  />
                </div>
              </div>

              {/* Shoutout Banner Box */}
              <div style={{
            marginTop: 16,
            padding: 20,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            rowGap: 16,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                <div
                  className={
                    (config.fontSize || 'Auto') === 'Small'
                      ? 'message-font-small'
                      : (config.fontSize || 'Auto') === 'Large'
                        ? 'message-font-large'
                        : 'message-font-regular'
                  }
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: 'linear-gradient(to right, var(--muted) 0%, var(--muted) 50%, var(--muted) 80%)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: 'var(--border)',
                    rowGap: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: 340,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    transition: 'all 200ms ease',
                  }}
                >
                  <div style={{
            color: 'var(--muted-foreground)',
          }}>
                    Give a shoutout to the NowPilot extension.
                  </div>
                  <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 9999,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'var(--np-primary, #1677ff)',
                      }}
                    >
                      N
                    </div>
                    <span style={{
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>NowPilot</span>
                  </div>
                  <div style={{
            color: 'var(--muted-foreground)',
            lineHeight: 1.625,
          }}>
                    NowPilot enhances browsing with AI, streamlining tasks and boosting productivity. An essential tool for efficient online navigation!
                  </div>
                </div>

                <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}>
                  <div>
                    <div style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Font size for message</div>
                    {(config.fontSize === 'Auto' || !config.fontSize) && (
                      <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>
                        Auto adjust according to sidebar width
                      </div>
                    )}
                  </div>
                  <Select
                    value={config.fontSize || 'Auto'}
                    onChange={val => updateConfig({ fontSize: val })}
                    options={[
                      { value: 'Auto', label: 'Auto' },
                      { value: 'Small', label: 'Small' },
                      { value: 'Regular', label: 'Regular' },
                      { value: 'Large', label: 'Large' },
                    ]}
                    style={{
            width: 144,
          }}
                  />
                </div>
              </div>
            </div>

            {/* Side panel position */}
            <div style={{
            padding: 20,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
              <div>
                <div style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Side panel position</div>
                <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>For Chrome 114 or higher, can only be changed in browser settings</div>
              </div>
              <a href="#" onClick={(e) => { e.preventDefault(); antMessage.info('Opened browser settings'); }} style={{
            color: 'var(--muted-foreground)',
            fontSize: 14,
          }}>
                ↗
              </a>
            </div>
          </div>
        )}

        {activeTab !== 'General' && activeTab !== 'Translate' && activeTab !== 'Prompts' && (
          <div style={{
            padding: 32,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            rowGap: 16,
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 672,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
            <Title level={3} style={{
            marginBottom: 8,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>{activeTab}</Title>
            <p style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            lineHeight: 1.625,
          }}>
              Configure options and settings for {activeTab}. Preferences are synchronized automatically.
            </p>
          </div>
        )}

        {activeTab === 'Translate' && (
          <div style={{
            rowGap: 24,
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 768,
          }}>
            <Title level={2} style={{
            marginBottom: 24,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>Page translate</Title>

            <div style={{
            padding: 24,
            background: 'var(--card)',
            borderRadius: 24,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            rowGap: 24,
            display: 'flex',
            flexDirection: 'column',
          }}>
              {/* Sample translation preview box */}
              <div style={{
            padding: 24,
            background: 'linear-gradient(to bottom, var(--muted) 0%, var(--card) 100%)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            rowGap: 12,
            display: 'flex',
            flexDirection: 'column',
          }}>
                {(config.translateDisplayMode || 'Bilingual') === 'Bilingual' && (
                  <p style={{
            color: 'var(--muted-foreground)',
            fontWeight: 400,
            lineHeight: 1.625,
            fontSize: 14,
          }}>
                    {sampleOriginalText}
                  </p>
                )}
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 400,
                    lineHeight: 1.625,
                    color: (config.translateDisplayStyle || 'Underline') === 'Weaken'
                      ? 'var(--muted-foreground)'
                      : 'var(--foreground)',
                    textDecoration: (config.translateDisplayStyle || 'Underline') === 'Underline' ? 'underline' : 'none',
                    textDecorationStyle: (config.translateDisplayStyle || 'Underline') === 'Underline' ? 'dotted' : 'solid',
                    textUnderlineOffset: (config.translateDisplayStyle || 'Underline') === 'Underline' ? 4 : 'auto',
                  }}
                >
                  {getSampleTranslation(config.translateTargetLang || 'English')}
                </p>
              </div>

              {/* Translation service */}
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}>
                <span style={{
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Translation service</span>
                <Select
                  value={config.translateService || 'MiniCPM5-1B-OptiQ-4bit'}
                  onChange={(val) => updateConfig({ translateService: val })}
                  options={availableTranslationModels.map(m => ({
                    value: m.value,
                    label: (
                      <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 500,
          }}>
                        <span style={{
            fontSize: 12,
          }}>⚡</span> {m.label}
                      </span>
                    )
                  }))}
                  style={{
            width: 256,
          }}
                />
              </div>

              {/* Target language */}
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            paddingTop: 20,
          }}>
                <span style={{
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Target language</span>
                <Select
                  value={config.translateTargetLang || 'English'}
                  onChange={(val) => updateConfig({ translateTargetLang: val })}
                  options={[
                    { value: 'English', label: 'English' },
                    { value: 'Simplified Chinese', label: 'Simplified Chinese' },
                    { value: 'Traditional Chinese', label: 'Traditional Chinese' },
                    { value: 'Japanese', label: 'Japanese' },
                  ]}
                  style={{
            width: 256,
          }}
                />
              </div>

              {/* Display mode */}
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            paddingTop: 20,
          }}>
                <span style={{
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Display mode</span>
                <Select
                  value={config.translateDisplayMode || 'Bilingual'}
                  onChange={(val) => updateConfig({ translateDisplayMode: val })}
                  options={[
                    { value: 'Bilingual', label: 'Bilingual' },
                    { value: 'Translation only', label: 'Translation only' },
                  ]}
                  style={{
            width: 256,
          }}
                />
              </div>

              {/* Display style */}
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            paddingTop: 20,
          }}>
                <div>
                  <div style={{
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--foreground)',
          }}>Display style</div>
                  <div style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            marginTop: 2,
          }}>Only for translations in bilingual comparison mode</div>
                </div>
                <Select
                  value={config.translateDisplayStyle || 'Underline'}
                  onChange={(val) => updateConfig({ translateDisplayStyle: val })}
                  options={[
                    { value: 'None', label: 'None' },
                    { value: 'Underline', label: 'Underline' },
                    { value: 'Weaken', label: 'Weaken' },
                  ]}
                  style={{
            width: 256,
          }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Prompts' && (
          <PromptsOptionsTab />
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
          <span style={{
            fontWeight: 700,
            fontSize: 18,
            color: 'var(--foreground)',
          }}>
            {activeModalProviderId ? PROVIDER_INFO[activeModalProviderId].name : ''}
          </span>
        }
        width={480}
      >
        <div style={{
            rowGap: 20,
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 8,
            paddingBottom: 8,
          }}>
          {/* API key */}
          <div>
            <label style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            display: 'block',
            marginBottom: 4,
          }}>
              API key
            </label>
            <Input.Password
              placeholder="Enter your API key"
              value={modalApiKey}
              onChange={e => setModalApiKey(e.target.value)}
              iconRender={visible => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
              style={{
            borderRadius: 8,
          }}
            />
          </div>

          {/* API proxy URL (optional) */}
          <div>
            <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}>
              <label style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
          }}>
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
                style={{
            borderRadius: 8,
            marginTop: 4,
          }}
              />
            )}
          </div>

          {/* Check connection */}
          <div>
            <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            marginBottom: 2,
          }}>
              Check connection
            </div>
            <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
              <span style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>Check if your API key and proxy (if used) are valid.</span>
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
          <div style={{
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
          }}>
            <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            marginBottom: 8,
          }}>
              <div style={{
            fontWeight: 600,
            color: 'var(--foreground)',
          }}>
                Model list <span style={{
            color: 'var(--muted-foreground)',
            fontWeight: 400,
            marginLeft: 4,
          }}>({modalModels.length} models available)</span>
              </div>
              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
                {listUpdated ? (
                  <button
                    onClick={handleUpdateList}
                    style={{
            color: '#10b981',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
                  >
                    <CheckOutlined /> Updated
                  </button>
                ) : (
                  <button
                    onClick={handleUpdateList}
                    style={{
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 400,
            cursor: 'pointer',
            fontSize: 12,
          }}
                  >
                    <ReloadOutlined /> Update list
                  </button>
                )}
                <button
                  onClick={() => {
                    setAddCustomModelOpen(true);
                    setNewModelNameInput('');
                  }}
                  style={{
            color: 'var(--muted-foreground)',
            fontWeight: 700,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 6,
            fontSize: 14,
            cursor: 'pointer',
          }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Add Custom Model Inline Box matching screenshot */}
            {addCustomModelOpen && (
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 8,
            paddingLeft: 12,
            paddingRight: 12,
            marginBottom: 10,
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: '#7c3aed',
            background: 'var(--card)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                <input
                  type="text"
                  placeholder="Enter model name (e.g. test1)"
                  value={newModelNameInput}
                  onChange={e => setNewModelNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustomModel(); }}
                  style={{
            width: '100%',
            background: 'transparent',
            outline: 'none',
            fontSize: 12,
            color: 'var(--foreground)',
            fontFamily: 'var(--font-mono)',
          }}
                  autoFocus
                />
                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 8,
            flexShrink: 0,
          }}>
                  <button
                    onClick={handleAddCustomModel}
                    style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#7c3aed',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
                    title="Confirm"
                  >
                    <CheckOutlined />
                  </button>
                  <button
                    onClick={() => { setAddCustomModelOpen(false); setNewModelNameInput(''); }}
                    style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
                    title="Cancel"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              </div>
            )}

            {/* Model List Rendering */}
            {modalModels.length === 0 && !addCustomModelOpen ? (
              <div style={{
            textAlign: 'center',
            paddingTop: 24,
            paddingBottom: 24,
            fontSize: 12,
            color: 'var(--muted-foreground)',
            background: 'var(--muted)',
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'var(--border)',
          }}>
                No models available. Click 'Update list' or 'Check' to load models, or click '+' to add.
              </div>
            ) : (
              <div style={{
            rowGap: 8,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 192,
            overflowY: 'auto',
            paddingRight: 4,
          }}>
                {modalModels.map(m => {
                  if (editingCustomModelId === m.id) {
                    return (
                      <div
                        key={m.id}
                        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 8,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: '#7c3aed',
            background: 'var(--card)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
                      >
                        <input
                          type="text"
                          value={editingModelNameInput}
                          onChange={e => setEditingModelNameInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveEditingCustomModel(); }}
                          style={{
            width: '100%',
            background: 'transparent',
            outline: 'none',
            fontSize: 12,
            color: 'var(--foreground)',
            fontFamily: 'var(--font-mono)',
          }}
                          autoFocus
                        />
                        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 8,
            flexShrink: 0,
          }}>
                          <button
                            onClick={handleSaveEditingCustomModel}
                            style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#7c3aed',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
                            title="Save"
                          >
                            <CheckOutlined />
                          </button>
                          <button
                            onClick={() => { setEditingCustomModelId(null); setEditingModelNameInput(''); }}
                            style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
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
                      style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 10,
            borderRadius: 12,
            background: 'var(--muted)',
            fontSize: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
          }}
                    >
                      <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            paddingRight: 8,
          }}>
                        <span style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{m.name}</span>
                        {m.isCustom && (
                          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            marginLeft: 4,
          }}>
                            <button
                              onClick={() => {
                                setEditingCustomModelId(m.id);
                                setEditingModelNameInput(m.name);
                              }}
                              style={{
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            padding: 2,
          }}
                              title="Edit model name"
                            >
                              <EditOutlined style={{
            fontSize: 12,
          }} />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomModel(m.id)}
                              style={{
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            padding: 2,
          }}
                              title="Remove custom model"
                            >
                              <DeleteOutlined style={{
            fontSize: 12,
          }} />
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
        title={<span style={{
            fontWeight: 700,
          }}>{editingPromptId ? 'Edit Prompt' : 'New Prompt'}</span>}
      >
        <Form form={promptForm} layout="vertical" onFinish={handleSavePrompt} style={{
            marginTop: 16,
          }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Prompt Title" />
          </Form.Item>
          <Form.Item name="content" label="Prompt Template" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Content..." />
          </Form.Item>
          <Form.Item name="category" label="Category" initialValue="Writing">
            <Select
              options={[
                { value: 'Writing', label: 'Writing (Write)' },
                { value: 'Reply', label: 'Reply' },
                { value: 'Reading', label: 'Reading' },
                { value: 'Chat/Ask', label: 'Chat/Ask' },
              ]}
            />
          </Form.Item>
          <Form.Item name="showInList" label="Show in list" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}>
            <Button onClick={() => setNewPromptModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: '#7c3aed' }}>Save</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
