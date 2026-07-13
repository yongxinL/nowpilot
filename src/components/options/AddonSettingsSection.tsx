import React, { useEffect, useState } from 'react';
import { Form, Typography, Button, Empty, App } from 'antd';

const { Title } = Typography;
const STORAGE_KEY = 'np_addon_settings';

export function AddonSettingsSection() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Future Phase 8: load add-on settings from registry
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: {} });
      message.success('Add-on settings saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-options-section="addons" style={{ maxWidth: 720 }}>
      <Title level={4}>Add-on Settings</Title>
      <p style={{ marginBottom: 16 }}>
        Configure settings for installed add-ons. Add-ons are registered by the Add-on Registry
        and their namespaced settings appear here.
      </p>

      <Empty
        description="No add-ons installed. Add-ons will appear here when registered."
        style={{ padding: 48 }}
      />

      <Form layout="horizontal" labelAlign="left" onFinish={handleSave}>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
