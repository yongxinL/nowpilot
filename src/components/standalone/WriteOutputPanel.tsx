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
      <div className="h-full min-h-[360px] flex items-center justify-center p-8 text-center text-zinc-300 dark:text-zinc-700">
        <span className="text-xs font-medium">Output will appear here upon submission</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-full min-h-[420px] flex-1 min-h-0 pl-0 lg:pl-2">
      {/* Output Top Header: Model Tag & Version Navigator */}
      <div className="flex items-center justify-between pb-2 mb-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
          <ThunderboltOutlined className="text-zinc-900 dark:text-zinc-100" />
          <span>{selectedModelName}</span>
        </div>

        {/* Version pagination (< 1/2 >) if multiple versions exist */}
        {outputVersions.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <button
              type="button"
              onClick={onPrevVersion}
              disabled={currentVersionIndex === 0}
              className="p-1 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Previous revision"
            >
              <LeftOutlined className="text-[10px]" />
            </button>
            <span className="font-mono text-xs">
              {currentVersionIndex + 1} / {outputVersions.length}
            </span>
            <button
              type="button"
              onClick={onNextVersion}
              disabled={currentVersionIndex === outputVersions.length - 1}
              className="p-1 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Next revision"
            >
              <RightOutlined className="text-[10px]" />
            </button>
          </div>
        )}
      </div>

      {/* Output Title & Body or Full-Height Editing Area */}
      <div className="flex-1 flex flex-col min-h-0 py-2">
        {isEditingOutput ? (
          <textarea
            value={editableOutputText}
            onChange={(e) => onChangeEditableOutputText(e.target.value)}
            className="w-full h-full min-h-[380px] flex-1 bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-violet-400 focus:ring-2 focus:ring-violet-500/20 outline-none text-zinc-800 dark:text-zinc-100 text-sm leading-relaxed font-sans resize-none"
            autoFocus
            placeholder="Edit your response..."
          />
        ) : (
          <div>
            {parsed.title && (
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
                {parsed.title}
              </h3>
            )}
            <div className="space-y-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 font-sans">
              {parsed.paragraphs.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Output Footer Action Buttons */}
      <div className="flex items-center justify-between pt-4 mt-auto shrink-0 text-zinc-400">
        {/* Left Action Icons: Copy, Save as a note, Regenerate response, Read aloud, Like, Dislike, Share */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 1. Copy */}
          <Tooltip title="Copy">
            <button
              type="button"
              onClick={onCopy}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              <CopyOutlined className="text-base" />
            </button>
          </Tooltip>

          {/* 2. Save as a note */}
          <Tooltip title="Save as a note">
            <button
              type="button"
              onClick={onSaveToNote}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              <FileAddOutlined className="text-base" />
            </button>
          </Tooltip>

          {/* 3. Regenerate response */}
          <Tooltip title="Regenerate response">
            <button
              type="button"
              onClick={onRegenerate}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              <ReloadOutlined className="text-base" />
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
              <SoundOutlined className="text-base" />
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
              {liked === true ? <LikeFilled className="text-base" /> : <LikeOutlined className="text-base" />}
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
              {liked === false ? <DislikeFilled className="text-base" /> : <DislikeOutlined className="text-base" />}
            </button>
          </Tooltip>

          {/* 7. Share */}
          <Tooltip title="Share">
            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              <ShareAltOutlined className="text-base" />
            </button>
          </Tooltip>
        </div>

        {/* Right Action: Edit Button */}
        {isEditingOutput ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSaveEdit}
              className="flex items-center gap-1 px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
            >
              <CheckOutlined className="text-xs" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg text-xs cursor-pointer transition-colors"
            >
              <CloseOutlined className="text-xs" />
              <span>Cancel</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-[#6035f5] dark:text-purple-300 text-xs font-medium cursor-pointer transition-all shadow-2xs"
          >
            <EditOutlined className="text-xs" />
            <span>Edit</span>
          </button>
        )}
      </div>
    </div>
  );
};
