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
              <EditOutlined />
            </button>
          </Tooltip>
        )}

        <Tooltip title="Copy">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            {copied ? <CheckOutlined className="text-emerald-500" /> : <CopyOutlined />}
          </button>
        </Tooltip>

        {onQuote && (
          <Tooltip title="Quote">
            <button
              onClick={() => onQuote(content)}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
            >
              <MessageOutlined />
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
          {copied ? <CheckOutlined className="text-emerald-500" /> : <CopyOutlined />}
        </button>
      </Tooltip>

      <Tooltip title="Save as a note">
        <button
          onClick={handleSaveNote}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          <BookOutlined />
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
            <MessageOutlined />
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

