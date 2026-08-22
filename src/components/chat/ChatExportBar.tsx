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
      style={{
        padding: 12,
        borderRadius: 16,
        boxShadow: token.boxShadowSecondary,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onToggleSelectAll(e.target.checked)}
            style={{ width: 16, height: 16, borderRadius: 4, cursor: 'pointer' }}
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
