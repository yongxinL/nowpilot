import React, { useState } from 'react';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { XMarkdown } from '@ant-design/x-markdown';

interface MarkdownContentProps {
  content: string;
  fontSizeClass?: string;
  isStreaming?: boolean;
}

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-950 overflow-hidden text-zinc-100 font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-800/80 dark:bg-zinc-900 border-b border-zinc-700/60 text-[11px] text-zinc-400">
        <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
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

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  fontSizeClass = 'text-sm',
  isStreaming = false,
}) => {
  if (!content) return null;

  return (
    <div className={`w-full leading-relaxed text-zinc-800 dark:text-zinc-100 font-sans ${fontSizeClass}`}>
      <XMarkdown
        content={content}
        openLinksInNewTab
        streaming={isStreaming ? { hasNextChunk: true, enableAnimation: true, tail: true } : undefined}
        components={{
          pre: ({ children, ...rest }) => {
            const child = React.Children.toArray(children)[0];
            if (React.isValidElement<{ children?: unknown; className?: string }>(child) && child.type === 'code') {
              const code = String(child.props.children || '');
              const lang = String(child.props.className || '').replace('language-', '') || '';
              return <CodeBlock code={code} language={lang} />;
            }
            return <pre {...rest}>{children}</pre>;
          },
        }}
      />
    </div>
  );
};
