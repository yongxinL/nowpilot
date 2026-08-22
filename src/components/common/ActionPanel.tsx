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
  className,
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
  const visibilityStyle: React.CSSProperties =
    type === 'ai' && isLatest
      ? { opacity: 0.9 }
      : { opacity: 0, transition: 'opacity 200ms ease' };

  if (type === 'user') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 4,
          color: 'var(--muted-foreground)',
          justifyContent: 'flex-end',
          ...visibilityStyle,
          ...(className ? { className } : {}),
        }}
      >
        {onEdit && (
          <Tooltip title="Edit">
            <button
              onClick={onEdit}
              style={{
                padding: 4,
                borderRadius: 6,
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
              }}
            >
              <EditOutlined />
            </button>
          </Tooltip>
        )}

        <Tooltip title="Copy">
          <button
            onClick={handleCopy}
            style={{
              padding: 4,
              borderRadius: 6,
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
            }}
          >
            {copied ? <CheckOutlined style={{ color: '#10b981' }} /> : <CopyOutlined />}
          </button>
        </Tooltip>

        {onQuote && (
          <Tooltip title="Quote">
            <button
              onClick={() => onQuote(content)}
              style={{
                padding: 4,
                borderRadius: 6,
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
              }}
            >
              <MessageOutlined />
            </button>
          </Tooltip>
        )}

        <Tooltip title={speaking ? "Stop speaking" : "Read aloud"}>
          <button
            onClick={handleTTS}
            className={speaking ? 'np-pulse' : undefined}
            style={{
              padding: 4,
              borderRadius: 6,
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: speaking ? '#3b82f6' : 'inherit',
            }}
          >
            <SoundOutlined />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        marginTop: 8,
        color: 'var(--muted-foreground)',
        ...visibilityStyle,
        ...(className ? { className } : {}),
      }}
    >
      {/* 1. Copy */}
      <Tooltip title="Copy">
        <button
          onClick={handleCopy}
          style={{
            padding: 6,
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
          }}
        >
          {copied ? <CheckOutlined style={{ color: '#10b981' }} /> : <CopyOutlined />}
        </button>
      </Tooltip>

      {/* 2. Save as a note */}
      {onSaveToNote && (
        <Tooltip title="Save as a note">
          <button
            onClick={() => onSaveToNote(content)}
            style={{
              padding: 6,
              borderRadius: 6,
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
            }}
          >
            <FileAddOutlined />
          </button>
        </Tooltip>
      )}

      {/* 3. Regenerate response */}
      <Tooltip title="Regenerate response">
        <button
          onClick={onRegenerate}
          style={{
            padding: 6,
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
          }}
        >
          <ReloadOutlined />
        </button>
      </Tooltip>

      {/* 4. Quote */}
      {onQuote && (
        <Tooltip title="Quote">
          <button
            onClick={() => onQuote(content)}
            style={{
              padding: 6,
              borderRadius: 6,
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              color: 'inherit',
            }}
          >
            <MessageOutlined />
          </button>
        </Tooltip>
      )}

      {/* 5. Read aloud */}
      <Tooltip title={speaking ? "Stop speaking" : "Read aloud"}>
        <button
          onClick={handleTTS}
          className={speaking ? 'np-pulse' : undefined}
          style={{
            padding: 6,
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: speaking ? '#3b82f6' : 'inherit',
          }}
        >
          <SoundOutlined />
        </button>
      </Tooltip>

      {/* 6. Like */}
      <Tooltip title="Like">
        <button
          onClick={handleLike}
          style={{
            padding: 6,
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: liked === true ? '#3b82f6' : 'inherit',
            fontWeight: liked === true ? 700 : 400,
          }}
        >
          {liked === true ? <LikeFilled /> : <LikeOutlined />}
        </button>
      </Tooltip>

      {/* 7. Dislike */}
      <Tooltip title="Dislike">
        <button
          onClick={handleDislike}
          style={{
            padding: 6,
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: liked === false ? '#f43f5e' : 'inherit',
            fontWeight: liked === false ? 700 : 400,
          }}
        >
          {liked === false ? <DislikeFilled /> : <DislikeOutlined />}
        </button>
      </Tooltip>

      {/* 8. Share */}
      <Tooltip title="Share">
        <button
          onClick={handleShare}
          style={{
            padding: 6,
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
          }}
        >
          <ShareAltOutlined />
        </button>
      </Tooltip>
    </div>
  );
};
