// src/components/cmdk/CmdKPicker.tsx — Flow 10 command palette (W-8, D-15):
// an antd Modal opened by mod+k (KEYMAP.CMD_K via isCmdK, 01-04) captured at
// the shell level, with a search Input over a static typed COMMANDS const
// array of EXACTLY three Phase-1 commands (no stub commands, no
// new-conversation). Enter runs the highlighted command; Escape closes; focus
// is trapped (FocusTrap 01-04) and restored on close. Commands are a typed
// const array — never free-form execution (T-1-20: static command list, routed
// through WorkspaceRouter 01-06, the ONLY surface-open path — Pitfall 1).
// 'Open Options' sets the standalone active page via navigateToPage (the
// StandaloneRouter action). Every error path logs CMDK_COMMAND and never
// throws (Golden Rule 9). Wrapped in ErrorBoundary.
import { useCallback, useEffect, useState } from 'react';
import { Input, Modal, Typography } from 'antd';
import { navigateToPage } from '@/components/standalone/standaloneNav';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { FocusTrap } from '@/core/components/FocusTrap';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { isCmdK } from '@/core/input/KeymapRegistry';
import { STR } from '@/core/i18n/strings';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';

interface CmdKCommand {
  id: 'open-standalone' | 'focus-side-panel' | 'open-options';
  label: string;
  run: () => void;
}

// W-8 command set — EXACTLY three commands whose targets exist in Phase 1
// (D-15: no stub commands, no new-conversation).
const COMMANDS: CmdKCommand[] = [
  {
    id: 'open-standalone',
    label: 'Open Standalone',
    run: () => {
      void WorkspaceRouter.openStandalone();
    },
  },
  {
    id: 'focus-side-panel',
    label: 'Focus Side Panel',
    run: () => {
      void WorkspaceRouter.openSidePanel();
    },
  },
  {
    id: 'open-options',
    label: 'Open Options',
    run: () => {
      void WorkspaceRouter.openStandalone();
      navigateToPage('options');
    },
  },
];

export function CmdKPicker() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const close = useCallback((): void => {
    setOpen(false);
    setQuery('');
    setHighlighted(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isCmdK(event)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const runCommand = (cmd: CmdKCommand): void => {
    close();
    try {
      cmd.run();
    } catch (err) {
      debugLog(ERROR_CODES.CMDK_COMMAND, 'command run failed', {
        error: err instanceof Error ? err : undefined,
        module: 'CmdKPicker',
        extra: { commandId: cmd.id },
      });
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      const target = filtered[highlighted];
      if (target !== undefined) {
        event.preventDefault();
        runCommand(target);
      }
    }
  };

  return (
    <ErrorBoundary>
      {/* Conditionally mounted (not a persistent `open` toggle) so closing
          unmounts the palette deterministically — rc-motion leave animations
          never complete in jsdom, which would strand the closed palette in the
          DOM during tests. Open appears with the antd motion; close is
          instant, which is fine for a command palette. */}
      {open && (
        <Modal open onCancel={close} footer={null} closable={false} keyboard={false} width={420}>
          <FocusTrap onEscape={close} autoFocus>
            <Input
              placeholder={STR.cmdk.placeholder}
              value={query}
              allowClear
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleInputKeyDown}
            />
            <div role="listbox" aria-label="Commands">
              {filtered.map((cmd, index) => (
                <Typography.Text
                  key={cmd.id}
                  role="option"
                  aria-selected={index === highlighted}
                  onClick={() => runCommand(cmd)}
                  onMouseEnter={() => setHighlighted(index)}
                  style={{ display: 'block', padding: '8px 4px', cursor: 'pointer' }}
                  strong={index === highlighted}
                >
                  {cmd.label}
                </Typography.Text>
              ))}
              {filtered.length === 0 && (
                <Typography.Text type="secondary">No matching commands</Typography.Text>
              )}
            </div>
          </FocusTrap>
        </Modal>
      )}
    </ErrorBoundary>
  );
}
