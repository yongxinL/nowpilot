import React from 'react';
import { CloseOutlined, FileTextOutlined, PictureOutlined, ScissorOutlined, GlobalOutlined } from '@ant-design/icons';
import { Attachment } from '../../types';

interface AttachmentBarProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export const AttachmentBar: React.FC<AttachmentBarProps> = ({
  attachments,
  onRemove,
}) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700/80 mb-2">
      {attachments.map(att => {
        if (att.type === 'quote') {
          return (
            <div
              key={att.id}
              className="relative p-2.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs text-xs"
            >
              <div className="flex items-center justify-between text-zinc-400 font-medium mb-1">
                <span className="flex items-center gap-1">
                  <FileTextOutlined /> Quote text
                </span>
                <button
                  onClick={() => onRemove(att.id)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <CloseOutlined className="text-[11px]" />
                </button>
              </div>
              <div className="text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-snug">
                {att.content || att.title}
              </div>
            </div>
          );
        }

        if (att.type === 'image' || att.type === 'screen_cut') {
          return (
            <div
              key={att.id}
              className="inline-flex items-center gap-2 p-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 text-xs self-start"
            >
              {att.thumbnail ? (
                <img src={att.thumbnail} alt="Attachment" className="w-10 h-10 object-cover rounded" />
              ) : (
                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/40 text-violet-600 flex items-center justify-center rounded">
                  {att.type === 'screen_cut' ? <ScissorOutlined /> : <PictureOutlined />}
                </div>
              )}
              <span className="max-w-[140px] truncate text-zinc-700 dark:text-zinc-300 font-medium">{att.title}</span>
              <button
                onClick={() => onRemove(att.id)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
              >
                <CloseOutlined className="text-[10px]" />
              </button>
            </div>
          );
        }

        return (
          <div
            key={att.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 text-xs self-start"
          >
            <GlobalOutlined className="text-violet-500" />
            <span className="max-w-[180px] truncate text-zinc-700 dark:text-zinc-300 font-medium">{att.title}</span>
            <button
              onClick={() => onRemove(att.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer ml-1"
            >
              <CloseOutlined className="text-[10px]" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
