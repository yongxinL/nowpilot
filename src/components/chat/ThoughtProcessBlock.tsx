import React, { useState } from 'react';
import { RightOutlined, DownOutlined } from '@ant-design/icons';

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

  const parseInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-zinc-800 dark:text-zinc-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="italic text-zinc-600 dark:text-zinc-300">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  const renderFormattedLines = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-1" />;

      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        return (
          <div key={idx} className="my-1 italic text-zinc-400 dark:text-zinc-500 text-[11.5px] leading-relaxed">
            {trimmed}
          </div>
        );
      }

      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
      if (numMatch) {
        const num = numMatch[1];
        const rest = numMatch[2];
        return (
          <div key={idx} className="flex items-start gap-1.5 my-1 text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200 min-w-[16px]">{num}</span>
            <div className="flex-1">{parseInlineMarkdown(rest)}</div>
          </div>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const rest = trimmed.substring(2);
        return (
          <div key={idx} className="flex items-start gap-2 ml-2.5 my-0.5 text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
            <span className="text-zinc-400 dark:text-zinc-500">•</span>
            <div className="flex-1">{parseInlineMarkdown(rest)}</div>
          </div>
        );
      }

      return (
        <div key={idx} className="my-0.5 text-zinc-600 dark:text-zinc-300 text-xs leading-relaxed">
          {parseInlineMarkdown(trimmed)}
        </div>
      );
    });
  };

  const rawContent = thoughtText || 'Analyzing prompt and formulating optimal step-by-step reasoning...';

  // Active Thinking State (Screenshot 1: snSGL1786969215cvm6y2at.png)
  if (isThinking) {
    return (
      <div className="w-full my-2 font-sans">
        <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-400 text-xs mb-1.5 font-normal select-none">
          <svg className="w-3.5 h-3.5 text-zinc-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" strokeDasharray="16 32" strokeLinecap="round" />
          </svg>
          <span className="italic text-zinc-400 dark:text-zinc-400 font-normal">Thinking...</span>
        </div>

        {/* Indented Left Border Stream block */}
        <div className="border-l-2 border-zinc-200 dark:border-zinc-700/80 pl-3.5 ml-1 my-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
          {renderFormattedLines(rawContent)}
        </div>
      </div>
    );
  }

  // Finished Thinking State (Screenshot 3: snSGL1786969760jtt8rghv.png)
  return (
    <div className="w-full my-1.5 font-sans">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-1 py-0.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 text-xs font-normal cursor-pointer transition-colors select-none"
      >
        <svg className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span className="font-normal text-xs">Thought process</span>
        <span className="text-[10px] ml-0.5 text-zinc-400">
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100 mt-1 mb-1' : 'grid-rows-[0fr] opacity-0 mt-0 mb-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-l-2 border-zinc-200 dark:border-zinc-700/80 pl-3.5 ml-1 py-1 text-zinc-600 dark:text-zinc-400 text-xs">
            {renderFormattedLines(rawContent)}
          </div>
        </div>
      </div>
    </div>
  );
};


