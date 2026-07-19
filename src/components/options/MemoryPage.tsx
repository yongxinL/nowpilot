import { useEffect, useState, useCallback } from 'react';
import { Tabs, Card, Button, Typography, Select, Popconfirm, Empty, Alert, Flex, Tag, App, theme } from 'antd';
import { userMemoryStore } from '../../core/memory/UserMemoryStore';
import { usePreferenceStore } from '../../core/memory/PreferenceMemoryStore';
import type { UserMemoryFact } from '../../core/memory/memoryTypes';

const { Text, Paragraph } = Typography;

export function MemoryPage() {
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();

  type FactWithActions = UserMemoryFact & { _loading?: boolean };

  const [facts, setFacts] = useState<FactWithActions[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadFacts();
  }, []);

  const loadFacts = async () => {
    const all = await getAllFactsLegacy();
    setFacts(all);
  };

  const getAllFactsLegacy = async (): Promise<FactWithActions[]> => {
    try {
      const raw = await (await import('../../core/storage/stores/MemoryDB')).memoryDB.getAllUserFacts();
      return raw as FactWithActions[];
    } catch {
      return [];
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence > 0.7) return { label: 'High', color: 'green' };
    if (confidence >= 0.4) return { label: 'Medium', color: 'orange' };
    return { label: 'Low', color: 'red' };
  };

  const getStatusColor = (status?: string) => {
    if (status === 'confirmed') return 'success';
    if (status === 'rejected') return 'error';
    return 'default';
  };

  const filteredFacts = facts.filter((f) => {
    if (filter === 'high') return f.confidence > 0.7;
    if (filter === 'confirmed') return f.status === 'confirmed';
    if (filter === 'inferred') return !f.status || f.status === 'inferred' || f.status === 'active';
    return true;
  });

  const handleConfirm = async (factId: string) => {
    try {
      await userMemoryStore.confirm(factId);
      message.success('Fact confirmed');
      loadFacts();
    } catch {
      message.error('Failed to confirm fact');
    }
  };

  const handleReject = async (factId: string) => {
    try {
      await userMemoryStore.reject(factId);
      message.success('Fact rejected');
      loadFacts();
    } catch {
      message.error('Failed to reject fact');
    }
  };

  const handleDelete = (factId: string) => {
    modal.confirm({
      title: 'Delete this memory fact?',
      content: 'This cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        await userMemoryStore.delete(factId);
        message.success('Fact deleted');
        loadFacts();
      },
    });
  };

  const userMemoryTab = (
    <div>
      <Flex gap={8} align="center" style={{ marginBottom: 16 }}>
        <Select
          value={filter}
          onChange={setFilter}
          style={{ width: 200 }}
          options={[
            { label: 'All', value: 'all' },
            { label: 'High Confidence (>0.7)', value: 'high' },
            { label: 'User Confirmed', value: 'confirmed' },
            { label: 'Inferred', value: 'inferred' },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {filteredFacts.length} fact{filteredFacts.length !== 1 ? 's' : ''}
        </Text>
      </Flex>

      {filteredFacts.length === 0 ? (
        <Empty description="No memory facts yet. Facts are automatically extracted as you use NowPilot." />
      ) : (
        <Flex vertical gap={8}>
          {filteredFacts.map((fact) => {
            const badge = getConfidenceBadge(fact.confidence);
            return (
              <Card key={fact.id} size="small" styles={{ body: { padding: 12 } }}>
                <Paragraph
                  ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
                  style={{ margin: 0, marginBottom: 8 }}
                >
                  {fact.fact}
                </Paragraph>
                <Flex gap={4} wrap="wrap" align="center">
                  <Tag color={badge.color}>{badge.label} ({Math.round(fact.confidence * 100)}%)</Tag>
                  <Tag color={getStatusColor(fact.status)}>{fact.status || 'active'}</Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {fact.source} · {fact.updated ? new Date(fact.updated).toLocaleDateString() : ''}
                  </Text>
                </Flex>
                <Flex gap={4} style={{ marginTop: 8 }}>
                  {fact.status !== 'confirmed' && (
                    <Button size="small" type="link" onClick={() => handleConfirm(fact.id)}>
                      Confirm
                    </Button>
                  )}
                  {fact.status !== 'rejected' && (
                    <Button size="small" type="link" onClick={() => handleReject(fact.id)}>
                      Reject
                    </Button>
                  )}
                  <Popconfirm
                    title="Delete this memory fact?"
                    description="This cannot be undone."
                    onConfirm={() => handleDelete(fact.id)}
                    okText="Delete"
                    okType="danger"
                  >
                    <Button size="small" type="link" danger>
                      Delete
                    </Button>
                  </Popconfirm>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      )}
    </div>
  );

  const conversationMemoryTab = (
    <Alert type="info" message="Conversation memory browsing" description="Coming in a future update" showIcon />
  );

  const preferencesTab = (
    <div>
      <Alert
        type="info"
        message="Preferences are managed in their respective settings pages."
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Flex vertical gap={8}>
        <Flex justify="space-between">
          <Text strong>AI Name</Text>
          <Text>{usePreferenceStore.getState().aiName || 'Not set'}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text strong>AI Tone</Text>
          <Text>{usePreferenceStore.getState().aiTone || 'Professional + Approachable'}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text strong>Response Brevity</Text>
          <Text>{usePreferenceStore.getState().responseBrevity || 'Balanced (default)'}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text strong>Response Style</Text>
          <Text>{usePreferenceStore.getState().responseStyle}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text strong>Tool Autonomy</Text>
          <Text>{usePreferenceStore.getState().toolAutonomy}</Text>
        </Flex>
      </Flex>
    </div>
  );

  const tabItems = [
    { key: 'user-memory', label: 'User Memory', children: userMemoryTab },
    { key: 'conversation-memory', label: 'Conversation Memory', children: conversationMemoryTab },
    { key: 'preferences', label: 'Preferences', children: preferencesTab },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="user-memory" items={tabItems} />
    </div>
  );
}
