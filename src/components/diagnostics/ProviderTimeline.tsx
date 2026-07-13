import { Timeline, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ProviderTrace } from '../../core/telemetry/types';

export interface ProviderTimelineProps {
  providerTraces: ProviderTrace[];
}

const outcomeColorMap: Record<string, string> = {
  success: 'green',
  error: 'red',
  timeout: 'orange',
  circuit_open: 'orange',
  rate_limited: 'orange',
};

const outcomeIconMap: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined />,
  error: <CloseCircleOutlined />,
  timeout: <ClockCircleOutlined />,
  circuit_open: <WarningOutlined />,
  rate_limited: <MinusCircleOutlined />,
};

export function ProviderTimeline({ providerTraces }: ProviderTimelineProps) {
  if (providerTraces.length === 0) {
    return <span style={{ color: '#999' }}>No provider traces</span>;
  }

  const items: Array<{
    key: string;
    color?: string;
    dot?: React.ReactNode;
    children: React.ReactNode;
  }> = [];

  for (const pt of providerTraces) {
    items.push({
      key: `header-${pt.id}`,
      color: 'blue',
      children: (
        <strong>
          Provider: {pt.resolvedProviderId} / {pt.resolvedModel} — {pt.totalDurationMs}ms total
        </strong>
      ),
    });

    for (const a of pt.attempts) {
      items.push({
        key: `${pt.id}-attempt-${a.attemptNumber}`,
        color: outcomeColorMap[a.outcome] ?? 'gray',
        dot: outcomeIconMap[a.outcome],
        children: (
          <span>
            <Tag>{a.providerId}</Tag>
            <Tag>{a.model}</Tag>
            {a.durationMs}ms
            {a.errorCode ? (
              <Tag color="red" style={{ marginLeft: 4 }}>
                {a.errorCode}
              </Tag>
            ) : null}
            {a.circuitBreakerTriggered ? (
              <Tag color="orange" style={{ marginLeft: 4 }}>
                Circuit Open
              </Tag>
            ) : null}
          </span>
        ),
      });
    }
  }

  return <Timeline items={items} />;
}
