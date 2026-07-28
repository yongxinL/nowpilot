import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, List, Typography, Empty } from 'antd';
import type { Command } from '../../core/commands/CommandRegistry';
import { t } from '../../core/i18n/strings';

const { Text } = Typography;

export interface CommandPaletteProps {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  open,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = commands.filter((cmd) => {
    if (query === '') return true;
    const lower = query.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower)
    );
  });

  const executeSelected = useCallback(() => {
    if (filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (filtered.length > 0) {
            e.preventDefault();
            executeSelected();
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered.length, executeSelected, onClose]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  const handleItemClick = (cmd: Command) => {
    cmd.action();
    onClose();
  };

  return (
    <Modal
      open={open}
      footer={null}
      closable
      onCancel={onClose}
      width={560}
      centered
      destroyOnHidden
    >
      <div style={{ padding: '8px 0' }}>
        <Input
          autoFocus
          size="large"
          placeholder={t('commands.placeholder')}
          value={query}
          onChange={handleQueryChange}
          style={{ marginBottom: 8 }}
        />
        {filtered.length > 0 ? (
          <List
            dataSource={filtered}
            renderItem={(cmd, i) => (
              <List.Item
                key={cmd.id}
                onClick={() => handleItemClick(cmd)}
                style={{
                  background:
                    i === selectedIndex
                      ? 'var(--ant-color-primary-bg)'
                      : undefined,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 4,
                }}
              >
                <div style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text strong>{cmd.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {cmd.category}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {cmd.description}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty
            description={t('commands.noResults')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </Modal>
  );
};
