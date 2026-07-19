import { Tree, Typography, Empty, Spin, App } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useEffect, useState } from 'react';
import { gqmDataService } from '../services/GQMDataService';
import type { Goal, Question, Metric } from '../data/gqmTypes';

export function TeamGQMSidepanelPage() {
  const { message } = App.useApp();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    try {
      // Load all goals (root nodes)
      const allNodes = await gqmDataService.getChildren(null); // root-level
      const goalNodes = allNodes.filter(n => n.type === 'goal') as Goal[];
      setGoals(goalNodes);

      // For each goal, build the full tree
      const trees: DataNode[] = [];
      for (const goal of goalNodes) {
        const fullTree = await gqmDataService.getTree(goal.id);
        trees.push(goalToTreeNode(fullTree.goal, fullTree.questions));
      }
      setTreeData(trees);
    } catch (err) {
      message.error('Failed to load GQM data');
    } finally {
      setLoading(false);
    }
  }

  // Convert GQMNode hierarchy to AntD Tree DataNode[]
  function goalToTreeNode(goal: Goal, questions: Array<{ question: Question; metrics: Metric[] }>): DataNode {
    return {
      key: goal.id,
      title: goal.title,
      selectable: false,
      children: questions.map(q => ({
        key: q.question.id,
        title: q.question.title,
        selectable: false,
        children: q.metrics.map(m => ({
          key: m.id,
          title: `${m.title}${m.currentValue ? `: ${m.currentValue}` : ''}${m.unit ? ` ${m.unit}` : ''}`,
          selectable: false,
          isLeaf: true,
        })),
      })),
    };
  }

  if (loading) return <Spin style={{ display: 'flex', justifyContent: 'center', padding: 48 }} />;
  if (goals.length === 0) {
    return (
      <div data-options-section="teamgqm" style={{ padding: 16 }}>
        <Typography.Title level={4}>Goals &amp; Metrics</Typography.Title>
        <Empty description="No goals defined yet. Create your first goal to start tracking metrics." style={{ padding: 48 }} />
      </div>
    );
  }

  return (
    <div data-options-section="teamgqm" style={{ padding: 16 }}>
      <Typography.Title level={4}>Goals &amp; Metrics</Typography.Title>
      <Tree
        treeData={treeData}
        defaultExpandAll
        selectable={false}
        blockNode
        showLine
      />
    </div>
  );
}
