import React, { useMemo } from 'react';
import { Dropdown, Tooltip, theme, MenuProps } from 'antd';
import {
  DownOutlined,
  AppstoreOutlined,
  CodeOutlined,
  EditOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useExtensionStore } from '../../store/useExtensionStore';
import { WorkflowId, WorkflowDefinition } from '../../types';

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'general',
    name: 'General',
    tagline: 'Balanced default',
    description: 'Everyday reasoning, chatting, and multi-turn tasks',
    defaultModelId: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx',
  },
  {
    id: 'coding',
    name: 'Coding',
    tagline: 'Reasoning & precision',
    description: 'Code generation, debugging, refactoring & review',
    defaultModelId: 'Qwen3.5-9B-OptiQ-4bit',
  },
  {
    id: 'writing',
    name: 'Writing',
    tagline: 'Creativity & fluency',
    description: 'Drafting, editing, tone styling & creative output',
    defaultModelId: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'research',
    name: 'Research',
    tagline: 'Depth & multi-step',
    description: 'Comprehensive inquiry, syntheses & fact verification',
    defaultModelId: 'gemini-1.5-pro',
  },
  {
    id: 'speed',
    name: 'Speed',
    tagline: 'Low latency',
    description: 'Instant answers, quick summaries & rapid triage',
    defaultModelId: 'gemma-4-e2b-it-4bit',
  },
];

const WORKFLOW_ICONS: Record<WorkflowId, React.ReactNode> = {
  general: <AppstoreOutlined />,
  coding: <CodeOutlined />,
  writing: <EditOutlined />,
  research: <FileSearchOutlined />,
  speed: <ThunderboltOutlined />,
};

interface WorkflowSelectorProps {
  variant?: 'subtle' | 'pill';
  onOpenOptions?: () => void;
}

export const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  variant = 'subtle',
  onOpenOptions,
}) => {
  const { token } = theme.useToken();
  const { config, updateConfig } = useExtensionStore();

  const currentWorkflowId: WorkflowId = config.selectedWorkflow || 'general';
  const currentWorkflow =
    WORKFLOW_DEFINITIONS.find((w) => w.id === currentWorkflowId) || WORKFLOW_DEFINITIONS[0];

  const handleSelectWorkflow = (wId: WorkflowId) => {
    const targetWorkflow = WORKFLOW_DEFINITIONS.find((w) => w.id === wId);
    const mappedModel =
      config.workflowModelMapping?.[wId] || targetWorkflow?.defaultModelId || config.selectedModel;

    updateConfig({
      selectedWorkflow: wId,
      selectedModel: mappedModel,
    });
  };

  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = WORKFLOW_DEFINITIONS.map((wf) => {
      const isSelected = wf.id === currentWorkflowId;
      return {
        key: wf.id,
        onClick: () => handleSelectWorkflow(wf.id),
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: 220,
              paddingTop: 4,
              paddingBottom: 4,
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 15,
                  color: isSelected ? token.colorPrimary : token.colorTextSecondary,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {WORKFLOW_ICONS[wf.id]}
              </span>
              <div>
                <div
                  style={{
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: 13,
                    color: isSelected ? token.colorPrimary : token.colorText,
                    lineHeight: 1.3,
                  }}
                >
                  {wf.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: token.colorTextTertiary,
                    lineHeight: 1.3,
                  }}
                >
                  {wf.tagline}
                </div>
              </div>
            </div>
            {isSelected && (
              <CheckOutlined
                style={{
                  fontSize: 12,
                  color: token.colorPrimary,
                  fontWeight: 'bold',
                }}
              />
            )}
          </div>
        ),
      };
    });

    if (onOpenOptions) {
      items.push({ type: 'divider' });
      items.push({
        key: 'manage-routing',
        onClick: onOpenOptions,
        label: (
          <div
            style={{
              fontSize: 11,
              color: token.colorTextTertiary,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            Configure Workflow Routing...
          </div>
        ),
      });
    }

    return items;
  }, [currentWorkflowId, token, onOpenOptions]);

  const buttonStyle: React.CSSProperties =
    variant === 'pill'
      ? {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 32,
          paddingLeft: 12,
          paddingRight: 10,
          background: token.colorFillSecondary,
          color: token.colorText,
          fontWeight: 500,
          fontSize: 12,
          borderRadius: 9999,
          border: `1px solid ${token.colorBorderSecondary}`,
          cursor: 'pointer',
          transition: 'all 150ms ease',
          userSelect: 'none',
        }
      : {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 32,
          paddingLeft: 8,
          paddingRight: 8,
          background: 'transparent',
          color: token.colorText,
          fontWeight: 500,
          fontSize: 12,
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 150ms ease',
          userSelect: 'none',
        };

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomLeft">
      <Tooltip title={`Workflow: ${currentWorkflow.name} (${currentWorkflow.tagline})`}>
        <button
          type="button"
          aria-label={`Workflow selector, currently ${currentWorkflow.name}`}
          style={buttonStyle}
        >
          <span
            style={{
              color: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              fontSize: 14,
            }}
          >
            {WORKFLOW_ICONS[currentWorkflow.id]}
          </span>
          <span style={{ fontWeight: 600 }}>{currentWorkflow.name}</span>
          <DownOutlined
            style={{
              fontSize: 10,
              color: token.colorTextTertiary,
              marginLeft: 2,
            }}
          />
        </button>
      </Tooltip>
    </Dropdown>
  );
};
