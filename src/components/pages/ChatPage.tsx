// src/components/pages/ChatPage.tsx — §18 canonical page (W-6 flat name; shared
// by the Side Panel shell and the Standalone shell). Phase-3 minimal functional
// streaming chat (D-01, UI-SPEC §17.5): Ant Design X Bubble/Bubble.List +
// Sender with the 5-state stream machine (idle/streaming/completed/failed/
// offline). Streamed text renders as PLAIN TEXT in the Bubble (no markdown/HTML
// until Phase 7's DOMPurify pipeline — T-03-08-02, no HTML-string injection
// into the DOM); text grows via ChunkBuffer rAF flush (NEVER a spinner, never
// motion-driven reveals §12.6). Assistant identity is always 'NowPilot' (name
// overrides are prompt-side only — the identity header UI is fenced to Phase 7,
// D-03). RICH fencing (D-03): the Phase-3 conversation surface ships ONLY
// Bubble/Bubble.List + Sender — no RICH-layer elements (the 03-CONTEXT D-03
// fence list is grep-asserted absent in the test suite). Wrapped in
// ErrorBoundary (01-04). No chrome API calls (Pitfall 4) — the streaming hook
// (useStreamingLLM) owns the send path (Golden Rule 3: contextHelper, never
// React-side prompt assembly).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bubble, Sender } from '@ant-design/x';
import { SendOutlined } from '@ant-design/icons';
import { Button, Tooltip, Typography, theme } from 'antd';

import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { STR } from '@/core/i18n/strings';
import { createOperationId } from '@/core/runtime/OperationId';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { useStreamingLLM } from '@/components/pages/useStreamingLLM';
import type { ChatStreamState } from '@/components/pages/useStreamingLLM';

/** One conversation bubble (in-memory per surface — no persistence, D-03). */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'streaming' | 'completed' | 'failed' | 'offline';
}

/**
 * UI-SPEC error row: the failed bubble renders the "Provider error." prefix of
 * STR.chat.errorRetry + a Retry action (STR.chat.retry). The canonical
 * errorRetry string stays UNTOUCHED (Golden Rule 2) — the [Retry]/[Switch
 * Provider] tokens are actions/Phase-7, never rendered as text.
 */
const FAILED_PREFIX = STR.chat.errorRetry.split(' [')[0];

export function ChatPage() {
  const { state, text, send, retry } = useStreamingLLM();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { token } = theme.useToken();
  const mode = useThemeStore((s) => s.mode);
  const isStreaming = state.state === 'streaming';

  // User bubble fill: colorPrimaryBg light / colorPrimary @18% dark (UI-SPEC).
  const userFill = mode === 'dark' ? `${token.colorPrimary}2E` : token.colorPrimaryBg;

  const handleSend = useCallback(
    (userInput: string) => {
      const trimmed = userInput.trim();
      if (!trimmed || isStreaming) return; // one stream per session §17.5
      setDraft('');
      setMessages((prev) => [
        ...prev,
        { id: createOperationId(), role: 'user', content: trimmed, status: 'completed' },
        // Assistant bubble appended IMMEDIATELY (streaming caret), text grows via
        // ChunkBuffer flush — never a spinner (§12.6).
        { id: createOperationId(), role: 'assistant', content: '', status: 'streaming' },
      ]);
      void send(trimmed);
    },
    [isStreaming, send],
  );

  /**
   * Retry re-sends the LAST user input through the same runAgentTurn path with
   * a NEW operationId (the hook's retry) — the failed bubble's partial text is
   * replaced by the new attempt's stream (UI-SPEC Retry semantics).
   */
  const handleRetry = useCallback(() => {
    if (isStreaming) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), { ...last, content: '', status: 'streaming' }];
    });
    retry();
  }, [isStreaming, retry]);

  // Drive the live assistant bubble from the hook's ChunkBuffer text + state
  // machine: streaming caret → growing text; completed → final text; failed →
  // partial text retained; offline → partial text retained + muted notice.
  useEffect(() => {
    if (state.state === 'idle') return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      const status =
        state.state === 'completed'
          ? 'completed'
          : state.state === 'failed'
            ? 'failed'
            : state.state === 'offline'
              ? 'offline'
              : 'streaming';
      return [...prev.slice(0, -1), { ...last, content: text, status }];
    });
  }, [state, text]);

  const items = useMemo(
    () =>
      messages.map((m) => ({
        key: m.id,
        role: m.role,
        content: m.content,
        streaming: m.status === 'streaming',
        // Streaming caret (UI-SPEC: colorPrimary @60%) — a static indicator
        // appended to the growing text; NEVER a spinner, never motion-driven
        // reveals (§12.6 — ChunkBuffer rAF is the only text animation).
        ...(m.status === 'streaming'
          ? {
              contentRender: (content: React.ReactNode) => (
                <>
                  {content}
                  <span
                    aria-hidden
                    style={{ color: token.colorPrimary, opacity: 0.6 }}
                  >
                    |
                  </span>
                </>
              ),
            }
          : {}),
        footer:
          m.status === 'failed' || m.status === 'offline' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {m.status === 'failed' && (
                <Typography.Text type="danger" style={{ fontSize: 12 }}>
                  {FAILED_PREFIX}
                </Typography.Text>
              )}
              <Button type="link" size="small" style={{ color: token.colorPrimary, padding: 0 }} onClick={handleRetry}>
                {STR.chat.retry}
              </Button>
            </span>
          ) : undefined,
      })),
    [handleRetry, messages, token.colorPrimary],
  );

  const isEmpty = messages.length === 0;

  return (
    <ErrorBoundary>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 8,
        }}
      >
        <div
          role="log"
          aria-live="polite"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowAnchor: 'none',
          }}
        >
          {isEmpty ? (
            // idle (empty): centered muted one-liner (UI-SPEC E1 empty row)
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography.Text type="secondary">{STR.chat.empty}</Typography.Text>
            </div>
          ) : (
            <Bubble.List
              role={{
                user: {
                  placement: 'end',
                  variant: 'filled',
                  style: { background: userFill, borderRadius: 12 },
                },
                assistant: {
                  placement: 'start',
                  variant: 'filled',
                  header: 'NowPilot',
                  style: {
                    background: token.colorBgContainer,
                    border: `1px solid ${token.colorBorder}`,
                    borderRadius: 12,
                  },
                },
              }}
              items={items}
              autoScroll
            />
          )}
        </div>
        {state.state === 'offline' && (
          // offline: muted 12px notice above the Sender (UI-SPEC offline row)
          <Typography.Text
            type="secondary"
            style={{ fontSize: 12, paddingInline: 4 }}
          >
            {STR.chat.offline}
          </Typography.Text>
        )}
        <Sender
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
          placeholder={STR.chat.askPlaceholder}
          disabled={isStreaming}
          suffix={(actionNode, { components: { SendButton } }) => (
            <Tooltip title={STR.chat.send}>
              <SendButton
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                aria-label={STR.chat.send}
              />
            </Tooltip>
          )}
        />
      </div>
    </ErrorBoundary>
  );
}

// Export the state type for tests/consumers (the 5-state machine contract).
export type { ChatStreamState };
