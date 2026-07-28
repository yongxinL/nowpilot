import React from 'react';
import { Dropdown, Button } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { AVAILABLE_MODELS } from '../../services/aiProvider';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
}) => {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  const groups = Array.from(new Set(AVAILABLE_MODELS.map(m => m.group || 'OpenAI')));

  return (
    <Dropdown
      trigger={['click']}
      popupRender={() => (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700/80 p-2 min-w-[210px] max-w-[260px]">
          {groups.map(groupName => {
            const groupModels = AVAILABLE_MODELS.filter(m => (m.group || 'OpenAI') === groupName);
            return (
              <div key={groupName} className="mb-2 last:mb-0">
                <div className="px-2.5 py-1 text-xs font-normal text-zinc-400 dark:text-zinc-500">
                  {groupName}
                </div>
                <div className="space-y-1 mt-0.5">
                  {groupModels.map(m => {
                    const isSelected = m.id === selectedModelId;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectModel(m.id)}
                        className={`px-2.5 py-1.5 rounded-xl flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                          isSelected
                            ? 'bg-violet-100/90 dark:bg-violet-950/80 text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-normal'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-700 dark:text-zinc-200 flex-shrink-0">
                          ⚡
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
        type="default"
        size="small"
        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-none rounded-full text-xs text-zinc-800 dark:text-zinc-200 font-medium transition-all cursor-pointer"
      >
        <span className="text-violet-600 dark:text-violet-400 text-xs">⚡</span>
        <span>{currentModel.name}</span>
        <DownOutlined className="text-[10px] text-zinc-400 ml-0.5" />
      </Button>
    </Dropdown>
  );
};
