import React, { useState } from 'react';
import { Typography, Tooltip } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface MarkdownContentProps {
  content: string;
  fontSizeClass?: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  fontSizeClass = 'text-sm',
}) => {
  if (!content) return null;

  // Split content by code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: { type: 'text' | 'code'; content: string; language?: string }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'code',
      content: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  return (
    <div className={`w-full space-y-2 leading-relaxed text-zinc-800 dark:text-zinc-100 font-sans ${fontSizeClass}`}>
      {parts.map((part, index) => {
        if (part.type === 'code') {
          return <CodeBlock key={index} code={part.content} language={part.language} />;
        }
        return <FormattedText key={index} text={part.content} />;
      })}
    </div>
  );
};

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'code' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-950 overflow-hidden text-zinc-100 font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-800/80 dark:bg-zinc-900 border-b border-zinc-700/60 text-[11px] text-zinc-400">
        <span className="font-semibold uppercase tracking-wider">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <CheckOutlined className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <CopyOutlined />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto whitespace-pre leading-normal text-zinc-200">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

interface FormattedTextProps {
  text: string;
}

const FormattedText: React.FC<FormattedTextProps> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header ###
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="font-bold text-base text-zinc-900 dark:text-zinc-100 mt-2 mb-1">
              {renderInlineMarkdown(trimmed.substring(4))}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mt-3 mb-1">
              {renderInlineMarkdown(trimmed.substring(3))}
            </h2>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={idx} className="font-bold text-xl text-zinc-900 dark:text-zinc-100 mt-3 mb-1">
              {renderInlineMarkdown(trimmed.substring(2))}
            </h1>
          );
        }

        // Bullet lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-2 my-0.5">
              <span className="text-violet-500 font-bold">•</span>
              <div className="flex-1">{renderInlineMarkdown(trimmed.substring(2))}</div>
            </div>
          );
        }

        // Numbered lists
        const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5">
              <span className="font-semibold text-violet-600 dark:text-violet-400 min-w-[18px]">
                {numMatch[1]}
              </span>
              <div className="flex-1">{renderInlineMarkdown(numMatch[2])}</div>
            </div>
          );
        }

        return <div key={idx} className="my-0.5">{renderInlineMarkdown(trimmed)}</div>;
      })}
    </>
  );
};

const renderInlineMarkdown = (text: string) => {
  // Process bold **text** and inline code `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 mx-0.5 bg-zinc-100 dark:bg-zinc-800 text-violet-600 dark:text-violet-400 rounded-md font-mono text-xs border border-zinc-200/60 dark:border-zinc-700/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};
