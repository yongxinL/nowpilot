import React from 'react';
import { Select, Tag, Typography } from 'antd';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { useProviderStore } from '../../core/stores/providerStore';

const { Text } = Typography;

export interface ProviderSelectorProps {
  /** When true, renders as compact text/tag for Side Panel */
  compact?: boolean;
}

/**
 * Read-only(ish) provider selector.
 *
 * Full App: AntD `<Select>` showing available providers from workspaceStore.
 * Side Panel: Compact text/Tag to save space.
 *
 * Wired to useWorkspaceStore for activeProvider and useProviderStore for options.
 */
export function ProviderSelector({ compact }: ProviderSelectorProps) {
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const setActiveProvider = useWorkspaceStore((s) => s.setActiveProvider);
  const providers = useProviderStore((s) => s.apiKeys);
  const providerNames = Object.keys(providers);

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Provider:
        </Text>
        <Tag style={{ margin: 0, fontSize: 11 }}>
          {activeProvider || 'None'}
        </Tag>
      </div>
    );
  }

  return (
    <Select
      style={{ width: 200 }}
      value={activeProvider}
      onChange={(val) => setActiveProvider(val)}
      placeholder="Select provider"
      allowClear
      options={providerNames.length > 0
        ? providerNames.map((name) => ({ label: name, value: name }))
        : [{ label: activeProvider || 'No providers configured', value: activeProvider || '' }]
      }
    />
  );
}
