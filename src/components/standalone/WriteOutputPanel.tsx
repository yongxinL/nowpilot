import React, { useState, useMemo } from 'react';
import { Tooltip, App } from 'antd';
import {
  ThunderboltOutlined,
  LeftOutlined,
  RightOutlined,
  CopyOutlined,
  ReloadOutlined,
  SoundOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  FileAddOutlined,
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
  ShareAltOutlined,
} from '@ant-design/icons';

interface WriteOutputPanelProps {
  currentOutput: string;
  selectedModelName: string;
  outputVersions: string[];
  currentVersionIndex: number;
  onPrevVersion: () => void;
  onNextVersion: () => void;
  isEditingOutput: boolean;
  editableOutputText: string;
  onChangeEditableOutputText: (val: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  isPlayingAudio: boolean;
  onToggleSpeech: () => void;
  onSaveToNote?: () => void;
  onShare?: () => void;
}

export const WriteOutputPanel: React.FC<WriteOutputPanelProps> = ({
  currentOutput,
  selectedModelName,
  outputVersions,
  currentVersionIndex,
  onPrevVersion,
  onNextVersion,
  isEditingOutput,
  editableOutputText,
  onChangeEditableOutputText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onCopy,
  onRegenerate,
  isPlayingAudio,
  onToggleSpeech,
  onSaveToNote,
  onShare,
}) => {
  const { message: antMessage } = App.useApp();
  const [liked, setLiked] = useState<boolean | null>(null);

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

  const handleShare = () => {
    if (onShare) {
      onShare();
    } else {
      navigator.clipboard.writeText(currentOutput);
      antMessage.success('Share content copied to clipboard');
    }
  };

  // Extract title if the text starts with a title line
  const parsed = useMemo(() => {
    if (!currentOutput) return { title: '', paragraphs: [] };
    const lines = currentOutput.split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // If it starts with markdown # or is a short title line followed by empty line
      if (firstLine.startsWith('# ')) {
        const title = firstLine.replace(/^#+\s*/, '');
        const rest = lines.slice(1).join('\n').trim();
        const paragraphs = rest.split(/\n\s*\n/).filter(Boolean);
        return { title, paragraphs };
      }
      if (lines.length > 1 && lines[1].trim() === '' && firstLine.length < 100 && !firstLine.endsWith('.')) {
        const title = firstLine;
        const rest = lines.slice(2).join('\n').trim();
        const paragraphs = rest.split(/\n\s*\n/).filter(Boolean);
        return { title, paragraphs };
      }
    }
    const paragraphs = currentOutput.split(/\n\s*\n/).filter(Boolean);
    return { title: '', paragraphs };
  }, [currentOutput]);

  if (!currentOutput) {
    return (
      <div style={{
            height: '100%',
            minHeight: 360,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            textAlign: 'center',
            color: 'var(--muted)',
          }}>
        <span style={{
            fontSize: 12,
            fontWeight: 500,
          }}>Output will appear here upon submission</span>
      </div>
    );
  }

  return (
    <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            minHeight: 0,
            flex: 1,
            paddingLeft: 0,
          }}>
      {/* Output Top Header: Model Tag & Version Navigator */}
      <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 8,
            marginBottom: 8,
            flexShrink: 0,
          }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>
          <ThunderboltOutlined style={{
            color: 'var(--foreground)',
          }} />
          <span>{selectedModelName}</span>
        </div>

        {/* Version pagination (< 1/2 >) if multiple versions exist */}
        {outputVersions.length > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
            <button
              type="button"
              onClick={onPrevVersion}
              disabled={currentVersionIndex === 0}
              style={{
            padding: 4,
            cursor: 'pointer',
          }}
              title="Previous revision"
            >
              <LeftOutlined style={{
            fontSize: '10px',
          }} />
            </button>
            <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}>
              {currentVersionIndex + 1} / {outputVersions.length}
            </span>
            <button
              type="button"
              onClick={onNextVersion}
              disabled={currentVersionIndex === outputVersions.length - 1}
              style={{
            padding: 4,
            cursor: 'pointer',
          }}
              title="Next revision"
            >
              <RightOutlined style={{
            fontSize: '10px',
          }} />
            </button>
          </div>
        )}
      </div>

      {/* Output Title & Body or Full-Height Editing Area */}
      <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            paddingTop: 8,
            paddingBottom: 8,
          }}>
        {isEditingOutput ? (
          <textarea
            value={editableOutputText}
            onChange={(e) => onChangeEditableOutputText(e.target.value)}
            style={{
            width: '100%',
            height: '100%',
            minHeight: 380,
            flex: 1,
            background: 'var(--muted)',
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#a78bfa',
            outline: 'none',
            color: 'var(--foreground)',
            fontSize: 14,
            lineHeight: 1.625,
            fontFamily: 'var(--font-sans)',
            resize: 'none',
          }}
            autoFocus
            placeholder="Edit your response..."
          />
        ) : (
          <div>
            {parsed.title && (
              <h3 style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
            marginBottom: 16,
          }}>
                {parsed.title}
              </h3>
            )}
            <div style={{
            rowGap: 16,
            display: 'flex',
            flexDirection: 'column',
            fontSize: 14,
            lineHeight: 1.625,
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
          }}>
              {parsed.paragraphs.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Output Footer Action Buttons */}
      <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 16,
            marginTop: 'auto',
            flexShrink: 0,
            color: 'var(--muted-foreground)',
          }}>
        {/* Left Action Icons: Copy, Save as a note, Regenerate response, Read aloud, Like, Dislike, Share */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
          {/* 1. Copy */}
          <Tooltip title="Copy">
            <button
              type="button"
              onClick={onCopy}
              style={{
            padding: 6,
            color: 'var(--muted-foreground)',
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            >
              <CopyOutlined style={{
            fontSize: 16,
          }} />
            </button>
          </Tooltip>

          {/* 2. Save as a note */}
          <Tooltip title="Save as a note">
            <button
              type="button"
              onClick={onSaveToNote}
              style={{
            padding: 6,
            color: 'var(--muted-foreground)',
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            >
              <FileAddOutlined style={{
            fontSize: 16,
          }} />
            </button>
          </Tooltip>

          {/* 3. Regenerate response */}
          <Tooltip title="Regenerate response">
            <button
              type="button"
              onClick={onRegenerate}
              style={{
            padding: 6,
            color: 'var(--muted-foreground)',
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            >
              <ReloadOutlined style={{
            fontSize: 16,
          }} />
            </button>
          </Tooltip>

          {/* 4. Read aloud */}
          <Tooltip title={isPlayingAudio ? 'Stop speech' : 'Read aloud'}>
            <button
              type="button"
              onClick={onToggleSpeech}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                isPlayingAudio
                  ? 'text-violet-600 bg-violet-50 dark:bg-violet-950/60 animate-pulse'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <SoundOutlined style={{
            fontSize: 16,
          }} />
            </button>
          </Tooltip>

          {/* 5. Like */}
          <Tooltip title="Like">
            <button
              type="button"
              onClick={handleLike}
              className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                liked === true
                  ? 'text-blue-500 font-bold bg-blue-50/60 dark:bg-blue-950/40'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {liked === true ? <LikeFilled style={{
            fontSize: 16,
          }} /> : <LikeOutlined style={{
            fontSize: 16,
          }} />}
            </button>
          </Tooltip>

          {/* 6. Dislike */}
          <Tooltip title="Dislike">
            <button
              type="button"
              onClick={handleDislike}
              className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                liked === false
                  ? 'text-rose-500 font-bold bg-rose-50/60 dark:bg-rose-950/40'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {liked === false ? <DislikeFilled style={{
            fontSize: 16,
          }} /> : <DislikeOutlined style={{
            fontSize: 16,
          }} />}
            </button>
          </Tooltip>

          {/* 7. Share */}
          <Tooltip title="Share">
            <button
              type="button"
              onClick={handleShare}
              style={{
            padding: 6,
            color: 'var(--muted-foreground)',
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
            >
              <ShareAltOutlined style={{
            fontSize: 16,
          }} />
            </button>
          </Tooltip>
        </div>

        {/* Right Action: Edit Button */}
        {isEditingOutput ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <button
              type="button"
              onClick={onSaveEdit}
              style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
            background: '#7c3aed',
            color: '#ffffff',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
            >
              <CheckOutlined style={{
            fontSize: 12,
          }} />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            color: 'var(--muted-foreground)',
            borderRadius: 8,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
            >
              <CloseOutlined style={{
            fontSize: 12,
          }} />
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 12,
            background: '#faf5ff',
            color: '#6035f5',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 200ms ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
          >
            <EditOutlined style={{
            fontSize: 12,
          }} />
            <span>Edit</span>
          </button>
        )}
      </div>
    </div>
  );
};
