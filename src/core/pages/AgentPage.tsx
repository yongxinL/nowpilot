import React, { useState, useCallback } from 'react';
import { Sender } from '@ant-design/x';
import { Alert } from 'antd';
import { useAgent } from '../../hooks/useAgent';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ThoughtChainView } from '../../components/agent/ThoughtChainView';
import { PermissionDialog } from '../../components/agent/PermissionDialog';

/**
 * Agent page — zero-argument component rendered by the shell.
 * Uses useAgent() hook for all state and streaming management.
 * Renders ThoughtChain + PermissionDialog + Sender.
 * Surface-adaptive layout via useWorkspace().
 */
export function AgentPage() {
  const {
    steps,
    send,
    abort,
    isStreaming,
    error,
    pendingPermission,
    resolvePermission,
  } = useAgent();

  const { activeSurface } = useWorkspace();
  const [draft, setDraft] = useState('');

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setDraft('');
      await send(text.trim());
    },
    [send],
  );

  const handleCancel = useCallback(() => {
    abort();
  }, [abort]);

  // Surface-adaptive styles
  const isSidePanel = activeSurface === 'sidepanel';
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  };

  const thoughtChainStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: isSidePanel ? '4px' : '8px 16px',
  };

  const senderStyle: React.CSSProperties = {
    borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
    padding: isSidePanel ? '4px' : '8px 16px',
    background: 'var(--ant-color-bg-container, #fff)',
  };

  return (
    <div style={containerStyle} data-page-empty-state="agent">
      {/* Error display (D-20) */}
      {error && !isStreaming && (
        <div style={{ padding: '8px 16px 0' }}>
          <Alert
            title="Error"
            description={error}
            type="error"
            showIcon
            closable
            action={
              <button
                onClick={() => setDraft('')}
                style={{
                  background: 'none',
                  border: '1px solid #ff4d4f',
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#ff4d4f',
                }}
              >
                Retry
              </button>
            }
          />
        </div>
      )}

      {/* ThoughtChain area */}
      <div style={thoughtChainStyle}>
        <ThoughtChainView steps={steps} />
      </div>

      {/* Permission dialog */}
      <PermissionDialog
        pendingPermission={pendingPermission}
        onResolve={resolvePermission}
      />

      {/* Sender */}
      <div style={senderStyle}>
        <Sender
          value={draft}
          onChange={(val) => setDraft(val ?? '')}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={isStreaming}
          placeholder="Describe what you want to accomplish..."
          autoSize={{ minRows: 1, maxRows: 6 }}
        />
      </div>
    </div>
  );
}
