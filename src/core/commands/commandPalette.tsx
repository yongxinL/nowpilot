import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Input, List } from 'antd';

export interface Command {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query],
  );

  const handleSelect = useCallback(
    (cmd: Command) => {
      cmd.action();
      setQuery('');
      onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selectedIndex, handleSelect]);

  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} width={560} styles={{ body: { padding: 0 } }}>
      <Input
        size="large"
        placeholder="Type a command..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedIndex(0);
        }}
        autoFocus
        variant="borderless"
        style={{ padding: '12px 16px' }}
      />
      <List
        dataSource={filtered}
        renderItem={(item, index) => (
          <List.Item
            onClick={() => handleSelect(item)}
            style={{
              cursor: 'pointer',
              padding: '8px 16px',
              background: index === selectedIndex ? 'var(--ant-color-bg-text-hover)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span>{item.label}</span>
              {item.shortcut && (
                <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>{item.shortcut}</span>
              )}
            </div>
          </List.Item>
        )}
      />
    </Modal>
  );
}
