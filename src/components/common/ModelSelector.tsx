import React, { useState, useMemo } from 'react';
import { Dropdown, Button } from 'antd';
import { DownOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useExtensionStore } from '../../store/useExtensionStore';
import { CustomProviderId } from '../../types';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
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

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      popupRender={() => (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700/80 p-2 min-w-[210px] max-w-[280px]">
          {groups.map((groupName) => {
            const groupModels = availableModels.filter((m) => m.group === groupName);
            return (
              <div key={groupName} className="mb-2 last:mb-0">
                <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {groupName}
                </div>
                <div className="space-y-1 mt-0.5">
                  {groupModels.map((m) => {
                    const isSelected = m.id === selectedModelId;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelect(m.id)}
                        className={`px-2.5 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer text-xs transition-all ${
                          isSelected
                            ? 'bg-violet-100/90 dark:bg-violet-950/80 text-violet-900 dark:text-violet-100 font-semibold'
                            : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-normal'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-violet-50 dark:bg-zinc-700 flex items-center justify-center text-[10px] text-violet-600 dark:text-violet-400 flex-shrink-0">
                          <ThunderboltOutlined style={{ fontSize: 11 }} />
                        </div>
                        <span className="truncate">{m.name}</span>
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
      <Button
        type="text"
        size="small"
        className="flex items-center gap-1.5 px-2 py-1 !border-none !bg-transparent hover:!bg-zinc-100 dark:hover:!bg-zinc-800/80 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 font-medium transition-all cursor-pointer !shadow-none"
      >
        <span className="text-violet-600 dark:text-violet-400 text-xs flex items-center">
          <ThunderboltOutlined style={{ fontSize: 12 }} />
        </span>
        <span className="truncate max-w-[130px] font-semibold">{currentModel.name}</span>
        <DownOutlined className="text-[10px] text-zinc-400 ml-0.5" />
      </Button>
    </Dropdown>
  );
};

