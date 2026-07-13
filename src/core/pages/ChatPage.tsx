import React, { useState } from 'react';
import { Bubble, Sender, Suggestion } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { Alert, Button, Drawer, Typography } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useChat } from '../../hooks/useChat';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { slashCommandRegistry } from '../../core/slash/SlashCommandRegistry';
import { ConversationSidebar } from '../../components/chat/ConversationSidebar';
import { ProviderSelector } from '../../components/chat/ProviderSelector';

const { Text } = Typography;

/**
 * ChatPage — the primary chat interface for both Full App and Side Panel.
 *
 * Surface adaptation (D-13):
 * - Full App (~800px+): Flex row with inline Conversations sidebar
 * - Side Panel (~400px): Messages + Sender only, Conversations in a Drawer
 */
export function ChatPage() {
  const {
    bubbleItems,
    send,
    abort,
    isStreaming,
    error,
    conversations,
    activeConversationId,
    switchConversation,
    deleteConversation,
    newConversation,
    draft,
    setDraft,
    activeProvider,
  } = useChat();

  const surface = useWorkspaceStore((s) => s.activeSurface);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isStandalone = surface === 'standalone';

  // Get slash commands for suggestions
  const slashItems = slashCommandRegistry.list().map((cmd) => ({
    label: cmd.label,
    value: cmd.name,
    description: cmd.description,
  }));

  // Determine if we're in empty state
  const isEmpty = bubbleItems.length === 0 && !isStreaming && !error;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
      {...(isEmpty ? { 'data-page-empty-state': 'chat' } : {})}
    >
      {/* Conversations sidebar — Full App inline, Side Panel in Drawer */}
      {isStandalone && (
        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderRight: '1px solid var(--ant-color-border-secondary)',
            overflow: 'auto',
          }}
        >
          <ConversationSidebar
            conversations={conversations}
            activeKey={activeConversationId}
            onSelect={switchConversation}
            onDelete={deleteConversation}
            onNew={newConversation}
          />
        </div>
      )}

      {/* Drawer for Side Panel conversation access */}
      {!isStandalone && (
        <>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}
          />
          <Drawer
            title="Conversations"
            placement="right"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            width={280}
          >
            <ConversationSidebar
              conversations={conversations}
              activeKey={activeConversationId}
              onSelect={(id) => {
                switchConversation(id);
                setDrawerOpen(false);
              }}
              onDelete={deleteConversation}
              onNew={() => {
                newConversation();
                setDrawerOpen(false);
              }}
            />
          </Drawer>
        </>
      )}

      {/* Messages + Composer column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* Provider selector bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '4px 12px',
            borderBottom: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          <ProviderSelector compact={!isStandalone} />
        </div>

        {/* Error state */}
        {error && (
          <div style={{ padding: '8px 16px' }}>
            <Alert
              type="error"
              message={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text>{error}</Text>
                  <Button size="small" onClick={() => send(draft || 'Retry')}>
                    Retry
                  </Button>
                </div>
              }
              showIcon
              closable
            />
          </div>
        )}

        {/* Messages list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          {isEmpty ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 8,
              }}
            >
              <Text type="secondary" style={{ fontSize: 16 }}>
                Start a conversation
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Type a message or use / for commands
              </Text>
            </div>
          ) : (
            <Bubble.List
              style={{ padding: '16px 0' }}
              items={bubbleItems}
              autoScroll
              role={{
                assistant: {
                  placement: 'start',
                  contentRender: (content) => {
                    // XMarkdown gets streaming state via Bubble.List's own item state.
                    // The `loading` property on items already maps to streaming state.
                    return (
                      <XMarkdown
                        content={typeof content === 'string' ? content : String(content)}
                        streaming={{
                          hasNextChunk: false, // Bubble.List manages its own streaming animation
                          enableAnimation: true,
                        }}
                        openLinksInNewTab={true}
                      />
                    );
                  },
                },
                user: {
                  placement: 'end',
                },
              }}
            />
          )}
        </div>

        {/* Sender (composer) */}
        <div style={{ padding: '8px 16px 16px', borderTop: isEmpty ? 'none' : '1px solid var(--ant-color-border-secondary)' }}>
          <Suggestion items={slashItems} onSelect={(val) => setDraft(draft + val + ' ')}>
            {({ onTrigger, onKeyDown }) => (
              <Sender
                value={draft}
                loading={isStreaming}
                onChange={(v) => {
                  setDraft(v);
                  if (v.endsWith('/')) onTrigger({});
                }}
                onKeyDown={onKeyDown}
                onSubmit={(msg) => send(msg)}
                onCancel={abort}
                placeholder="Ask anything... (type / for commands)"
                autoSize={{ minRows: 1, maxRows: 6 }}
              />
            )}
          </Suggestion>
        </div>
      </div>
    </div>
  );
}
