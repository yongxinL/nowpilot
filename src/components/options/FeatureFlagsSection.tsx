import React, { useEffect, useState } from 'react';
import { Form, Typography, Button, Switch, App } from 'antd';

const { Title } = Typography;
const STORAGE_KEY = 'np_feature_flags';

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

const AVAILABLE_FLAGS: FeatureFlag[] = [
  { key: 'enableExperimentalGraph', label: 'Experimental Graph', description: 'Enable experimental note graph visualization (d3-force)', defaultValue: false },
  { key: 'enableMarkdownExport', label: 'Markdown Export', description: 'Enable Markdown export option for notes and chat', defaultValue: false },
  { key: 'enableDebugTools', label: 'Debug Tools', description: 'Show debug and development tools in the UI', defaultValue: false },
  { key: 'enableAdvancedSearch', label: 'Advanced Search', description: 'Enable advanced search features with filtering', defaultValue: false },
];

export function FeatureFlagsSection() {
  const { message } = App.useApp();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = (result[STORAGE_KEY] ?? {}) as Record<string, boolean>;
      const defaults: Record<string, boolean> = {};
      for (const flag of AVAILABLE_FLAGS) {
        defaults[flag.key] = stored[flag.key] ?? flag.defaultValue;
      }
      setFlags(defaults);
    } catch {
      const defaults: Record<string, boolean> = {};
      for (const flag of AVAILABLE_FLAGS) {
        defaults[flag.key] = flag.defaultValue;
      }
      setFlags(defaults);
    }
  };

  const handleToggle = (key: string, value: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: flags });
      message.success('Feature flags saved');
    } catch {
      message.error('Failed to save feature flags');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-options-section="feature-flags" style={{ maxWidth: 720 }}>
      <Title level={4}>Feature Flags</Title>
      <p style={{ marginBottom: 16 }}>
        Toggle experimental and upcoming features. Changes take effect immediately.
      </p>

      <Form layout="horizontal" labelAlign="left" onFinish={handleSave}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {AVAILABLE_FLAGS.map((flag) => (
            <div
              key={flag.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                border: '1px solid #f0f0f0',
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{flag.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{flag.description}</div>
              </div>
              <Switch
                checked={flags[flag.key] ?? flag.defaultValue}
                onChange={(checked) => handleToggle(flag.key, checked)}
              />
            </div>
          ))}
        </div>

        <Form.Item style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
