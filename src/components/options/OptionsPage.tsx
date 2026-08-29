import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Input, Select, Button, Switch, Typography, Form, App, Segmented, Tooltip } from 'antd';
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
import { persistProviderConfigEncrypted } from '../../store/useExtensionStore';
import { useThemeStore } from '../../core/theme/ThemeStore';
import { COLOR_THEMES } from '../../core/theme/ThemeConfig';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { UserAvatar } from '../common/UserAvatar';
import { PromptsOptionsTab } from './PromptsOptionsTab';
import { PromptCategory, CustomProviderId, CustomModelItem, CustomProviderDetail } from '../../types';
import { testProviderConnection, fetchProviderModels } from '../../services/aiProvider';
import { useUserPreferencesStore } from '../../core/ai/UserPreferences';
import { ProviderRegistry } from '../../core/ai/ProviderRegistry';
import {
  chromeStorageAdapter,
  flushPendingWrites,
} from '../../core/theme/chromeStorageAdapter';
import { debugLog } from '../../core/log/debugLog';

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

const PROVIDER_INFO: Record<CustomProviderId, { name: string; icon: React.ReactNode; defaultProxy: string }> = {
  openai: {
    name: 'OpenAI',
    icon: <OpenAiIcon />,
    // WR-06: the §10.6 canonical endpoint — the legacy dev-proxy default
    // (http://localhost:12380/v1, D-12) must never be pre-filled or persisted.
    defaultProxy: 'https://api.openai.com/v1',
  },
  gemini: {
    name: 'Google (Gemini)',
    icon: <GoogleGeminiIcon />,
    defaultProxy: 'https://generativelanguage.googleapis.com',
  },
  ollama: {
    name: 'Ollama',
    icon: <OllamaIcon />,
    defaultProxy: 'http://localhost:11434',
  },
  claude: {
    name: 'Anthropic (Claude)',
    icon: <ClaudeIcon />,
    defaultProxy: 'https://api.anthropic.com',
  },
};

/**
 * D-50 (03-07): write one provider's endpoint override into
 * `np_endpoint_overrides` (chrome.storage.local). ProviderRegistry merges
 * this over the §10.6 ENDPOINTS defaults at hydrate (03-05) — the runtime
 * endpoint = np_endpoint_overrides[providerId] ?? §10.6 default. A missing
 * entry falls back to the default. Disk 'claude' maps to runtime 'anthropic'
 * at this boundary ONLY (D-49). `localhost:12380` is never a canonical
 * default (D-12). Values are zod-validated http(s) at the write AND at
 * registry hydrate (T-3-24) — a malformed URL never reaches the fetch layer.
 */
