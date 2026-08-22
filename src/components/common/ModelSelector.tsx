import React, { useState, useMemo } from 'react';
import { Dropdown, Button } from 'antd';
import { DownOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useExtensionStore } from '../../store/useExtensionStore';
import { CustomProviderId } from '../../types';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  variant?: 'subtle' | 'pill';
  className?: string;
}

interface DynamicModelOption {
  id: string;
  name: string;
  group: string;
}

const CHATGPT_WEBAPP_MODELS: DynamicModelOption[] = [
  { id: 'gpt-4o', name: 'GPT-4o', group: 'ChatGPT Webapp' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', group: 'ChatGPT Webapp' },
  { id: 'o1-mini', name: 'o1-mini', group: 'ChatGPT Webapp' },
  { id: 'o3-mini', name: 'o3-mini', group: 'ChatGPT Webapp' },
];

const DEFAULT_FALLBACK_MODELS: DynamicModelOption[] = [
  { id: 'gpt-4o', name: 'GPT-4o', group: 'OpenAI' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', group: 'Anthropic' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', group: 'Google Gemini' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
  variant = 'subtle',
}) => {
  const [open, setOpen] = useState(false);
  const { config } = useExtensionStore();

  const isWebapp = config.serviceProvider === 'ChatGPT Webapp';

  const availableModels = useMemo<DynamicModelOption[]>(() => {
    if (isWebapp) {
      return CHATGPT_WEBAPP_MODELS;
    }

    const customList: DynamicModelOption[] = [];
    const providerKeys: CustomProviderId[] = ['openai', 'claude', 'gemini', 'ollama'];

    providerKeys.forEach((pId) => {
      const detail = config.providers?.[pId];
      if (detail && detail.models && detail.models.length > 0) {
        detail.models.forEach((m) => {
          if (m.enabled) {
            customList.push({
              id: m.id,
              name: m.name,
              group: detail.name || pId.toUpperCase(),
            });
          }
        });
      }
    });

    return customList.length > 0 ? customList : DEFAULT_FALLBACK_MODELS;
  }, [isWebapp, config.providers, config.serviceProvider]);

  const currentModel = useMemo(() => {
    const found = availableModels.find((m) => m.id === selectedModelId);
    if (found) return found;
    if (selectedModelId) {
      return { id: selectedModelId, name: selectedModelId, group: 'Active Model' };
    }
    return availableModels[0] || DEFAULT_FALLBACK_MODELS[0];
  }, [availableModels, selectedModelId]);

  const groups = useMemo(() => {
    return Array.from(new Set(availableModels.map((m) => m.group)));
  }, [availableModels]);

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId);
    setOpen(false);
  };

  const buttonStyle: React.CSSProperties =
    variant === 'pill'
      ? {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4,
          background: 'var(--muted)',
          color: 'var(--foreground)',
          fontWeight: 500,
          fontSize: 12,
          borderRadius: 8,
          transition: 'all 200ms ease',
          cursor: 'pointer',
          userSelect: 'none',
          border: '1px solid var(--border)',
        }
      : {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 4,
          paddingBottom: 4,
          color: 'var(--foreground)',
          fontWeight: 600,
          fontSize: 12,
          borderRadius: 12,
          transition: 'all 200ms ease',
          cursor: 'pointer',
          userSelect: 'none',
          background: 'transparent',
          border: 'none',
        };

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="topLeft"
      popupRender={() => (
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
            padding: 8,
            minWidth: 210,
            maxWidth: 280,
          }}
        >
          {groups.map((groupName) => {
            const groupModels = availableModels.filter((m) => m.group === groupName);
            return (
              <div key={groupName} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 4,
                    paddingBottom: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {groupName}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  {groupModels.map((m) => {
                    const isSelected = m.id === selectedModelId;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelect(m.id)}
                        style={{
                          paddingLeft: 10,
                          paddingRight: 10,
                          paddingTop: 6,
                          paddingBottom: 6,
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          fontSize: 12,
                          transition: 'all 200ms ease',
                          background: isSelected ? 'var(--muted)' : 'transparent',
                          color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)',
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 9999,
                            background: 'var(--muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            color: '#7c3aed',
                            flexShrink: 0,
                          }}
                        >
                          <ThunderboltOutlined style={{ fontSize: 11 }} />
                        </div>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    >
      <button
        type="button"
        style={buttonStyle}
      >
        <span
          style={{
            color: '#7c3aed',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <ThunderboltOutlined />
        </span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 140,
            fontWeight: 500,
          }}
        >
          {currentModel.name}
        </span>
        <DownOutlined style={{ fontSize: 9, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 2 }} />
      </button>
    </Dropdown>
  );
};
