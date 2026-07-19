import React, { useState } from 'react';
import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x/es/thought-chain/interface';
import type { ThoughtChainStep } from '../../hooks/useAgent';
import { ToolCard } from './ToolCard';

export interface ThoughtChainViewProps {
  steps: ThoughtChainStep[];
  onRetry?: (stepId: string) => void;
}

/**
 * Renders the agent's thought chain steps using @ant-design/x ThoughtChain.
 * Maps ThoughtChainStep[] to ThoughtChainItemType[] for consumption by
 * the Ant Design X component.
 */
export function ThoughtChainView({ steps, onRetry }: ThoughtChainViewProps) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const items: ThoughtChainItemType[] = steps.map((step) => {
    let content: React.ReactNode = step.description;

    // For tool steps, render ToolCard as content
    if (step.type === 'tool-call' && step.content) {
      content = step.content as React.ReactNode;
    }

    // For error steps with retry
    if (step.type === 'error' && onRetry) {
      content = (
        <div>
          {step.description && <p style={{ marginBottom: 8 }}>{step.description}</p>}
          <button
            onClick={() => onRetry(step.id)}
            style={{
              background: 'none',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return {
      key: step.id,
      title: step.title,
      description: step.description && step.type !== 'error' ? step.description : undefined,
      status: step.status as ThoughtChainItemType['status'],
      content,
      collapsible: step.collapsible,
      blink: step.blink,
    };
  });

  const handleExpand = (keys: string[]) => {
    setExpandedKeys(keys);
  };

  if (items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--ant-color-text-tertiary)' }}>
        NowPilot is working…
      </div>
    );
  }

  return (
    <ThoughtChain
      items={items}
      expandedKeys={expandedKeys}
      onExpand={handleExpand}
      style={{ padding: '8px 0' }}
    />
  );
}
