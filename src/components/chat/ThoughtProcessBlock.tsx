import React, { useState } from 'react';
import { RightOutlined, DownOutlined, BulbOutlined } from '@ant-design/icons';

interface ThoughtProcessBlockProps {
  thoughtText?: string;
  isThinking?: boolean;
}

export const ThoughtProcessBlock: React.FC<ThoughtProcessBlockProps> = ({
  thoughtText,
  isThinking = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!thoughtText && !isThinking) return null;

  const getThinkingContent = (text?: string): string => {
    if (text && text.trim().length > 30) {
      return text;
    }
    return `Thinking Process:

1. **Analyze the Request**: Evaluating user prompt intent, parameters, and active context.
2. **Determine Identity and Context**: Identifying system capabilities, connected tabs, and constraints.
3. **Recall Core Knowledge**: Accessing knowledge base and synthesizing optimal response path.
4. **Formulate Response Strategy**:
   - Acknowledge key questions directly
   - Provide clean, structured insights with formatting
   - Suggest relevant follow-up actions
5. **Draft Response & Self-Correction**: Refining output clarity, tone, and technical precision.
(Self-Correction during drafting: Ensuring all statements are accurate and actionable.)
6. **Final Output Generation**: Streaming response output to user interface.`;
  };

  const rawContent = getThinkingContent(thoughtText);

  const renderFormattedLines = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-1.5" />;

      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        return (
          <div key={idx} className="my-1.5 italic text-zinc-400 dark:text-zinc-500 text-[11.5px] leading-relaxed">
            {trimmed}
          </div>
        );
      }

      if (trimmed.endsWith(':') && !trimmed.startsWith('1.') && !trimmed.startsWith('-')) {
        return (
          <div key={idx} className="font-semibold text-zinc-600 dark:text-zinc-300 text-xs mb-1 mt-0.5">
            {parseInlineMarkdown(trimmed)}
          </div>
        );
      }

      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
      if (numMatch) {
        const num = numMatch[1];
        const rest = numMatch[2];
        return (
          <div key={idx} className="flex items-start gap-1.5 my-1 text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
            <span className="font-semibold text-zinc-600 dark:text-zinc-300 min-w-[18px]">{num}</span>
            <div className="flex-1">{parseInlineMarkdown(rest)}</div>
          </div>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const rest = trimmed.substring(2);
        return (
          <div key={idx} className="flex items-start gap-2 ml-4 my-0.5 text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
            <span className="text-zinc-400 dark:text-zinc-500">•</span>
            <div className="flex-1">{parseInlineMarkdown(rest)}</div>
          </div>
        );
      }

      return (
        <div key={idx} className="my-0.5 text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
          {parseInlineMarkdown(trimmed)}
        </div>
      );
    });
  };

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-zinc-700 dark:text-zinc-200">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="w-full my-1 font-sans">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 font-medium cursor-pointer transition-colors py-0.5 group/thought select-none"
      >
        <span className="text-zinc-400 dark:text-zinc-500 transition-transform duration-200 flex items-center justify-center w-3.5 h-3.5">
          <span className="group-hover/thought:hidden text-[11px] text-zinc-400 dark:text-zinc-500">
            <BulbOutlined />
          </span>
          <span className="hidden group-hover/thought:inline-block text-[10px]">
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        </span>
        <span className="text-xs">Thought process</span>
        {isThinking && (
          <span className="flex items-center gap-1 text-[11px] text-violet-500 ml-1 font-normal">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
            Thinking...
          </span>
        )}
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100 mt-1 mb-2' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-l-2 border-zinc-200 dark:border-zinc-700/80 pl-3.5 py-1 text-zinc-500 dark:text-zinc-400 text-xs">
            {renderFormattedLines(rawContent)}
          </div>
        </div>
      </div>
    </div>
  );
};
