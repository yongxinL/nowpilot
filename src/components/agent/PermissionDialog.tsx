import React, { useEffect, useRef } from 'react';
import { Modal, Typography } from 'antd';
import { App } from 'antd';

const { Text, Paragraph } = Typography;

export interface PermissionDialogProps {
  pendingPermission: { toolName: string; toolInput: unknown } | null;
  onResolve: (decision: 'allow-once' | 'allow-always' | 'deny') => void;
}

/**
 * Renders an AntD Modal.confirm when a tool permission is pending (D-05).
 * Shows the tool name and input preview with three buttons:
 * - Allow Once (primary)
 * - Allow Always (default)
 * - Deny (danger)
 *
 * Auto-closes when pendingPermission goes from non-null to null.
 */
export function PermissionDialog({ pendingPermission, onResolve }: PermissionDialogProps) {
  const app = App.useApp();
  const modalRef = useReturnedModalRef();
  const prevPermission = useRef(pendingPermission);

  useEffect(() => {
    // Open modal when pendingPermission becomes non-null
    if (pendingPermission && !prevPermission.current) {
      const inputPreview = (() => {
        try {
          const str = JSON.stringify(pendingPermission.toolInput, null, 2);
          return str.length > 200 ? str.slice(0, 200) + '...' : str;
        } catch {
          return String(pendingPermission.toolInput).slice(0, 200);
        }
      })();

      const instance = app.modal.confirm({
        title: 'Tool Permission Required',
        content: (
          <div>
            <Paragraph>
              The agent wants to use <Text strong>{pendingPermission.toolName}</Text>
            </Paragraph>
            {pendingPermission.toolInput !== undefined && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Input:</Text>
                <Paragraph
                  code
                  style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                  {inputPreview}
                </Paragraph>
              </div>
            )}
          </div>
        ),
        icon: null,
        footer: null,
        closable: false,
        mask: { closable: false },
        okText: null,
        cancelText: null,
      });

      // Store the destroy function for auto-close
      modalRef.setDestroy(instance.destroy);
    }

    // Auto-close when permission resolves (pendingPermission goes null)
    if (!pendingPermission && prevPermission.current) {
      modalRef.destroy();
    }

    prevPermission.current = pendingPermission;
  }, [pendingPermission, onResolve, app.modal, modalRef]);

  // Handle auto-close on unmount
  useEffect(() => {
    return () => {
      modalRef.destroy();
    };
  }, [modalRef]);

  // Return functional buttons as a separate rendered element
  // (inline with the modal, not as footer)
  if (!pendingPermission) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
        marginTop: 16,
      }}
      data-permission-dialog="true"
    >
      <button
        type="button"
        onClick={() => onResolve('allow-once')}
        style={{
          padding: '6px 16px',
          background: '#1677ff',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Allow Once
      </button>
      <button
        type="button"
        onClick={() => onResolve('allow-always')}
        style={{
          padding: '6px 16px',
          background: '#fff',
          color: '#1677ff',
          border: '1px solid #1677ff',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Allow Always
      </button>
      <button
        type="button"
        onClick={() => onResolve('deny')}
        style={{
          padding: '6px 16px',
          background: '#fff',
          color: '#ff4d4f',
          border: '1px solid #ff4d4f',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Deny
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: manage modal destroy instance via ref
// ---------------------------------------------------------------------------

function useReturnedModalRef() {
  const destroyRef = useRef<() => void>(() => {});

  return {
    setDestroy: (fn: () => void) => {
      destroyRef.current = fn;
    },
    destroy: () => {
      destroyRef.current();
    },
  };
}