async function writeEndpointOverride(
  providerId: CustomProviderId,
  url: string | undefined,
): Promise<void> {
  const runtimeId = providerId === 'claude' ? 'anthropic' : providerId;
  let overrides: Record<string, string> = {};
  try {
    const raw = await chromeStorageAdapter.getItem('np_endpoint_overrides');
    if (raw) overrides = JSON.parse(raw) as Record<string, string>;
  } catch {
    overrides = {};
  }
  if (url !== undefined && url.length > 0) {
    overrides[runtimeId] = url;
  } else {
    delete overrides[runtimeId];
  }
  await chromeStorageAdapter.setItem('np_endpoint_overrides', JSON.stringify(overrides));
  await flushPendingWrites();
}

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
    // D-11: no static fallback list — the selector renders only models
    // enabled in the provider modal (fetched live from the AI provider).
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

  // D-54 (03-07): fast/balanced tier assignment. Local UI state initialized
  // from the persisted np_preferences store — values stay UNSET until the
  // operator explicitly selects and confirms Save (D-54a). The store actions
  // (setFastModel/setBalancedModel) fire ONLY in handleSaveTierAssignment —
  // the discovery/pre-fill path never persists (grep gate).
  const prefs = useUserPreferencesStore();
  const [fastTierModel, setFastTierModel] = useState<string | undefined>(prefs.fastModel);
  const [balancedTierModel, setBalancedTierModel] = useState<string | undefined>(prefs.balancedModel);
  const [tierModels, setTierModels] = useState<{ value: string; label: string }[]>([]);
  const [tierModelsLoading, setTierModelsLoading] = useState(false);

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

    // D-28 / UI-SPEC E1 partial: never pre-fill the stored (decrypted)
    // API key. The in-memory `detail.apiKey` is plaintext hydrated from
    // np_providers at boot (Phase 2 §A6), but the modal's editable
    // field MUST start as '' every time so the saved key never appears
    // in the value/placeholder/aria-label of the input. Saved-key
    // detection drives the masked placeholder instead.
    setModalApiKey('');
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

  const handleSaveProviderModal = async () => {
    if (!activeModalProviderId) return;

    const currentDetail = config.providers?.[activeModalProviderId];
    const trimmedApiKey = modalApiKey.trim();
    const effectiveApiKey = trimmedApiKey.length > 0 ? modalApiKey : (currentDetail?.apiKey ?? '');
    const isConfigured = effectiveApiKey.length > 0 || modalModels.length > 0;

    const updatedConfig = {
      ...config,
      providers: {
        ...config.providers,
        [activeModalProviderId]: {
          id: activeModalProviderId,
          name: PROVIDER_INFO[activeModalProviderId].name,
          isConfigured,
          enabled: currentDetail ? currentDetail.enabled : isConfigured,
          apiKey: effectiveApiKey,
          useCustomProxy: modalUseCustomProxy,
          proxyUrl: modalProxyUrl,
          models: modalModels,
        },
      },
      openAiKey: activeModalProviderId === 'openai' ? effectiveApiKey : config.openAiKey,
      openAiBaseUrl: activeModalProviderId === 'openai' ? modalProxyUrl : config.openAiBaseUrl,
    };

    try {
      // D-28: persist the encrypted np_providers FIRST (write-first);
      // updateConfig's partialize strip runs synchronously and writes a
      // plaintext-stripped np_store. Throwing here prevents claiming
      // false success (UI-SPEC E1 error row).
      await persistProviderConfigEncrypted(updatedConfig);
      updateConfig({
        providers: updatedConfig.providers,
        openAiKey: updatedConfig.openAiKey,
        openAiBaseUrl: updatedConfig.openAiBaseUrl,
      });

      // D-50 (03-07): persist the per-provider endpoint override so the
      // runtime endpoint = np_endpoint_overrides[providerId] ?? §10.6 default
      // (merged at ProviderRegistry hydrate, 03-05). Disabling the custom
      // proxy removes the override (fall back to the §10.6 default). A
      // non-http(s) URL is rejected BEFORE the write (T-3-24 — a malformed
      // value must never reach the fetch layer); the provider config save
      // still succeeds, the override just falls back to the default.
      const wantsOverride = modalUseCustomProxy && modalProxyUrl.trim().length > 0;
      // WR-06: an untouched pre-filled proxy (equal to the provider's
      // defaultProxy) is NOT an operator intent — persisting it would turn a
      // UI default into a runtime endpoint override. Only an operator-edited
      // URL writes np_endpoint_overrides.
      const effectiveOverrideUrl =
        wantsOverride && modalProxyUrl.trim() !== PROVIDER_INFO[activeModalProviderId].defaultProxy
          ? modalProxyUrl.trim()
          : undefined;
      if (wantsOverride && effectiveOverrideUrl === undefined && modalProxyUrl.trim().length > 0) {
        // The field holds the default — treat as "no override"; nothing to validate.
        await writeEndpointOverride(activeModalProviderId, undefined);
      } else if (effectiveOverrideUrl !== undefined && !/^https?:\/\//i.test(effectiveOverrideUrl)) {
        antMessage.error('Custom proxy URL must start with http(s):// — endpoint override not saved');
      } else {
        try {
          await writeEndpointOverride(activeModalProviderId, effectiveOverrideUrl);
        } catch (writeErr) {
          // Best-effort override persist — storage failure must not fail the
          // provider save; the registry keeps the §10.6 default.
          debugLog('ENDPOINT_OVERRIDE_WRITE_FAILED', writeErr instanceof Error ? writeErr.message : String(writeErr));
        }
      }

      setProviderModalOpen(false);
      // Sync the in-memory ProviderRegistry entry. The modal may implicitly
      // flip `enabled` to true on first save (`currentDetail` undefined →
      // `isConfigured`), so mirror the post-save value into the registry.
      // Without this, getEnabled() returns stale `false` and the AI tier
      // assignment's "Discover models" finds nothing.
      const runtimeId = activeModalProviderId === 'claude' ? 'anthropic' : activeModalProviderId;
      ProviderRegistry.setEnabled(runtimeId as any, updatedConfig.providers[activeModalProviderId].enabled);
      antMessage.success(`${PROVIDER_INFO[activeModalProviderId].name} settings saved`);
    } catch (err) {
      // STORAGE_QUOTA / STORAGE_RATE_LIMIT / etc. — surface to
      // ErrorStore (via debugLog) but never to the user (UI-SPEC E1
      // error row: "no false success"). The modal stays open so the
      // user can retry; ErrorStore/debugLog keep the diagnostic.
      // eslint-disable-next-line no-console
      console.error('Provider save failed:', err instanceof Error ? err.message : String(err));
      // No success toast.
    }
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
    // Sync the in-memory ProviderRegistry entry so `getEnabled()` reflects the
    // toggle on the same tick. The Zustand persist path writes `np_store`, NOT
    // `np_providers`, so a re-hydration would still see the pre-toggle value.
    // DISK_TO_RUNTIME mapping: 'claude' → 'anthropic' (ProviderRegistry key).
    const runtimeId = providerId === 'claude' ? 'anthropic' : providerId;
    ProviderRegistry.setEnabled(runtimeId as any, enabled);
    antMessage.info(`${PROVIDER_INFO[providerId].name} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleCheckConnection = async () => {
    if (!activeModalProviderId) return;
    setModalCheckingConn(true);
    try {
      // D-12 / D-03: real connection test. When the modal field is empty
      // (the user opened the modal for a provider with a saved key and
      // did not re-type) we pass the stored in-memory key to the
      // connection check transiently — it never lands in modalApiKey or
      // any rendered attribute (UI-SPEC E1 partial + backstop). The
      // stored value comes from the in-memory `config.providers.*.apiKey`
      // populated by `hydrateProviderSecrets()` at boot (Phase 2 Task 2).
      const currentDetail = config.providers?.[activeModalProviderId];
      const keyToTest = modalApiKey.trim().length > 0
        ? modalApiKey
        : (currentDetail?.apiKey || undefined);

      const result = await testProviderConnection(
        activeModalProviderId,
        keyToTest,
        modalUseCustomProxy && modalProxyUrl ? modalProxyUrl : undefined,
      );
      if (result.ok) {
        antMessage.success('Connection verified successfully!');
        if (result.models.length > 0) {
          const fetched = result.models.map((m) => ({
            id: m.id,
            name: m.name,
            enabled: true,
          }));
          const existingCustoms = modalModels.filter((m) => m.isCustom);
          setModalModels([...fetched, ...existingCustoms]);
        }
        // No fallback seeding: the empty state ("No models available. Click
        // 'Update list' or 'Check' to load models, or click '+' to add.")
        // guides the user to fetch from their provider or add models manually.
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

  const handleUpdateList = async () => {
    if (!activeModalProviderId) return;
    const providerId = activeModalProviderId;
    const currentDetail = config.providers?.[providerId];
    const keyToFetch = modalApiKey.trim().length > 0
      ? modalApiKey
      : (currentDetail?.apiKey || undefined);
    const proxyToFetch = modalUseCustomProxy && modalProxyUrl.trim().length > 0
      ? modalProxyUrl.trim()
      : undefined;

    let fetched: CustomModelItem[] = [];
    try {
      fetched = await fetchProviderModels(providerId, keyToFetch, proxyToFetch);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      antMessage.error(`Failed to fetch model list: ${message}`);
      return;
    }

    const existingCustoms = modalModels.filter((m) => m.isCustom);
    const newStandards = fetched.map((m) => {
      const existing = modalModels.find((x) => x.id === m.id);
      return existing ? { ...existing, name: m.name } : { ...m, enabled: true };
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

  // D-52 (03-07): live model discovery for the tier selectors — merged across
  // ENABLED providers via ProviderRegistry.refreshModels (D-50-merged endpoint;
  // WR-04/CR-02: the fetched lists WRITE the registry's D-52 session cache that
  // TierResolver validates against — discovery is never thrown away). Discovery
  // POPULATES the selectors but does NOT classify, preselect, or persist either
  // value (D-54/D-54a).
  //
  // D-11 first-setup auto-population (additive): for each ENABLED provider
  // whose disk-side models list is empty (the operator never did Check
  // Connection), merge the live-discovered IDs into
  // `config.providers[diskId].models` so the Translate dropdown and the
  // provider modal surface real fetched models on first Options open —
  // without forcing the operator to manually open the modal and click
  // "Check Connection" before the rest of the page is usable. Existing
  // non-empty lists are NEVER overwritten — the operator's prior
  // configuration stays authoritative. Overlap with existing entries
  // preserves their `enabled` and `isCustom` flags.
  const handleDiscoverTierModels = async () => {
    if (tierModelsLoading) return;
    setTierModelsLoading(true);
    const merged: { value: string; label: string }[] = [];
    const providersToMerge: { diskId: CustomProviderId; ids: string[] }[] = [];
    try {
      for (const provider of ProviderRegistry.getEnabled()) {
        const diskId = provider.providerId === 'anthropic' ? 'claude' : provider.providerId;
        if (diskId === 'openai-compat') continue; // operator-assigned list only (D-56)
        const apiKey = config.providers?.[diskId as CustomProviderId]?.apiKey;
        const ids = await ProviderRegistry.refreshModels(provider.providerId, apiKey);
        // Auto-merge only when the operator has not yet populated the
        // disk-side list. A missing key / unreachable endpoint yields `ids`
        // empty (cache miss), so no merge happens — operator sees empty and
        // can fix the key/endpoint.
        const existing = config.providers?.[diskId as CustomProviderId]?.models;
        if (ids.length > 0 && existing && existing.length === 0) {
          providersToMerge.push({ diskId: diskId as CustomProviderId, ids });
        }
        // The tier selector offers ONLY the operator's ENABLED models (the
        // same enable filter the chat model selector uses). On first setup —
        // nothing enabled yet (disk list empty) — fall back to the discovered
        // list so the D-11 pre-fill suggestion still renders; once the
        // operator enables specific models in the provider modal, discovery
        // still refreshes the D-52 cache (WR-04/CR-02) but the selector
        // respects the enable filter. When discovery fails, the enabled set
        // stays visible (the operator's intent outranks a failed refresh).
        const enabledIds = (existing ?? []).filter((m) => m.enabled).map((m) => m.id);
        const eligible =
          enabledIds.length > 0 ? (ids.length > 0 ? ids.filter((id) => enabledIds.includes(id)) : enabledIds) : ids;
        for (const id of eligible) {
          if (!merged.some((x) => x.value === id)) merged.push({ value: id, label: id });
        }
      }
      // Single updateConfig call → one persist + one BroadcastChannel write.
      // The persist partialize still strips apiKey (D-28); the merge is a
      // pure models-list update.
      if (providersToMerge.length > 0) {
        const updatedProviders = { ...config.providers };
        for (const { diskId, ids } of providersToMerge) {
          const detail = updatedProviders[diskId];
          if (!detail) continue;
          updatedProviders[diskId] = {
            ...detail,
            models: ids.map((id) => ({ id, name: id, enabled: true })),
          };
        }
        updateConfig({ providers: updatedProviders });
      }
      setTierModels(merged);
      if (merged.length > 0) {
        antMessage.success(`Discovered ${merged.length} model(s) for tier assignment`);
      } else {
        antMessage.info('No enabled providers with discoverable models — configure and enable a provider first');
      }
    } catch (err) {
      debugLog('TIER_MODEL_DISCOVERY_FAILED', err instanceof Error ? err.message : String(err));
      antMessage.error('Model discovery failed — check provider connectivity');
    } finally {
      setTierModelsLoading(false);
    }
  };

  // D-54 (03-07): write-through to np_preferences. THE ONLY call site of the
  // store actions in this file (grep gate — the discovery/pre-fill path
  // contains no setFastModel/setBalancedModel call; D-54a).
  const handleSaveTierAssignment = () => {
    if (fastTierModel) useUserPreferencesStore.getState().setFastModel(fastTierModel);
    if (balancedTierModel) useUserPreferencesStore.getState().setBalancedModel(balancedTierModel);
    antMessage.success('Tier assignment saved — applies to the next chat turn');
  };

  // D-54 first-setup pre-fill: on first Options open, populate the tier
  // selectors with live-discovered models. UI-ONLY — nothing is selected or
  // persisted here (D-54a); a suggestion appears under the selectors until the
  // operator confirms an explicit choice.
  useEffect(() => {
    void handleDiscoverTierModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first-setup intent
  }, []);

  // Selector options = discovered models + any already-persisted assignment
  // (so a saved value always renders even before a re-discovery).
  const tierOptions = useMemo(() => {
    const opts = [...tierModels];
    const add = (v?: string) => {
      if (v && !opts.some((o) => o.value === v)) opts.push({ value: v, label: v });
    };
    add(prefs.fastModel);
    add(prefs.balancedModel);
    return opts;
  }, [tierModels, prefs.fastModel, prefs.balancedModel]);

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
        background: '#f8fafc',
        borderRadius: 24,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#e2e8f0',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        userSelect: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <div>
          {/* Brand Logo & Name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 8,
            paddingRight: 8,
            marginBottom: 28,
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
              color: '#0f172a',
            }}>NowPilot</span>
          </div>

          {/* Navigation Items List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            {[
              { key: 'General', label: 'General', icon: <ControlOutlined /> },
              { key: 'Translate', label: 'Translate', icon: <TranslationOutlined /> },
              { key: 'Prompts', label: 'Prompts', icon: <EditOutlined /> },
            ].map(item => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key as any)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    background: isActive ? '#f3e8ff' : 'transparent',
                    color: isActive ? '#7c3aed' : '#4b5563',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{
                    fontSize: 18,
                    color: isActive ? '#7c3aed' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div style={{
              marginTop: 12,
              marginBottom: 12,
              borderTopWidth: 1,
              borderTopStyle: 'solid',
              borderTopColor: '#e2e8f0',
            }} />

            {/* Help Center */}
            <a
              href="#"
              onClick={e => { e.preventDefault(); antMessage.info('Help Center opened'); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 500,
                color: '#2563eb',
                textDecoration: 'none',
                transition: 'all 150ms ease',
                cursor: 'pointer',
                border: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{
                  fontSize: 18,
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                }}>
                  <QuestionCircleOutlined />
                </span>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>Help Center</span>
              </span>
              <span style={{
                color: '#9ca3af',
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

            {/* AI tier assignment (D-54, 03-07) — additive to the General
                section; the full Options redesign is Phase 15. */}
            <div>
              <Title level={3} style={{ marginBottom: 16, fontWeight: 700, color: 'var(--foreground)' }}>AI tier assignment</Title>
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
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.625 }}>
                  Assign the models used for the fast and balanced capability tiers (Appendix D).
                  Until both are assigned, chat surfaces a configuration prompt instead of calling a
                  provider (D-54a).
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>Tier models</span>
                  <Button
                    size="small"
                    onClick={handleDiscoverTierModels}
                    loading={tierModelsLoading}
                    icon={<ReloadOutlined />}
                    style={{ borderRadius: 8 }}
                  >
                    Discover models
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', width: 80, flexShrink: 0 }}>Fast tier</span>
                    <Select
                      style={{ flex: 1 }}
                      placeholder="Assign a fast-tier model"
                      value={fastTierModel}
                      onChange={setFastTierModel}
                      options={tierOptions}
                      allowClear
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', width: 80, flexShrink: 0 }}>Balanced tier</span>
                    <Select
                      style={{ flex: 1 }}
                      placeholder="Assign a balanced-tier model"
                      value={balancedTierModel}
                      onChange={setBalancedTierModel}
                      options={tierOptions}
                      allowClear
                    />
                  </div>
                </div>

                {/* D-54 first-setup pre-fill suggestion — UI-ONLY text; the
                    operator must explicitly select a value and confirm Save
                    before it persists (D-54a). This path contains NO
                    setFastModel/setBalancedModel call (grep gate). */}
                {(!fastTierModel || !balancedTierModel) && tierModels.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.625 }}>
                    Suggestion:{' '}
                    <code style={{ color: 'var(--foreground)' }}>{tierModels[0].value}</code>{' '}
                    — select a value above and confirm Save to assign it. Suggestions are never saved
                    automatically.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="primary"
                    onClick={handleSaveTierAssignment}
                    style={{ backgroundColor: '#7c3aed', borderRadius: 8 }}
                  >
                    Save tier assignment
                  </Button>
                </div>
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
                  value={config.translateService || undefined}
                  placeholder="Select a configured model"
                  allowClear
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
        okText="Save Provider"
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
              placeholder={(() => {
                // UI-SPEC E1 partial: a provider with a stored (encrypted) key
                // renders the masked placeholder •••••••••••••••• — the
                // decrypted value is NEVER placed into the field's value,
                // placeholder, aria-label, or hint. D-28 / §8.7 / mockup line 366.
                const currentDetail = activeModalProviderId
                  ? config.providers?.[activeModalProviderId]
                  : null;
                const hasSavedKey = !!currentDetail && typeof currentDetail.apiKey === 'string' && currentDetail.apiKey.length > 0;
                return hasSavedKey ? '••••••••••••••••' : 'Enter your API key';
              })()}
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
                placeholder={activeModalProviderId ? PROVIDER_INFO[activeModalProviderId].defaultProxy : ''}
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
Check Connection
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
                gap: 8,
              }}>
                {listUpdated ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<CheckOutlined style={{ color: '#10b981' }} />}
                    onClick={handleUpdateList}
                    style={{
                      color: '#10b981',
                      fontWeight: 500,
                      padding: '0 4px',
                      height: 'auto',
                    }}
                  >
                    Updated
                  </Button>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={handleUpdateList}
                    style={{
                      color: '#7c3aed',
                      padding: '0 4px',
                      height: 'auto',
                    }}
                  >
                    Update list
                  </Button>
                )}
                <Tooltip title="Add custom model">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setAddCustomModelOpen(true);
                      setNewModelNameInput('');
                    }}
                    style={{
                      color: 'var(--muted-foreground)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Add Custom Model Inline Box matching screenshot */}
            {addCustomModelOpen && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                marginBottom: 10,
                borderRadius: 12,
                border: '2px solid #7c3aed',
                background: 'var(--card)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                gap: 8,
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
                    border: 'none',
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
                  gap: 4,
                  flexShrink: 0,
                }}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={handleAddCustomModel}
                    style={{
                      background: '#7c3aed',
                      borderColor: '#7c3aed',
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => { setAddCustomModelOpen(false); setNewModelNameInput(''); }}
                    style={{
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Model List Rendering */}
            {modalModels.length === 0 && !addCustomModelOpen ? (
              <div style={{
                textAlign: 'center',
                padding: '24px 12px',
                fontSize: 12,
                color: 'var(--muted-foreground)',
                background: 'var(--muted)',
                borderRadius: 12,
                border: '1px dashed var(--border)',
              }}>
                No models available. Click 'Update list' or 'Check' to load models, or click '+' to add.
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
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
                          padding: '6px 12px',
                          borderRadius: 12,
                          border: '2px solid #7c3aed',
                          background: 'var(--card)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          gap: 8,
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
                            border: 'none',
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
                          gap: 4,
                          flexShrink: 0,
                        }}>
                          <Button
                            type="primary"
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={handleSaveEditingCustomModel}
                            style={{
                              background: '#7c3aed',
                              borderColor: '#7c3aed',
                              width: 24,
                              height: 24,
                              minWidth: 24,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={() => { setEditingCustomModelId(null); setEditingModelNameInput(''); }}
                            style={{
                              width: 24,
                              height: 24,
                              minWidth: 24,
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          />
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
                        padding: '8px 12px',
                        borderRadius: 12,
                        background: 'var(--muted)',
                        fontSize: 12,
                        border: '1px solid var(--border)',
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
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined style={{ fontSize: 11 }} />}
                              onClick={() => {
                                setEditingCustomModelId(m.id);
                                setNewModelNameInput(m.name);
                              }}
                              style={{
                                width: 20,
                                height: 20,
                                minWidth: 20,
                                padding: 0,
                                color: 'var(--muted-foreground)',
                              }}
                            />
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                              onClick={() => handleDeleteCustomModel(m.id)}
                              style={{
                                width: 20,
                                height: 20,
                                minWidth: 20,
                                padding: 0,
                              }}
                            />
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
