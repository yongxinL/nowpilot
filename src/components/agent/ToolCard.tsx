import React from 'react';
import { Tag, Typography } from 'antd';

const { Text, Paragraph } = Typography;

export interface ToolCardProps {
  toolName: string;
  status: 'loading' | 'success' | 'error' | 'abort';
  permissionBadge?: 'allowed' | 'denied' | 'always';
  duration?: number;
  input?: unknown;
  result?: { success: boolean; output?: unknown; error?: string };
}

/**
 * Expandable card rendered inside ThoughtChain content for tool call steps.
 * Shows: tool name header, permission badge, duration, input preview, result summary.
 */
export function ToolCard({
  toolName,
  status,
  permissionBadge,
  duration,
  input,
  result,
}: ToolCardProps) {
  const statusColor =
    status === 'success' ? 'green' :
    status === 'error' ? 'red' :
    status === 'abort' ? 'orange' : 'blue';

  const permissionColor =
    permissionBadge === 'allowed' ? 'green' :
    permissionBadge === 'denied' ? 'red' :
    permissionBadge === 'always' ? 'blue' : undefined;

  const permissionLabel =
    permissionBadge === 'allowed' ? 'Allowed' :
    permissionBadge === 'denied' ? 'Denied' :
    permissionBadge === 'always' ? 'Always' : undefined;

  // Truncate JSON preview to 200 chars
  const formatPreview = (data: unknown): string => {
    if (data === undefined) return '';
    try {
      const str = JSON.stringify(data, null, 2);
      return str.length > 200 ? str.slice(0, 200) + '...' : str;
    } catch {
      return String(data).slice(0, 200);
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header row: tool name + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>{toolName}</Text>
        <Tag color={statusColor}>{status}</Tag>
        {permissionLabel && (
          <Tag color={permissionColor}>{permissionLabel}</Tag>
        )}
        {duration !== undefined && (
          <Text type="secondary" style={{ fontSize: 11 }}>{duration}ms</Text>
        )}
      </div>

      {/* Input preview */}
      {input !== undefined && (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
            Input:
          </Text>
          <Paragraph
            code
            style={{ fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {formatPreview(input)}
          </Paragraph>
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
            {result.success ? 'Result:' : 'Error:'}
          </Text>
          <Paragraph
            code
            style={{
              fontSize: 11,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: result.success ? undefined : '#ff4d4f',
            }}
          >
            {result.success
              ? formatPreview(result.output)
              : result.error ?? 'Unknown error'}
          </Paragraph>
        </div>
      )}
    </div>
  );
}
