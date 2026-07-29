import React, { useState } from 'react';
import { Tooltip, App } from 'antd';
import {
  CopyOutlined,
  BookOutlined,
  ReloadOutlined,
  MessageOutlined,
  ShareAltOutlined,
  SoundOutlined,
  CheckOutlined,
  EditOutlined,
} from '@ant-design/icons';

interface ActionPanelProps {
  type?: 'user' | 'ai';
  content: string;
  isLatest?: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onQuote?: (text: string) => void;
  onSaveToNote?: (text: string) => void;
  onShare?: (text: string) => void;
  className?: string;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  type = 'ai',
  content,
  isLatest = false,
  onEdit,
  onRegenerate,
  onQuote,
  onSaveToNote,
  onShare,
  className = '',
}) => {
  const { message: antMessage } = App.useApp();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      antMessage.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      antMessage.error('Failed to copy');
    }
  };

  const handleTTS = () => {
    if (!('speechSynthesis' in window)) {
      antMessage.warning('Text-to-speech is not supported in this browser');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
    antMessage.info('Speaking text...');
  };

  const handleSaveNote = () => {
    if (onSaveToNote) {
      onSaveToNote(content);
    } else {
      antMessage.success('Saved snippet to Notes');
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare(content);
    } else {
      antMessage.success('Share link generated and copied');
    }
  };

  // Visibility logic:
  // - AI latest response: always visible
  // - AI previous responses & User messages: visible on group hover
  const visibilityClass = type === 'ai' && isLatest
    ? 'opacity-100'
    : 'opacity-0 group-hover:opacity-100 transition-opacity duration-200';

  if (type === 'user') {
    return (
      <div
        className={`flex items-center gap-1 mt-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 justify-end ${visibilityClass} ${className}`}
      >
        {onEdit && (
          <Tooltip title="Edit">
            <button
              onClick={onEdit}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
                <path fill="currentColor" fillRule="evenodd" d="M12.277 1.723a2.16 2.16 0 0 0-3.052 0L1.723 9.225a2.158 2.158 0 0 0 3.052 3.052l7.502-7.502a2.16 2.16 0 0 0 0-3.052m-2.31.742a1.108 1.108 0 1 1 1.568 1.568l-.813.813-1.568-1.568zM8.412 4.021 2.465 9.967a1.108 1.108 0 0 0 1.568 1.568l5.946-5.947z" clipRule="evenodd"></path>
              </svg>
            </button>
          </Tooltip>
        )}

        <Tooltip title="Copy">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            {copied ? (
              <CheckOutlined className="text-emerald-500" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 16 16">
                <path fill="currentColor" fillRule="evenodd" d="M7.386 1H5.414c-.65 0-1.174 0-1.6.035-.436.035-.82.11-1.176.292a3 3 0 0 0-1.311 1.311c-.181.355-.257.74-.292 1.177C1 4.24 1 4.764 1 5.415v1.97c0 .65 0 1.175.035 1.6.035.437.11.822.292 1.177a3 3 0 0 0 1.311 1.311c.355.181.74.257 1.177.292q.18.015.385.022V12a3 3 0 0 0 3 3h3.386c.65 0 1.175 0 1.6-.035.437-.035.82-.11 1.176-.292a3 3 0 0 0 1.311-1.311c.181-.355.257-.74.292-1.177.035-.425.035-.949.035-1.6V7.2a3 3 0 0 0-3-3h-.213a9 9 0 0 0-.022-.385c-.035-.437-.11-.822-.292-1.177a3 3 0 0 0-1.311-1.311c-.355-.181-.74-.257-1.177-.292C8.56 1 8.036 1 7.385 1zM11.8 5.4v1.986c0 .65 0 1.174-.035 1.6-.035.436-.11.82-.292 1.176a3 3 0 0 1-1.311 1.311c-.355.181-.74.257-1.177.292-.425.035-.949.035-1.6.035H5.4v.2a1.8 1.8 0 0 0 1.8 1.8h3.36c.682 0 1.157 0 1.527-.03.364-.03.572-.086.73-.166a1.8 1.8 0 0 0 .787-.787c.08-.158.136-.366.165-.73.03-.37.031-.845.031-1.527V7.2A1.8 1.8 0 0 0 12 5.4zM3.183 2.396c.158-.08.366-.136.73-.165.37-.03.845-.031 1.527-.031h1.92c.682 0 1.157 0 1.527.03.364.03.572.086.73.166a1.8 1.8 0 0 1 .787.787c.08.158.136.366.165.73.03.37.031.845.031 1.527v1.92c0 .682 0 1.157-.03 1.527-.03.364-.086.572-.166.73a1.8 1.8 0 0 1-.787.787c-.158.08-.366.136-.73.165-.37.03-.845.031-1.527.031H5.44c-.682 0-1.157 0-1.527-.03-.364-.03-.572-.086-.73-.166a1.8 1.8 0 0 1-.787-.787c-.08-.158-.136-.366-.165-.73-.03-.37-.031-.845-.031-1.527V5.44c0-.682 0-1.157.03-1.527.03-.364.086-.572.166-.73a1.8 1.8 0 0 1 .787-.787" clipRule="evenodd"></path>
              </svg>
            )}
          </button>
        </Tooltip>

        {onQuote && (
          <Tooltip title="Quote">
            <button
              onClick={() => onQuote(content)}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 60 60">
                <path fill="currentColor" d="M46.967 32.397c-.926-.076-2.054-.076-3.378-.076h-.178c-1.324 0-2.452 0-3.378.076-.777.063-1.536.187-2.272.469.098-6.499.82-10.02 2.175-12.433 1.437-2.555 3.746-4.177 8.038-6.727a2.25 2.25 0 0 0-2.298-3.869c-4.208 2.5-7.561 4.654-9.662 8.392-2.076 3.692-2.764 8.614-2.764 16.218v8.213c0 1.324 0 2.452.076 3.378.08.973.253 1.92.714 2.825a7.25 7.25 0 0 0 3.169 3.168c.904.461 1.85.635 2.824.715.926.075 2.054.075 3.378.075h.178c1.324 0 2.452 0 3.378-.075.973-.08 1.92-.254 2.824-.715a7.25 7.25 0 0 0 3.169-3.168c.46-.905.635-1.852.714-2.825.076-.926.076-2.054.076-3.378v-.177c0-1.325 0-2.453-.076-3.38-.08-.972-.253-1.919-.714-2.823a7.25 7.25 0 0 0-3.169-3.169c-.904-.46-1.85-.635-2.824-.714m-25.999 0c-.926-.076-2.054-.076-3.378-.076h-.177c-1.325 0-2.453 0-3.38.076-.776.063-1.535.187-2.27.469.097-6.499.818-10.02 2.174-12.433 1.437-2.555 3.746-4.177 8.038-6.727a2.25 2.25 0 0 0-2.298-3.869c-4.208 2.5-7.561 4.654-9.662 8.392C7.939 21.92 7.25 26.843 7.25 34.447v8.213c0 1.324 0 2.452.076 3.378.08.973.253 1.92.714 2.825a7.25 7.25 0 0 0 3.168 3.168c.905.461 1.852.635 2.825.715.926.075 2.054.075 3.378.075h.178c1.324 0 2.452 0 3.378-.075.973-.08 1.92-.254 2.824-.715a7.25 7.25 0 0 0 3.169-3.168c.46-.905.635-1.852.714-2.825.076-.926.076-2.054.076-3.378v-.177c0-1.325 0-2.453-.076-3.38-.08-.972-.253-1.919-.714-2.823a7.25 7.25 0 0 0-3.169-3.169c-.904-.46-1.85-.635-2.824-.714z"></path>
              </svg>
            </button>
          </Tooltip>
        )}

        <Tooltip title="Share">
          <button
            onClick={handleShare}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            <ShareAltOutlined />
          </button>
        </Tooltip>

        <Tooltip title={speaking ? "Stop speaking" : "Read aloud"}>
          <button
            onClick={handleTTS}
            className={`p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer ${
              speaking ? 'text-violet-600 dark:text-violet-400 animate-pulse' : ''
            }`}
          >
            <SoundOutlined />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 mt-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 ${visibilityClass} ${className}`}
    >
      <Tooltip title="Copy">
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          {copied ? (
            <CheckOutlined className="text-emerald-500" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 16 16">
              <path fill="currentColor" fillRule="evenodd" d="M7.386 1H5.414c-.65 0-1.174 0-1.6.035-.436.035-.82.11-1.176.292a3 3 0 0 0-1.311 1.311c-.181.355-.257.74-.292 1.177C1 4.24 1 4.764 1 5.415v1.97c0 .65 0 1.175.035 1.6.035.437.11.822.292 1.177a3 3 0 0 0 1.311 1.311c.355.181.74.257 1.177.292q.18.015.385.022V12a3 3 0 0 0 3 3h3.386c.65 0 1.175 0 1.6-.035.437-.035.82-.11 1.176-.292a3 3 0 0 0 1.311-1.311c.181-.355.257-.74.292-1.177.035-.425.035-.949.035-1.6V7.2a3 3 0 0 0-3-3h-.213a9 9 0 0 0-.022-.385c-.035-.437-.11-.822-.292-1.177a3 3 0 0 0-1.311-1.311c-.355-.181-.74-.257-1.177-.292C8.56 1 8.036 1 7.385 1zM11.8 5.4v1.986c0 .65 0 1.174-.035 1.6-.035.436-.11.82-.292 1.176a3 3 0 0 1-1.311 1.311c-.355.181-.74.257-1.177.292-.425.035-.949.035-1.6.035H5.4v.2a1.8 1.8 0 0 0 1.8 1.8h3.36c.682 0 1.157 0 1.527-.03.364-.03.572-.086.73-.166a1.8 1.8 0 0 0 .787-.787c.08-.158.136-.366.165-.73.03-.37.031-.845.031-1.527V7.2A1.8 1.8 0 0 0 12 5.4zM3.183 2.396c.158-.08.366-.136.73-.165.37-.03.845-.031 1.527-.031h1.92c.682 0 1.157 0 1.527.03.364.03.572.086.73.166a1.8 1.8 0 0 1 .787.787c.08.158.136.366.165.73.03.37.031.845.031 1.527v1.92c0 .682 0 1.157-.03 1.527-.03.364-.086.572-.166.73a1.8 1.8 0 0 1-.787.787c-.158.08-.366.136-.73.165-.37.03-.845.031-1.527.031H5.44c-.682 0-1.157 0-1.527-.03-.364-.03-.572-.086-.73-.166a1.8 1.8 0 0 1-.787-.787c-.08-.158-.136-.366-.165-.73-.03-.37-.031-.845-.031-1.527V5.44c0-.682 0-1.157.03-1.527.03-.364.086-.572.166-.73a1.8 1.8 0 0 1 .787-.787" clipRule="evenodd"></path>
            </svg>
          )}
        </button>
      </Tooltip>

      <Tooltip title="Save as a note">
        <button
          onClick={handleSaveNote}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14">
            <path fill="currentColor" fillRule="evenodd" d="M10.675 4.2a.525.525 0 0 0 1.05 0V3.092h1.108a.525.525 0 1 0 0-1.05h-1.108V.933a.525.525 0 1 0-1.05 0v1.109H9.567a.525.525 0 1 0 0 1.05h1.108zM4.783 1.108H4.74c-.283 0-.482 0-.658.026A2.39 2.39 0 0 0 2.068 3.15c-.026.175-.026.374-.026.657v.044a.525.525 0 1 0 1.05 0c0-.344.001-.459.014-.547a1.34 1.34 0 0 1 1.13-1.13c.089-.013.203-.015.547-.015h2.573a.525.525 0 1 0 0-1.05H4.783Zm7.409 5.425a.525.525 0 0 0-1.05 0v3.314c0 .53 0 .898-.024 1.183-.023.279-.065.432-.123.546a1.34 1.34 0 0 1-.586.586c-.113.058-.267.1-.546.122-.285.024-.652.024-1.183.024H4.783c-.344 0-.458-.001-.547-.014a1.34 1.34 0 0 1-1.13-1.13c-.013-.089-.014-.204-.014-.547a.525.525 0 0 0-1.05 0v.043c0 .283 0 .482.026.658a2.39 2.39 0 0 0 2.014 2.014c.176.026.375.026.658.026h3.962c.504 0 .914 0 1.247-.027.344-.028.65-.088.937-.233.45-.23.816-.596 1.045-1.046.146-.286.205-.593.234-.937.027-.332.027-.742.027-1.246zM1.108 6.067c0-.29.235-.525.525-.525H3.5a.525.525 0 1 1 0 1.05H1.633a.525.525 0 0 1-.525-.525m.525 1.808a.525.525 0 1 0 0 1.05H3.5a.525.525 0 1 0 0-1.05z" clipRule="evenodd"></path>
          </svg>
        </button>
      </Tooltip>

      {onRegenerate && (
        <Tooltip title="Regenerate response">
          <button
            onClick={onRegenerate}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            <ReloadOutlined />
          </button>
        </Tooltip>
      )}

      {onQuote && (
        <Tooltip title="Quote">
          <button
            onClick={() => onQuote(content)}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 60 60">
              <path fill="currentColor" d="M46.967 32.397c-.926-.076-2.054-.076-3.378-.076h-.178c-1.324 0-2.452 0-3.378.076-.777.063-1.536.187-2.272.469.098-6.499.82-10.02 2.175-12.433 1.437-2.555 3.746-4.177 8.038-6.727a2.25 2.25 0 0 0-2.298-3.869c-4.208 2.5-7.561 4.654-9.662 8.392-2.076 3.692-2.764 8.614-2.764 16.218v8.213c0 1.324 0 2.452.076 3.378.08.973.253 1.92.714 2.825a7.25 7.25 0 0 0 3.169 3.168c.904.461 1.85.635 2.824.715.926.075 2.054.075 3.378.075h.178c1.324 0 2.452 0 3.378-.075.973-.08 1.92-.254 2.824-.715a7.25 7.25 0 0 0 3.169-3.168c.46-.905.635-1.852.714-2.825.076-.926.076-2.054.076-3.378v-.177c0-1.325 0-2.453-.076-3.38-.08-.972-.253-1.919-.714-2.823a7.25 7.25 0 0 0-3.169-3.169c-.904-.46-1.85-.635-2.824-.714m-25.999 0c-.926-.076-2.054-.076-3.378-.076h-.177c-1.325 0-2.453 0-3.38.076-.776.063-1.535.187-2.27.469.097-6.499.818-10.02 2.174-12.433 1.437-2.555 3.746-4.177 8.038-6.727a2.25 2.25 0 0 0-2.298-3.869c-4.208 2.5-7.561 4.654-9.662 8.392C7.939 21.92 7.25 26.843 7.25 34.447v8.213c0 1.324 0 2.452.076 3.378.08.973.253 1.92.714 2.825a7.25 7.25 0 0 0 3.168 3.168c.905.461 1.852.635 2.825.715.926.075 2.054.075 3.378.075h.178c1.324 0 2.452 0 3.378-.075.973-.08 1.92-.254 2.824-.715a7.25 7.25 0 0 0 3.169-3.168c.46-.905.635-1.852.714-2.825.076-.926.076-2.054.076-3.378v-.177c0-1.325 0-2.453-.076-3.38-.08-.972-.253-1.919-.714-2.823a7.25 7.25 0 0 0-3.169-3.169c-.904-.46-1.85-.635-2.824-.714z"></path>
            </svg>
          </button>
        </Tooltip>
      )}

      <Tooltip title="Share">
        <button
          onClick={handleShare}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          <ShareAltOutlined />
        </button>
      </Tooltip>

      <Tooltip title={speaking ? "Stop speaking" : "Read aloud"}>
        <button
          onClick={handleTTS}
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer ${
            speaking ? 'text-violet-600 dark:text-violet-400 animate-pulse' : ''
          }`}
        >
          <SoundOutlined />
        </button>
      </Tooltip>
    </div>
  );
};

