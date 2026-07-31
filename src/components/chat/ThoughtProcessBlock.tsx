import React from 'react';
import { Think } from '@ant-design/x';

interface ThoughtProcessBlockProps {
  thoughtText?: string;
  isThinking?: boolean;
}

export const ThoughtProcessBlock: React.FC<ThoughtProcessBlockProps> = ({
  thoughtText,
  isThinking = false,
}) => {
  if (!thoughtText && !isThinking) return null;

  return (
    <div className="w-full my-1">
      <Think
        title="Thought process"
        loading={isThinking}
        blink
        defaultExpanded={false}
      >
        <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
          {thoughtText || 'Thinking...'}
        </div>
      </Think>
    </div>
  );
};
