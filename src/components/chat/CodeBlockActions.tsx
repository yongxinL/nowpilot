import { useState, useCallback, type CSSProperties } from 'react';
import { Button, Tooltip, message } from 'antd';
import { CopyOutlined, CheckOutlined, ImportOutlined, SaveOutlined } from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeBlockActionsProps {
  code: string;
  language?: string;
  onInsert?: (code: string) => void;
  onSaveAsMacro?: (code: string) => void;
  /** Whether an editable textarea is detected on the current page */
  canInsert?: boolean;
}

/**
 * CodeBlockActions — inline action buttons on code fences per RICH-H-04.
 *
 * Renders a wrapper around the code block with action buttons appearing on hover:
 * - Copy (clipboard → checkmark for 2s)
 * - Insert into page (disabled with tooltip when no ServiceNow textarea)
 * - Save as macro
 */
export function CodeBlockActions({
  code,
  language,
  onInsert,
  onSaveAsMacro,
  canInsert = false,
}: CodeBlockActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      message.success('Code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('Failed to copy code');
    }
  }, [code]);

  const wrapperStyle: CSSProperties = {
    position: 'relative',
  };

  const actionsStyle: CSSProperties = {
    position: 'absolute',
    top: 4,
    right: 4,
    display: 'flex',
    gap: 4,
    zIndex: 10,
  };

  const preStyle: CSSProperties = {
    margin: 0,
  };

  return (
    <div style={wrapperStyle}>
      <pre style={preStyle}>
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
      <div style={actionsStyle}>
        <Tooltip title={copied ? 'Copied' : 'Copy'}>
          <Button
            type="text"
            size="small"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy'}
          />
        </Tooltip>
        <Tooltip title={canInsert ? 'Insert into page' : 'No editable text area detected on the current page'}>
          <Button
            type="text"
            size="small"
            icon={<ImportOutlined />}
            disabled={!canInsert}
            onClick={() => onInsert?.(code)}
            title="Insert into page"
          />
        </Tooltip>
        <Tooltip title="Save as macro">
          <Button
            type="text"
            size="small"
            icon={<SaveOutlined />}
            onClick={() => onSaveAsMacro?.(code)}
            title="Save as macro"
          />
        </Tooltip>
      </div>
    </div>
  );
}
