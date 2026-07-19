import { Tree, Input, Button, Typography, Empty, Spin, App, Space, Dropdown } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { MenuProps } from 'antd';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { gqmDataService } from '../services/GQMDataService';
import type { Goal, Question, Metric } from '../data/gqmTypes';

export function TeamGQMStandalonePage() {
  const { message } = App.useApp();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Load hierarchy on mount
  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    try {
      const allNodes = await gqmDataService.getChildren('');
      const goalNodes = allNodes.filter(n => n.type === 'goal') as Goal[];
      setGoals(goalNodes);

      const trees: DataNode[] = [];
      for (const goal of goalNodes) {
        const fullTree = await gqmDataService.getTree(goal.id);
        trees.push(goalToTreeNode(fullTree.goal, fullTree.questions));
      }
      setTreeData(trees);

      // Expand all loaded Goals
      setExpandedKeys(goalNodes.map(g => g.id));
    } catch (err) {
      message.error('Failed to load GQM data');
    } finally {
      setLoading(false);
    }
  }

  function goalToTreeNode(
    goal: Goal,
    questions: Array<{ question: Question; metrics: Metric[] }>,
  ): DataNode {
    return {
      key: goal.id,
      title: goal.title,
      children: questions.map(q => ({
        key: q.question.id,
        title: q.question.title,
        children: q.metrics.map(m => ({
          key: m.id,
          title: `${m.title}${m.currentValue ? `: ${m.currentValue}` : ''}${m.unit ? ` ${m.unit}` : ''}`,
          isLeaf: true,
        })),
      })),
    };
  }

  // Determine parent type for context menu actions
  function getParentType(key: string): 'goal' | 'question' | null {
    if (goals.some(g => g.id === key)) return 'goal';
    for (const goal of goals) {
      if (
        treeData
          .find(t => t.key === goal.id)
          ?.children?.some(c => c.key === key)
      ) {
        return 'question';
      }
    }
    return null;
  }

  // Add Question under a Goal
  const handleAddQuestion = useCallback(
    async (parentId: string) => {
      try {
        const fullTree = await gqmDataService.getTree(parentId);
        await gqmDataService.createQuestion({
          title: 'New Question',
          parentId,
          order: fullTree.questions.length,
        });
        message.success('Question added');
        loadGoals();
      } catch (err) {
        message.error('Failed to add question');
      }
    },
    [message],
  );

  // Add Metric under a Question
  const handleAddMetric = useCallback(
    async (parentId: string) => {
      try {
        await gqmDataService.createMetric({
          title: 'New Metric',
          parentId,
          order: 0,
        });
        message.success('Metric added');
        loadGoals();
      } catch (err) {
        message.error('Failed to add metric');
      }
    },
    [message],
  );

  // Build context menu items for each node
  const getContextMenuItems = useCallback(
    (nodeKey: string): MenuProps['items'] => {
      const parentType = getParentType(nodeKey);
      if (parentType === 'goal') {
        return [
          {
            key: 'add-question',
            label: 'Add Question',
            onClick: () => handleAddQuestion(nodeKey),
          },
        ];
      }
      if (parentType === 'question') {
        return [
          {
            key: 'add-metric',
            label: 'Add Metric',
            onClick: () => handleAddMetric(nodeKey),
          },
        ];
      }
      return undefined;
    },
    [handleAddQuestion, handleAddMetric],
  );

  // Render title content for a node (inline editing + context menu)
  const renderNodeTitle = useCallback(
    (nodeKey: React.Key, nodeTitle: React.ReactNode) => {
      const key = nodeKey as string;
      const content =
        key === editingKey ? (
          <Input
            defaultValue={nodeTitle as string}
            onPressEnter={async (e) => {
              await gqmDataService.updateNode(key, {
                title: e.currentTarget.value,
              });
              setEditingKey(null);
              message.success('Updated');
              loadGoals();
            }}
            onBlur={() => setEditingKey(null)}
            autoFocus
          />
        ) : (
          <span
            onDoubleClick={() => setEditingKey(key)}
            style={{ cursor: 'pointer' }}
          >
            {nodeTitle}
          </span>
        );

      const menuItems = getContextMenuItems(key);
      if (!menuItems || menuItems.length === 0) return content;

      return (
        <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
          <span>{content}</span>
        </Dropdown>
      );
    },
    [editingKey, message, getContextMenuItems],
  );

  // Add Goal
  const handleAddGoal = useCallback(async () => {
    try {
      await gqmDataService.createGoal({
        title: 'New Goal',
        order: goals.length,
      });
      message.success('Goal added');
      loadGoals();
    } catch (err) {
      message.error('Failed to add goal');
    }
  }, [goals.length, message]);

  // Build tree data with render functions for title
  const treeWithRender = useMemo(
    () => buildRenderTree(treeData, renderNodeTitle),
    [treeData, renderNodeTitle],
  );

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>GQM Workspace</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddGoal}>
          Add Goal
        </Button>
      </Space>

      {loading ? (
        <Spin style={{ display: 'flex', justifyContent: 'center', padding: 48 }} />
      ) : goals.length === 0 ? (
        <Empty
          description="No goals defined yet. Create your first goal to start tracking metrics."
          style={{ padding: 48 }}
        />
      ) : (
        <Tree
          treeData={treeWithRender}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys as string[])}
          blockNode
          showLine
        />
      )}
    </div>
  );
}

/**
 * Recursively convert DataNode[] to include render functions as title values.
 * This pattern is used instead of titleRender (not available in antd 6).
 */
function buildRenderTree(
  nodes: DataNode[],
  renderFn: (key: React.Key, title: React.ReactNode) => React.ReactNode,
): DataNode[] {
  return nodes.map((node) => ({
    ...node,
    title: renderFn(node.key, typeof node.title === 'function' ? String(node.key) : node.title),
    children: node.children
      ? buildRenderTree(node.children, renderFn)
      : node.children,
  }));
}
