import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, List, Modal, Typography, theme } from 'antd';
import type { Command } from '../../core/commands/CommandRegistry';
import { t } from '../../core/i18n/strings';

interface CommandPaletteProps {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}

/**
 * The result region's held height, in px. The populated list, the zero-result
 * state and the scrollable overflow state all occupy it, so the modal never
 * jumps when the query changes what is rendered.
 */
export const COMMAND_LIST_MIN_HEIGHT = 240;

/** The list scrolls inside the modal body past this height; the input stays pinned. */
const COMMAND_LIST_MAX_HEIGHT = 320;

/** The 12 px typography floor: nothing in the palette renders smaller. */
const LABEL_FLOOR_PX = 12;

/**
 * Flow 10 / FLOW-8 / SP-09 / SA-09 — the palette renders whatever
 * `CommandRegistry` holds, so a later phase adds commands (and categories)
 * without a palette change.
 *
 * Token discipline: every colour, radius and size resolves from
 * `theme.useToken()`; no literal colour and no CSS-variable fallback string
 * survives here. Every palette-owned string resolves through `t()`.
 *
 * The destructive command is never auto-run — not on a partial match and not
 * on an exact one. Selecting it opens the pinned confirmation
 * (`command.reloadExtension.confirm` with `common.continue` / `common.notNow`)
 * and only the confirmation invokes its action (D-10, T-1-37).
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ commands, open, onClose }) => {
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingCommand, setPendingCommand] = useState<Command | null>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (query === '') return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      // The query is transient: it is never persisted and never survives a close.
      setQuery('');
      setSelectedIndex(0);
      setPendingCommand(null);
    }
  }, [open]);

  // A narrowing query must never leave the selection out of range.
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Overflow: the selected row stays scrolled into view as the selection moves.
  useEffect(() => {
    const row = selectedRowRef.current;
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filtered.length]);

  const runCommand = useCallback(
    (cmd: Command) => {
      if (cmd.destructive) {
        setPendingCommand(cmd);
        return;
      }
      cmd.action();
      onClose();
    },
    [onClose],
  );

  const executeSelected = useCallback(() => {
    const cmd = filtered[selectedIndex];
    if (cmd) runCommand(cmd);
  }, [filtered, selectedIndex, runCommand]);

  // Intra-overlay keyboard handling — Escape closes, arrows move the
  // selection, Enter runs it. This is not the global binding: the global
  // `Cmd+K` lives in `KeymapRegistry` (FLOW-8).
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

  const confirmPendingCommand = () => {
    const cmd = pendingCommand;
    setPendingCommand(null);
    if (cmd) {
      cmd.action();
      onClose();
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        width={560}
        centered
        destroyOnHidden
        closable={{ 'aria-label': t('a11y.closeDialog') }}
      >
        <Input
          autoFocus
          placeholder={t('commands.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          size="large"
          style={{ marginBottom: 12 }}
        />
        <div
          data-testid="command-list-region"
          style={{
            minHeight: COMMAND_LIST_MIN_HEIGHT,
            maxHeight: COMMAND_LIST_MAX_HEIGHT,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Typography.Text type="secondary" style={{ fontSize: LABEL_FLOOR_PX }}>
                {t('commands.noResults')}
              </Typography.Text>
            </div>
          ) : (
            <List
              dataSource={filtered}
              renderItem={(cmd, idx) => {
                const selected = idx === selectedIndex;
                return (
                  <List.Item
                    key={cmd.id}
                    ref={(node: HTMLDivElement | null) => {
                      if (selected) selectedRowRef.current = node;
                    }}
                    onClick={() => runCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: token.borderRadius,
                      padding: '8px 12px',
                      backgroundColor: selected ? token.colorPrimaryBg : undefined,
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <Typography.Text
                          strong
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: cmd.destructive ? token.colorError : undefined,
                          }}
                        >
                          {cmd.name}
                        </Typography.Text>
                      }
                      description={
                        <Typography.Text
                          type="secondary"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontSize: LABEL_FLOOR_PX,
                          }}
                        >
                          {cmd.description}
                        </Typography.Text>
                      }
                    />
                    <Typography.Text
                      style={{ fontSize: LABEL_FLOOR_PX, color: token.colorTextTertiary }}
                    >
                      {t(`commands.category.${cmd.category}`)}
                    </Typography.Text>
                  </List.Item>
                );
              }}
            />
          )}
        </div>
      </Modal>
      <Modal
        open={pendingCommand !== null}
        title={pendingCommand?.name}
        okText={t('common.continue')}
        cancelText={t('common.notNow')}
        okButtonProps={{ danger: true }}
        onOk={confirmPendingCommand}
        onCancel={() => setPendingCommand(null)}
        centered
        closable={{ 'aria-label': t('a11y.closeDialog') }}
      >
        {t('command.reloadExtension.confirm')}
      </Modal>
    </>
  );
};
