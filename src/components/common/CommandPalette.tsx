import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, List, Typography } from 'antd';
import type { Command } from '../../core/commands/CommandRegistry';

interface CommandPaletteProps {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ commands, open, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = query
    ? commands.filter((cmd) => {
        const lower = query.toLowerCase();
        return (
          cmd.name.toLowerCase().includes(lower) ||
          cmd.description.toLowerCase().includes(lower)
        );
      })
    : commands;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const executeSelected = useCallback(() => {
    if (filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered.length, selectedIndex, onClose, executeSelected]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
      destroyOnHidden
    >
      <Input
        autoFocus
        placeholder="Search commands…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedIndex(0);
        }}
        size="large"
        style={{ marginBottom: 12 }}
      />
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
          <Typography.Text type="secondary">
            No matching commands — try a different search term
          </Typography.Text>
        </div>
      ) : (
        <List
          dataSource={filtered}
          renderItem={(cmd, idx) => (
            <List.Item
              key={cmd.id}
              onClick={() => {
                cmd.action();
                onClose();
              }}
              style={{
                cursor: 'pointer',
                borderRadius: 6,
                padding: '8px 12px',
                backgroundColor: idx === selectedIndex ? 'var(--color-primary-bg, #e6f4ff)' : undefined,
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <List.Item.Meta
                title={<Typography.Text strong>{cmd.name}</Typography.Text>}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {cmd.description}
                  </Typography.Text>
                }
              />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {cmd.category}
              </Typography.Text>
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};
