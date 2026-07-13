import React, { useState } from 'react';
import { Form, Typography, Button, Radio, App } from 'antd';
import { useThemeStore } from '../../core/stores/themeStore';
import type { ThemeMode } from '../../core/stores/themeStore';

const { Title } = Typography;

export function AppearanceSection() {
  const { message } = App.useApp();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [loading, setLoading] = useState(false);
  const [density, setDensity] = useState<'compact' | 'default'>('default');

  const handleSave = async (values: { mode: ThemeMode; density: 'compact' | 'default' }) => {
    setLoading(true);
    try {
      setMode(values.mode);
      await chrome.storage.local.set({ np_ui_density: values.density });
      message.success('Appearance saved');
    } catch {
      message.error('Failed to save appearance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-options-section="appearance" style={{ maxWidth: 720 }}>
      <Title level={4}>Appearance</Title>
      <p style={{ marginBottom: 16 }}>Customize the look and feel of the application.</p>

      <Form
        layout="horizontal"
        labelAlign="left"
        onFinish={handleSave}
        initialValues={{ mode, density }}
      >
        <Form.Item label="Theme Mode" name="mode">
          <Radio.Group>
            <Radio.Button value="light">Light</Radio.Button>
            <Radio.Button value="dark">Dark</Radio.Button>
            <Radio.Button value="auto">Auto (System)</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="Density" name="density">
          <Radio.Group>
            <Radio.Button value="default">Default</Radio.Button>
            <Radio.Button value="compact">Compact</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
