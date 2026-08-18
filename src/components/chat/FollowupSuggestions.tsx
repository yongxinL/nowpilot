import React, { useState } from 'react';
import { CompassOutlined, ArrowRightOutlined, CloseOutlined } from '@ant-design/icons';

interface FollowupSuggestionsProps {
  suggestions?: string[];
  onSelectSuggestion: (prompt: string) => void;
  onDeepResearch?: () => void;
}

export const FollowupSuggestions: React.FC<FollowupSuggestionsProps> = ({
  suggestions,
  onSelectSuggestion,
  onDeepResearch,
}) => {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="mt-3 flex flex-col gap-2 w-full">
      {/* Deep Research Banner Card */}
      {!dismissed && (
        <div
          onClick={onDeepResearch}
          className="group relative flex items-center justify-between p-3 pr-8 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-2xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-zinc-800 dark:text-zinc-100 text-xs font-semibold">
              Go further——in-depth analysis with Deep Research
            </span>
            <ArrowRightOutlined className="text-xs text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-300">
              <CompassOutlined className="text-sm" />
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
            title="Close banner"
          >
            <CloseOutlined className="text-[10px]" />
          </button>
        </div>
      )}

      {/* Suggestion Chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {suggestions.map((sugg, i) => (
            <button
              key={i}
              onClick={() => onSelectSuggestion(sugg)}
              className="px-3 py-1.5 bg-zinc-100/90 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60 rounded-xl text-xs text-zinc-700 dark:text-zinc-200 font-medium cursor-pointer transition-colors text-left"
            >
              {sugg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

