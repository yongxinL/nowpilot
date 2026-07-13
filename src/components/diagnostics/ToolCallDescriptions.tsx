import { Descriptions, Tag } from 'antd';
import type { ToolTrace } from '../../core/telemetry/types';

export interface ToolCallDescriptionsProps {
  toolTraces: ToolTrace[];
}

const statusColorMap: Record<string, string> = {
  success: 'green',
  failed: 'red',
  timeout: 'orange',
  aborted: 'default',
  denied: 'red',
};

const permissionColorMap: Record<string, string> = {
  allowed: 'green',
  allowed_once: 'blue',
  allowed_always: 'blue',
  denied: 'red',
};

export function ToolCallDescriptions({ toolTraces }: ToolCallDescriptionsProps) {
  if (toolTraces.length === 0) return null;

  return (
    <Descriptions bordered column={1} size="small">
      {toolTraces.map((tt) => (
        <Descriptions.Item
          key={tt.id}
          label={
            <span>
              {tt.dangerous ? <Tag color="red">DANGEROUS</Tag> : null}
              <Tag>{tt.toolName}</Tag>
              <Tag color={permissionColorMap[tt.permissionDecision]}>
                {tt.permissionDecision}
              </Tag>
            </span>
          }
        >
          <span>
            <Tag color={statusColorMap[tt.status]}>{tt.status}</Tag>
            {tt.durationMs}ms
            {tt.source ? <Tag style={{ marginLeft: 4 }}>{tt.source}</Tag> : null}
            {tt.errorMessage ? (
              <span style={{ marginLeft: 8, color: '#ff4d4f' }}>— {tt.errorMessage}</span>
            ) : null}
          </span>
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}
