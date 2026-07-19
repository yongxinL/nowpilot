import React, { useEffect, useCallback, useState } from 'react';
import { Typography, Card, Switch, Empty, App } from 'antd';
import { addonRegistry, type AddonSettingsSchema } from '../../core/registries/AddonRegistry';

const { Title, Paragraph } = Typography;

export function AddonSettingsSection() {
  const { message } = App.useApp();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loadingAddon, setLoadingAddon] = useState<string | null>(null);
  const [addons, setAddons] = useState<AddonSettingsSchema[]>([]);

  useEffect(() => {
    // Load registered addon settings schemas
    const schemas = addonRegistry.listSettingsSchemas();
    setAddons(schemas);

    // Read current enabled state from registry
    const enabledAddons = addonRegistry.listEnabled();
    const enabledState: Record<string, boolean> = {};
    for (const addonId of enabledAddons) {
      enabledState[addonId] = true;
    }
    setEnabled(enabledState);
  }, []);

  const handleToggle = useCallback(async (addonId: string, checked: boolean) => {
    setLoadingAddon(addonId);
    try {
      if (checked) {
        await addonRegistry.enable(addonId);
        message.success(`Enabled ${addonId}`);
      } else {
        await addonRegistry.disable(addonId);
        message.info(`Disabled ${addonId}`);
      }
      setEnabled((prev) => ({ ...prev, [addonId]: checked }));
    } catch {
      message.error('Failed to update add-on settings');
    } finally {
      setLoadingAddon(null);
    }
  }, [message]);

  return (
    <div data-options-section="addons" style={{ maxWidth: 720 }}>
      <Title level={4}>Add-on Settings</Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Configure settings for installed add-ons. Enable or disable individual add-ons.
      </Paragraph>

      {addons.length === 0 ? (
        <Empty
          description="No add-ons installed. Add-ons will appear here when registered."
          style={{ padding: 48 }}
        />
      ) : (
        addons.map((addon) => (
          <Card
            key={addon.addonId}
            title={addon.addonId}
            style={{ marginBottom: 16 }}
            extra={
              <Switch
                checked={enabled[addon.addonId] ?? false}
                onChange={(c) => handleToggle(addon.addonId, c)}
                loading={loadingAddon === addon.addonId}
              />
            }
          >
            {enabled[addon.addonId] ? (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {Object.keys(addon.fields).length > 0
                  ? 'Settings configured for this add-on.'
                  : 'No additional settings required for this add-on.'}
              </Paragraph>
            ) : (
              <span style={{ opacity: 0.5 }}>Disabled</span>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
