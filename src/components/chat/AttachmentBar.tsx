import React from 'react';
import { CloseOutlined, PictureOutlined, ScissorOutlined, GlobalOutlined } from '@ant-design/icons';
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
    <div className="flex flex-col gap-1.5 mb-2 w-full">
      {attachments.map((att) => {
        if (att.type === 'quote') {
          return (
            <div
              key={att.id}
              className="self-end max-w-[90%] border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 rounded-2xl px-3.5 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 shadow-2xs flex items-center justify-between gap-2"
            >
              <span className="truncate" title={att.content || att.title}>
                {att.content || att.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer shrink-0 ml-1"
                title="Remove quote"
              >
                <CloseOutlined className="text-[10px]" />
              </button>
            </div>
          );
        }

        if (att.type === 'image' || att.type === 'screen_cut') {
          return (
            <div
              key={att.id}
              className="inline-flex items-center gap-2 p-1.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs self-start"
            >
              {att.thumbnail ? (
                <img src={att.thumbnail} alt="Attachment" className="w-9 h-9 object-cover rounded-lg" />
              ) : (
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center rounded-lg">
                  {att.type === 'screen_cut' ? <ScissorOutlined /> : <PictureOutlined />}
                </div>
              )}
              <span className="max-w-[130px] truncate text-zinc-700 dark:text-zinc-200 font-medium text-xs">
                {att.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
                title="Remove image"
              >
                <CloseOutlined className="text-[10px]" />
              </button>
            </div>
          );
        }

        return (
          <div
            key={att.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs self-start"
          >
            <GlobalOutlined className="text-blue-500" />
            <span className="max-w-[180px] truncate text-zinc-700 dark:text-zinc-300 font-medium">{att.title}</span>
            <button
              type="button"
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
