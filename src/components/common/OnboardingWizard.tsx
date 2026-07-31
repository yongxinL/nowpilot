import React, { useState, useEffect } from 'react';
import { Modal, Typography, Button, Switch, Input, theme, Tooltip, App } from 'antd';
import {
  CheckOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ToolOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  FolderOutlined,
  CommentOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { useExtensionStore } from '../../store/useExtensionStore';
import { CustomProviderId, CustomModelItem } from '../../types';
import { fetchProviderModels } from '../../services/aiProvider';
import { createOpenAIAdapter } from '../../core/ai/providers/openai';
import { createAnthropicAdapter } from '../../core/ai/providers/anthropic';
import { createGeminiAdapter } from '../../core/ai/providers/gemini';
import { createOllamaAdapter } from '../../core/ai/providers/ollama';
import type { ProviderAdapter } from '../../core/ai/providers/ProviderAdapter';

const { Title, Text } = Typography;

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

const PROVIDERS: {
  id: CustomProviderId;
  name: string;
  defaultProxy: string;
}[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultProxy: 'https://api.openai.com/v1',
  },
  {
    id: 'claude',
    name: 'Anthropic',
    defaultProxy: 'https://api.anthropic.com',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultProxy: 'https://generativelanguage.googleapis.com',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    defaultProxy: 'http://localhost:11434',
  },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ open, onComplete }) => {
  const { token } = theme.useToken();
  const { message: antMessage } = App.useApp();
  const { config, updateConfig } = useExtensionStore();

  const [step, setStep] = useState<number>(1);
  const [selectedProvider, setSelectedProvider] = useState<CustomProviderId>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [enableCustomEndpoint, setEnableCustomEndpoint] = useState<boolean>(false);
  const [customEndpoint, setCustomEndpoint] = useState<string>('https://api.openai.com/v1');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionTested, setConnectionTested] = useState<boolean>(false);

  const [modelsList, setModelsList] = useState<CustomModelItem[]>([]);
  const [refreshingModels, setRefreshingModels] = useState<boolean>(false);

  // MCP tools states (Step 6)
  const [mcpTools, setMcpTools] = useState({
    filesystem: true,
    diagnostics: true,
    messageBus: true,
  });

  // ServiceNow permissions states (Step 7)
  const [snPermissions, setSnPermissions] = useState({
    support: true,
    codesearch: true,
    hcpdemo: true,
  });

  // Initialize values when provider changes
  const handleSelectProvider = (provId: CustomProviderId) => {
    setSelectedProvider(provId);
    const provInfo = PROVIDERS.find((p) => p.id === provId)!;
    setCustomEndpoint(provInfo.defaultProxy);
    setConnectionTested(false);
    setModelsList([]);
  };

  useEffect(() => {
    handleSelectProvider('openai');
  }, []);

  // Step 4 auto-advance timer requirement
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 4) {
      timer = setTimeout(() => {
        setStep(5);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [step]);

  const currentProviderInfo = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      let adapter: ProviderAdapter;
      const proxy = enableCustomEndpoint && customEndpoint ? customEndpoint : undefined;
      switch (selectedProvider) {
        case 'openai':
          adapter = createOpenAIAdapter(apiKey, proxy);
          break;
        case 'claude':
          adapter = createAnthropicAdapter(apiKey);
          break;
        case 'gemini':
          adapter = createGeminiAdapter(apiKey);
          break;
        case 'ollama':
          adapter = createOllamaAdapter(proxy);
          break;
      }
      const result = await adapter!.validateConnection();
      if (result.ok) {
        const models = result.models.length > 0
          ? result.models.map((m, idx) => ({ id: m, name: m, enabled: idx < 2 }))
          : await fetchProviderModels(selectedProvider, apiKey, proxy);
        setModelsList(models);
        setConnectionTested(true);
      } else {
        antMessage.error('Connection failed. Check your API key and endpoint.');
        setConnectionTested(false);
      }
    } catch {
      antMessage.error('Connection failed. Check your API key and endpoint.');
      setConnectionTested(false);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveProviderConfig = () => {
    if (!config.providers) return;
    const firstEnabledModel = modelsList.find((m) => m.enabled)?.id || config.selectedModel;
    updateConfig({
      serviceProvider: 'Custom API Key',
      activeProvider: selectedProvider,
      providers: {
        ...config.providers,
        [selectedProvider]: {
          ...config.providers[selectedProvider],
          id: selectedProvider,
          name: currentProviderInfo.name,
          isConfigured: true,
          enabled: true,
          apiKey,
          useCustomProxy: enableCustomEndpoint,
          proxyUrl: customEndpoint,
          models: modelsList,
        },
      },
      selectedModel: firstEnabledModel,
    });
  };

  const handleRefreshModels = async () => {
    setRefreshingModels(true);
    const proxy = enableCustomEndpoint ? customEndpoint : undefined;
    const models = await fetchProviderModels(selectedProvider, apiKey, proxy);
    setModelsList(models);
    setRefreshingModels(false);
  };


  const getContextWindowText = (modelName: string) => {
    const lower = modelName.toLowerCase();
    if (lower.includes('claude') || lower.includes('200')) {
      return 'Context Window: 200,000 tokens';
    }
    if (lower.includes('gemma') || lower.includes('128')) {
      return 'Context Window: 128,000 tokens';
    }
    if (lower.includes('gemini-1.5') || lower.includes('1m') || lower.includes('pro')) {
      return 'Context Window: 1,000,000 tokens';
    }
    return 'Context Window: 128,000 tokens';
  };

  const handleToggleSelectAllModels = (checked: boolean) => {
    setModelsList((prev) => prev.map((m) => ({ ...m, enabled: checked })));
  };

  const allModelsSelected = modelsList.length > 0 && modelsList.every((m) => m.enabled);
  const enabledModelsCount = modelsList.filter((m) => m.enabled).length;

  return (
    <Modal
      open={open}
      closable={false}
      footer={null}
      width="100%"
      style={{ maxWidth: 380, top: 12, margin: '0 auto', padding: '0 8px' }}
      centered
      destroyOnHidden
      styles={{
        body: {
          padding: '20px 16px 18px 16px',
          borderRadius: 16,
          backgroundColor: token.colorBgContainer,
        },
      }}
    >
      {/* Step Numbers Header (1 2 3 4 5 6 7 8) */}
      <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((sNum) => {
          const isCompleted = sNum < step;
          const isActive = sNum === step;

          if (isCompleted) {
            return (
              <div
                key={sNum}
                className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-all shrink-0"
                style={{ backgroundColor: token.colorPrimary }}
              >
                <CheckOutlined style={{ fontSize: 9, strokeWidth: 3 }} />
              </div>
            );
          }

          if (isActive) {
            return (
              <div
                key={sNum}
                className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm transition-all shrink-0"
                style={{
                  backgroundColor: '#1E293B',
                  border: `2px solid ${token.colorPrimary}`,
                }}
              >
                {sNum}
              </div>
            );
          }

          return (
            <div
              key={sNum}
              className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 transition-all shrink-0"
            >
              {sNum}
            </div>
          );
        })}
      </div>

      {/* Main Content Area with Animated Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.18 }}
        >
          {/* STEP 1: WELCOME TO NOWPILOT */}
          {step === 1 && (
            <div className="flex flex-col items-center text-center">
              {/* Logo / Brand Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                style={{
                  backgroundColor: token.colorPrimary,
                  color: '#FFFFFF',
                }}
              >
                <ThunderboltOutlined style={{ fontSize: 26 }} />
              </div>

              <Title level={4} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Welcome to NowPilot
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 12.5, lineHeight: 1.45 }}
                className="block mt-1.5 mb-5 max-w-xs"
              >
                Your unified ServiceNow sidekick. Stream AI replies, search the codebase, analyze cases — all from the side panel.
              </Text>

              {/* Feature Cards */}
              <div className="w-full space-y-2 mb-6">
                <div
                  className="flex items-center gap-2.5 p-3 rounded-xl text-left"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 shrink-0"
                    style={{ backgroundColor: token.colorBgContainer }}
                  >
                    <ThunderboltOutlined style={{ fontSize: 15 }} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: token.colorText }}>
                    MCP tools & skills
                  </span>
                </div>

                <div
                  className="flex items-center gap-2.5 p-3 rounded-xl text-left"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 shrink-0"
                    style={{ backgroundColor: token.colorBgContainer }}
                  >
                    <ToolOutlined style={{ fontSize: 15 }} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: token.colorText }}>
                    In-page ServiceNow tools
                  </span>
                </div>
              </div>

              {/* Primary & Skip Buttons */}
              <Button
                type="primary"
                size="large"
                block
                onClick={() => setStep(2)}
                style={{
                  height: 44,
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 15,
                  backgroundColor: token.colorPrimary,
                }}
              >
                Get started <ArrowRightOutlined style={{ fontSize: 13 }} />
              </Button>

              <Button
                type="text"
                onClick={onComplete}
                className="mt-3 text-xs"
                style={{ color: token.colorTextDescription }}
              >
                Skip for now
              </Button>
            </div>
          )}

          {/* STEP 2: CHOOSE YOUR AI PROVIDER */}
          {step === 2 && (
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Choose your AI provider
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13, lineHeight: 1.4 }}
                className="block mt-1 mb-5"
              >
                Pick the model family you want NowPilot to use. You can add more later in Settings.
              </Text>

              {/* Provider List */}
              <div className="space-y-2.5 mb-7">
                {PROVIDERS.map((prov) => {
                  const isSelected = selectedProvider === prov.id;
                  return (
                    <div
                      key={prov.id}
                      onClick={() => handleSelectProvider(prov.id)}
                      className="p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-center"
                      style={{
                        backgroundColor: isSelected ? token.colorBgContainer : token.colorBgLayout,
                        border: isSelected
                          ? `2px solid ${token.colorPrimary}`
                          : `1px solid ${token.colorBorderSecondary}`,
                        boxShadow: isSelected ? `0 2px 8px ${token.colorPrimaryBg}` : 'none',
                      }}
                    >
                      <div className="text-sm font-bold" style={{ color: token.colorTextHeading }}>
                        {prov.name}
                      </div>
                      <div
                        className="text-xs font-mono mt-0.5 truncate"
                        style={{ color: token.colorTextQuaternary }}
                      >
                        {prov.defaultProxy}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Actions: Back, Skip -> Jump to Step 6, Continue */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Button
                    type="text"
                    onClick={() => setStep(1)}
                    style={{ color: token.colorTextDescription, fontWeight: 500 }}
                  >
                    Back
                  </Button>
                  <Button
                    type="text"
                    onClick={() => setStep(6)}
                    style={{ color: token.colorTextDescription, fontWeight: 500 }}
                  >
                    Skip
                  </Button>
                </div>

                <Button
                  type="primary"
                  onClick={() => setStep(3)}
                  style={{
                    height: 38,
                    borderRadius: 10,
                    fontWeight: 600,
                    paddingLeft: 20,
                    paddingRight: 20,
                    backgroundColor: token.colorPrimary,
                  }}
                >
                  Continue <ArrowRightOutlined style={{ fontSize: 11 }} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PASTE YOUR API KEY */}
          {step === 3 && (
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Paste your {currentProviderInfo.name} API key
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13, lineHeight: 1.4 }}
                className="block mt-1 mb-5"
              >
                Stored locally with encryption. You can rotate it any time in Settings.
              </Text>

              {/* API Key Input */}
              <div className="mb-4">
                <label
                  className="block text-[11px] font-bold tracking-wider uppercase mb-1.5"
                  style={{ color: token.colorTextDescription }}
                >
                  {currentProviderInfo.name.toUpperCase()} API KEY
                </label>
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setConnectionTested(false);
                  }}
                  placeholder="••••••••••••••••••••••••"
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    </button>
                  }
                  style={{
                    height: 42,
                    borderRadius: 10,
                    backgroundColor: token.colorBgLayout,
                    borderColor: token.colorBorderSecondary,
                  }}
                />
              </div>

              {/* Custom Endpoint Switch */}
              <div
                className="flex items-center justify-between p-3.5 rounded-xl mb-4"
                style={{
                  backgroundColor: token.colorBgContainer,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <span className="text-sm font-bold" style={{ color: token.colorTextHeading }}>
                  Enable Custom Endpoint
                </span>
                <Switch
                  checked={enableCustomEndpoint}
                  onChange={(checked) => {
                    setEnableCustomEndpoint(checked);
                    setConnectionTested(false);
                  }}
                />
              </div>

              {/* Custom Endpoint Proxy Input (ONLY SHOWN WHEN SWITCH IS ON) */}
              {enableCustomEndpoint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 overflow-hidden"
                >
                  <label
                    className="block text-[11px] font-bold tracking-wider uppercase mb-1.5"
                    style={{ color: token.colorTextDescription }}
                  >
                    CUSTOM ENDPOINT PROXY
                  </label>
                  <Input
                    value={customEndpoint}
                    onChange={(e) => {
                      setCustomEndpoint(e.target.value);
                      setConnectionTested(false);
                    }}
                    placeholder={currentProviderInfo.defaultProxy}
                    style={{
                      height: 42,
                      borderRadius: 10,
                      backgroundColor: token.colorBgLayout,
                      borderColor: token.colorBorderSecondary,
                    }}
                  />
                </motion.div>
              )}

              {/* Footer Row: Test Connection, Back, Continue (disabled if connection not tested) */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-5">
                <Button
                  onClick={handleTestConnection}
                  loading={testingConnection}
                  icon={<SyncOutlined spin={testingConnection} />}
                  style={{
                    borderRadius: 10,
                    height: 38,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Test connection
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="text"
                    onClick={() => setStep(2)}
                    style={{ color: token.colorTextDescription, fontWeight: 500 }}
                  >
                    Back
                  </Button>

                  <Tooltip
                    title={
                      !connectionTested
                        ? 'Please click "Test connection" first to verify your setup'
                        : ''
                    }
                  >
                    <span>
                      <Button
                        type="primary"
                        disabled={!connectionTested}
                        onClick={() => setStep(4)}
                        style={{
                          height: 38,
                          borderRadius: 10,
                          fontWeight: 600,
                          paddingLeft: 20,
                          paddingRight: 20,
                          backgroundColor: connectionTested ? token.colorPrimary : undefined,
                        }}
                      >
                        Continue <ArrowRightOutlined style={{ fontSize: 11 }} />
                      </Button>
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CONNECTED TO PROVIDER */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center py-6">
              {/* Green Checkmark Circle */}
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 mb-5">
                <CheckOutlined style={{ fontSize: 32, strokeWidth: 3 }} />
              </div>

              <Title level={3} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Connected to {currentProviderInfo.name}
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13 }}
                className="block mt-2 mb-6"
              >
                Your API key is verified. Advancing in a moment...
              </Text>

              {/* Instant Skip Click */}
              <Button
                type="link"
                onClick={() => setStep(5)}
                style={{ color: token.colorPrimary, fontSize: 12 }}
              >
                Click here to advance immediately →
              </Button>
            </div>
          )}

          {/* STEP 5: SELECT MODELS */}
          {step === 5 && (
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Select Models
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13, lineHeight: 1.4 }}
                className="block mt-1 mb-4"
              >
                Choose which models to enable.
              </Text>

              {/* Header bar: Available Model Namespaces, Refresh Icon, Select/Deselect all text */}
              <div className="flex items-center justify-between mb-3 px-0.5">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  AVAILABLE MODEL NAMESPACES
                </span>
                <div className="flex items-center gap-3">
                  <Tooltip title="Refresh available models">
                    <button
                      type="button"
                      onClick={handleRefreshModels}
                      className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer flex items-center justify-center transition-colors"
                    >
                      <SyncOutlined spin={refreshingModels} style={{ fontSize: 13 }} />
                    </button>
                  </Tooltip>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAllModels(!allModelsSelected)}
                    className="text-xs font-semibold cursor-pointer transition-colors"
                    style={{ color: '#4F46E5' }}
                  >
                    {allModelsSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
              </div>

              {/* Models List */}
              <div className="space-y-2.5 mb-7 max-h-60 overflow-y-auto pr-1">
                {/* Individual Model Cards */}
                {modelsList.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3.5 rounded-xl transition-all"
                    style={{
                      backgroundColor: token.colorBgLayout,
                      border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <div className="pr-2 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: token.colorTextHeading }}>
                        {m.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: token.colorTextDescription }}>
                        {getContextWindowText(m.name)}
                      </div>
                    </div>
                    <Switch
                      checked={m.enabled}
                      onChange={(checked) => {
                        setModelsList((prev) =>
                          prev.map((item) => (item.id === m.id ? { ...item, enabled: checked } : item))
                        );
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="text"
                  onClick={() => setStep(3)}
                  style={{ color: token.colorTextDescription, fontWeight: 500 }}
                >
                  Back
                </Button>

                <Button
                  type="primary"
                  onClick={() => {
                    handleSaveProviderConfig();
                    setStep(6);
                  }}
                  style={{
                    height: 38,
                    borderRadius: 10,
                    fontWeight: 600,
                    paddingLeft: 20,
                    paddingRight: 20,
                    backgroundColor: token.colorPrimary,
                  }}
                >
                  Continue ({enabledModelsCount}) <ArrowRightOutlined style={{ fontSize: 11 }} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: CONFIGURE MCP TOOLS & SKILLS */}
          {step === 6 && (
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Configure MCP Tools & Skills
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13, lineHeight: 1.4 }}
                className="block mt-1 mb-5"
              >
                Enable pre-configured MCP servers to interact with external tools and codebase.
              </Text>

              <div className="space-y-2.5 mb-7">
                {/* Tool 1 */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div className="flex items-start gap-3 pr-2">
                    <FolderOutlined className="text-amber-500 mt-1 text-base" />
                    <div>
                      <div className="text-sm font-bold" style={{ color: token.colorTextHeading }}>
                        Workspace Filesystem
                      </div>
                      <div className="text-xs" style={{ color: token.colorTextDescription }}>
                        Read and edit workspace codebase files safely
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={mcpTools.filesystem}
                    onChange={(checked) => setMcpTools((p) => ({ ...p, filesystem: checked }))}
                  />
                </div>

                {/* Tool 2 */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div className="flex items-start gap-3 pr-2">
                    <ToolOutlined className="text-amber-500 mt-1 text-base" />
                    <div>
                      <div className="text-sm font-bold" style={{ color: token.colorTextHeading }}>
                        Diagnostics Engine
                      </div>
                      <div className="text-xs" style={{ color: token.colorTextDescription }}>
                        Analyze and record AI transaction traces
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={mcpTools.diagnostics}
                    onChange={(checked) => setMcpTools((p) => ({ ...p, diagnostics: checked }))}
                  />
                </div>

                {/* Tool 3 */}
                <div
                  className="flex items-center justify-between p-3.5 rounded-xl"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div className="flex items-start gap-3 pr-2">
                    <CommentOutlined className="text-amber-500 mt-1 text-base" />
                    <div>
                      <div className="text-sm font-bold" style={{ color: token.colorTextHeading }}>
                        Broadcast Message Bus
                      </div>
                      <div className="text-xs" style={{ color: token.colorTextDescription }}>
                        Communicate between side panel and page contexts
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={mcpTools.messageBus}
                    onChange={(checked) => setMcpTools((p) => ({ ...p, messageBus: checked }))}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="text"
                  onClick={() => setStep(2)}
                  style={{ color: token.colorTextDescription, fontWeight: 500 }}
                >
                  Back
                </Button>

                <Button
                  type="primary"
                  onClick={() => setStep(7)}
                  style={{
                    height: 38,
                    borderRadius: 10,
                    fontWeight: 600,
                    paddingLeft: 20,
                    paddingRight: 20,
                    backgroundColor: token.colorPrimary,
                  }}
                >
                  Continue <ArrowRightOutlined style={{ fontSize: 11 }} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 7: GRANT SERVICENOW PERMISSIONS */}
          {step === 7 && (
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                Grant ServiceNow permissions
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13, lineHeight: 1.4 }}
                className="block mt-1 mb-4"
              >
                NowPilot needs access to these ServiceNow hosts to inject case insights and search the codebase.
              </Text>

              <div className="space-y-2.5 mb-4">
                {/* Perm 1 */}
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div className="flex items-start gap-2.5 pr-2">
                    <SafetyCertificateOutlined className="text-amber-500 mt-1 text-base" />
                    <div>
                      <div className="text-xs font-bold" style={{ color: token.colorTextHeading }}>
                        support.servicenow.com
                      </div>
                      <div className="text-[11px]" style={{ color: token.colorTextDescription }}>
                        Read case data & inject tools
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={snPermissions.support}
                    onChange={(checked) => setSnPermissions((p) => ({ ...p, support: checked }))}
                  />
                </div>

                {/* Perm 2 */}
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div className="flex items-start gap-2.5 pr-2">
                    <SafetyCertificateOutlined className="text-amber-500 mt-1 text-base" />
                    <div>
                      <div className="text-xs font-bold" style={{ color: token.colorTextHeading }}>
                        codesearch.devsnc.com
                      </div>
                      <div className="text-[11px]" style={{ color: token.colorTextDescription }}>
                        Search ServiceNow codebase
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={snPermissions.codesearch}
                    onChange={(checked) => setSnPermissions((p) => ({ ...p, codesearch: checked }))}
                  />
                </div>

                {/* Perm 3 */}
                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    backgroundColor: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div className="flex items-start gap-2.5 pr-2">
                    <SafetyCertificateOutlined className="text-amber-500 mt-1 text-base" />
                    <div>
                      <div className="text-xs font-bold" style={{ color: token.colorTextHeading }}>
                        hcpdemo.service-now.com
                      </div>
                      <div className="text-[11px]" style={{ color: token.colorTextDescription }}>
                        Connect Now Assist demo
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={snPermissions.hcpdemo}
                    onChange={(checked) => setSnPermissions((p) => ({ ...p, hcpdemo: checked }))}
                  />
                </div>
              </div>

              {/* Privacy Box */}
              <div
                className="p-3 rounded-xl mb-6 flex items-start gap-2 text-xs"
                style={{
                  backgroundColor: '#FEFCE8',
                  border: '1px solid #FEF08A',
                  color: '#854D0E',
                }}
              >
                <WarningOutlined className="mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">Privacy: </span>
                  Requests go directly to the host. No data sent to NowPilot servers.
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="text"
                  onClick={() => setStep(6)}
                  style={{ color: token.colorTextDescription, fontWeight: 500 }}
                >
                  Back
                </Button>

                <Button
                  type="primary"
                  onClick={() => setStep(8)}
                  style={{
                    height: 38,
                    borderRadius: 10,
                    fontWeight: 600,
                    paddingLeft: 20,
                    paddingRight: 20,
                    backgroundColor: token.colorPrimary,
                  }}
                >
                  Continue <ArrowRightOutlined style={{ fontSize: 11 }} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 8: YOU'RE ALL SET */}
          {step === 8 && (
            <div className="flex flex-col items-center text-center py-4">
              {/* Green Circle */}
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 mb-5">
                <CheckOutlined style={{ fontSize: 32, strokeWidth: 3 }} />
              </div>

              <Title level={3} style={{ margin: 0, fontWeight: 700, color: token.colorTextHeading }}>
                You're all set
              </Title>
              <Text
                style={{ color: token.colorTextDescription, fontSize: 13, lineHeight: 1.5 }}
                className="block mt-2 mb-7 max-w-xs"
              >
                NowPilot is ready. Open the side panel and try asking{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  "What's the latest EMEA incident?"
                </span>{' '}
                to get started.
              </Text>

              {/* Open Sidepanel Button */}
              <Button
                type="primary"
                size="large"
                block
                onClick={onComplete}
                style={{
                  height: 44,
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 15,
                  backgroundColor: token.colorPrimary,
                }}
              >
                Open side panel <ArrowRightOutlined style={{ fontSize: 13 }} />
              </Button>

              <Button
                type="text"
                onClick={onComplete}
                className="mt-3 text-xs"
                style={{ color: token.colorTextDescription }}
              >
                Re-run setup later
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
};
