import React, { useState } from 'react';
import { Tooltip, App } from 'antd';
import {
  CopyOutlined,
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
  ReloadOutlined,
  ShareAltOutlined,
  SoundOutlined,
  CheckOutlined,
  EditOutlined,
  MessageOutlined,
  FileAddOutlined,
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
  const [liked, setLiked] = useState<boolean | null>(null);

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

  const handleLike = () => {
    if (liked === true) {
      setLiked(null);
    } else {
      setLiked(true);
      antMessage.success('Marked as useful');
    }
  };

  const handleDislike = () => {
    if (liked === false) {
      setLiked(null);
    } else {
      setLiked(false);
      antMessage.info('Feedback recorded');
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
    antMessage.info('Reading message aloud...');
  };

  const handleShare = () => {
    if (onShare) {
      onShare(content);
    } else {
      navigator.clipboard.writeText(content);
      antMessage.success('Share content copied to clipboard');
    }
  };

  // Visibility logic:
  const visibilityClass = type === 'ai' && isLatest
    ? 'opacity-90 hover:opacity-100'
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

        <Tooltip title={speaking ? "Stop speaking" : "Read aloud"}>
          <button
            onClick={handleTTS}
            className={`p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer ${
              speaking ? 'text-blue-600 dark:text-blue-400 animate-pulse' : ''
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
      className={`flex items-center gap-0.5 mt-2 text-zinc-400 dark:text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${visibilityClass} ${className}`}
    >
      {/* 1. Copy */}
      <Tooltip title="Copy">
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          {copied ? <CheckOutlined className="text-emerald-500" /> : <CopyOutlined />}
        </button>
      </Tooltip>

      {/* 2. Save as a note */}
      {onSaveToNote && (
        <Tooltip title="Save as a note">
          <button
            onClick={() => onSaveToNote(content)}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            <FileAddOutlined />
          </button>
        </Tooltip>
      )}

      {/* 3. Regenerate response */}
      <Tooltip title="Regenerate response">
        <button
          onClick={onRegenerate}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          <ReloadOutlined />
        </button>
      </Tooltip>

      {/* 4. Quote */}
      {onQuote && (
        <Tooltip title="Quote">
          <button
            onClick={() => onQuote(content)}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
          >
            <MessageOutlined />
          </button>
        </Tooltip>
      )}

      {/* 5. Read aloud */}
      <Tooltip title={speaking ? "Stop speaking" : "Read aloud"}>
        <button
          onClick={handleTTS}
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer ${
            speaking ? 'text-blue-600 dark:text-blue-400 animate-pulse' : ''
          }`}
        >
          <SoundOutlined />
        </button>
      </Tooltip>

      {/* 6. Like */}
      <Tooltip title="Like">
        <button
          onClick={handleLike}
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer ${
            liked === true ? 'text-blue-500 font-bold' : ''
          }`}
        >
          {liked === true ? <LikeFilled /> : <LikeOutlined />}
        </button>
      </Tooltip>

      {/* 7. Dislike */}
      <Tooltip title="Dislike">
        <button
          onClick={handleDislike}
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer ${
            liked === false ? 'text-rose-500 font-bold' : ''
          }`}
        >
          {liked === false ? <DislikeFilled /> : <DislikeOutlined />}
        </button>
      </Tooltip>

      {/* 8. Share */}
      <Tooltip title="Share">
        <button
          onClick={handleShare}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs flex items-center justify-center cursor-pointer"
        >
          <ShareAltOutlined />
        </button>
      </Tooltip>
    </div>
  );
};


