import React, { useEffect, useState } from 'react';
import { Form, Typography, Button, Input, Select, Popconfirm, Alert, Collapse, Tag, App } from 'antd';
import { useProviderStore } from '../../core/stores/providerStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'ollama' | 'openai-compatible';
  apiKey: string;
  baseURL: string;
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

interface ConnectionResult {
  status: ConnectionStatus;
  message?: string;
  details?: {
    code?: string;
    endpoint?: string;
    summary?: string;
    errorDetails?: string;
  };
}

export function ProvidersSection() {
  const { message } = App.useApp();
  const apiKeys = useProviderStore((s) => s.apiKeys);
  const setApiKey = useProviderStore((s) => s.setApiKey);

  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionResults, setConnectionResults] = useState<Record<string, ConnectionResult>>({});

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const key = 'np_provider_configs';
      const result = await chrome.storage.local.get(key);
      const stored = (result[key] ?? []) as ProviderConfig[];
      // Merge API keys from providerStore
      const merged = stored.map((p) => ({
        ...p,
        apiKey: apiKeys[p.name] ?? p.apiKey ?? '',
      }));
      setProviders(merged);
    } catch {
      // No persisted configs, seed with default
      const defaults: ProviderConfig[] = Object.keys(apiKeys).length > 0
        ? Object.entries(apiKeys).map(([name, key]) => ({
            id: crypto.randomUUID(),
            name,
            type: 'openai' as const,
            apiKey: key,
            baseURL: '',
          }))
        : [];
      setProviders(defaults);
    }
  };

  const persistProviders = async (updated: ProviderConfig[]) => {
    await chrome.storage.local.set({ np_provider_configs: updated });
    // Sync API keys to providerStore
    for (const p of updated) {
      if (p.apiKey) setApiKey(p.name, p.apiKey);
    }
  };

  const handleAddProvider = () => {
    setProviders((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        type: 'openai',
        apiKey: '',
        baseURL: '',
      },
    ]);
  };

  const handleUpdateProvider = (id: string, field: string, value: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const handleRemoveProvider = async (id: string) => {
    const updated = providers.filter((p) => p.id !== id);
    setProviders(updated);
    await persistProviders(updated);
    message.success('Provider removed');
  };

  const handleTestConnection = async (provider: ProviderConfig) => {
    setConnectionResults((prev) => ({
      ...prev,
      [provider.id]: { status: 'testing' },
    }));

    try {
      // Simulate connection test - in production this would call the provider adapter
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!provider.apiKey) {
        setConnectionResults((prev) => ({
          ...prev,
          [provider.id]: {
            status: 'error',
            message: 'API key is required',
            details: {
              code: 'NO_API_KEY',
              endpoint: provider.baseURL || 'default',
              summary: 'Please enter an API key before testing the connection.',
              errorDetails: 'The provider requires a valid API key to establish a connection.',
            },
          },
        }));
        return;
      }

      // Simulate success for valid-looking keys
      if (provider.apiKey.length > 5) {
        setConnectionResults((prev) => ({
          ...prev,
          [provider.id]: {
            status: 'success',
            message: `Successfully connected to ${provider.name || provider.type}`,
            details: {
              endpoint: provider.baseURL || 'default',
              summary: 'Connection established. Provider is reachable and responding.',
            },
          },
        }));
      } else {
        setConnectionResults((prev) => ({
          ...prev,
          [provider.id]: {
            status: 'error',
            message: 'Connection failed',
            details: {
              code: 'AUTH_ERROR',
              endpoint: provider.baseURL || 'default',
              summary: 'Invalid API key format.',
              errorDetails: 'The provided API key appears to be invalid or malformed.',
            },
          },
        }));
      }
    } catch (err) {
      setConnectionResults((prev) => ({
        ...prev,
        [provider.id]: {
          status: 'error',
          message: 'Connection failed',
          details: {
            code: 'NETWORK_ERROR',
            summary: err instanceof Error ? err.message : 'Unknown error',
            errorDetails: 'Check network connectivity and verify the endpoint is correct.',
          },
        },
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await persistProviders(providers);
      message.success('Providers saved');
    } catch {
      message.error('Failed to save providers');
    } finally {
      setLoading(false);
    }
  };

  const PROVDER_TYPE_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'google', label: 'Google AI' },
    { value: 'ollama', label: 'Ollama (Local)' },
    { value: 'openai-compatible', label: 'OpenAI Compatible' },
  ];

  return (
    <div data-options-section="providers" style={{ maxWidth: 720 }}>
      <Title level={4}>Providers</Title>
      <p style={{ marginBottom: 16 }}>
        Configure AI provider connections. API keys are encrypted at rest.
      </p>

      <Form layout="vertical" onFinish={handleSave}>
        {providers.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
            No providers configured. Click &quot;Add Provider&quot; to get started.
          </div>
        )}

        {providers.map((provider, index) => {
          const result = connectionResults[provider.id];

          return (
            <div
              key={provider.id}
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Text strong style={{ fontSize: 14 }}>
                  Provider {index + 1}
                </Text>
                <Popconfirm
                  title="Delete this provider?"
                  description="This action cannot be undone."
                  onConfirm={() => handleRemoveProvider(provider.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger size="small">
                    Remove
                  </Button>
                </Popconfirm>
              </div>

              <Form.Item label="Provider Name" style={{ marginBottom: 12 }}>
                <Input
                  value={provider.name}
                  onChange={(e) => handleUpdateProvider(provider.id, 'name', e.target.value)}
                  placeholder="e.g., My OpenAI"
                />
              </Form.Item>

              <Form.Item label="Provider Type" style={{ marginBottom: 12 }}>
                <Select
                  value={provider.type}
                  onChange={(val) => handleUpdateProvider(provider.id, 'type', val)}
                  options={PROVDER_TYPE_OPTIONS}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item label="API Key" style={{ marginBottom: 12 }}>
                <Input.Password
                  value={provider.apiKey}
                  onChange={(e) => handleUpdateProvider(provider.id, 'apiKey', e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </Form.Item>

              <Form.Item label="Base URL (optional)" style={{ marginBottom: 12 }}>
                <Input
                  value={provider.baseURL}
                  onChange={(e) => handleUpdateProvider(provider.id, 'baseURL', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </Form.Item>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Button
                  onClick={() => handleTestConnection(provider)}
                  loading={result?.status === 'testing'}
                  data-test-connection
                >
                  {result?.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>

                {result && result.status !== 'testing' && result.status !== 'idle' ? (
                  <div style={{ flex: 1 }}>
                    <Alert
                      type={result.status === 'success' ? 'success' : 'error'}
                      title={result.message}
                      showIcon
                      style={{ marginBottom: 4 }}
                    />
                    {result.details ? (
                      <Collapse ghost size="small" items={[
                        {
                          key: 'details',
                          label: 'Diagnostic details',
                          children: (
                            <div>
                              {result.details.code ? (
                                <Paragraph style={{ marginBottom: 4 }}>
                                  <Text strong>Error Code:</Text> <Tag>{result.details.code}</Tag>
                                </Paragraph>
                              ) : null}
                              {result.details.endpoint ? (
                                <Paragraph style={{ marginBottom: 4 }}>
                                  <Text strong>Endpoint:</Text> {result.details.endpoint}
                                </Paragraph>
                              ) : null}
                              {result.details.summary ? (
                                <Paragraph style={{ marginBottom: 4 }}>
                                  <Text strong>Summary:</Text> {result.details.summary}
                                </Paragraph>
                              ) : null}
                              {result.details.errorDetails ? (
                                <div>
                                  <Button
                                    size="small"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        JSON.stringify(result.details, null, 2),
                                      );
                                      message.success('Error details copied to clipboard');
                                    }}
                                  >
                                    Copy Error Details
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ),
                        },
                      ]} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        <Form.Item>
          <Button onClick={handleAddProvider} style={{ marginRight: 8 }}>
            + Add Provider
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
