import React from 'react';
import { Button, Dropdown, theme } from 'antd';
import { CloseOutlined, DownOutlined } from '@ant-design/icons';
import { ChatSession } from '../../types';

interface ChatExportBarProps {
  activeSession: ChatSession | null;
  exportSelectedMsgIds: string[];
  onToggleSelectAll: (selectAll: boolean) => void;
  onExitExport: () => void;
  onPerformExport: (format: 'txt' | 'json') => void;
}

export const ChatExportBar: React.FC<ChatExportBarProps> = ({
  activeSession,
  exportSelectedMsgIds,
  onToggleSelectAll,
  onExitExport,
  onPerformExport,
}) => {
  const { token } = theme.useToken();

  const isAllSelected =
    !!activeSession &&
    activeSession.messages.length > 0 &&
    activeSession.messages.every((m) => exportSelectedMsgIds.includes(m.id));

  return (
    <div
      className="p-3 rounded-2xl shadow-lg flex flex-col gap-2.5"
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onToggleSelectAll(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span>Select all</span>
        </label>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onExitExport}
          title="Exit export mode"
        />
      </div>

      <Dropdown
        menu={{
          items: [
            {
              key: 'txt',
              label: 'Export as TXT',
              onClick: () => onPerformExport('txt'),
            },
            {
              key: 'json',
              label: 'Export as JSON',
              onClick: () => onPerformExport('json'),
            },
          ],
        }}
        trigger={['click']}
        placement="top"
      >
        <Button block icon={<DownOutlined />}>
          Export as
        </Button>
      </Dropdown>
    </div>
  );
};
