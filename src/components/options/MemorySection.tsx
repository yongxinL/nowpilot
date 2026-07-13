import React, { useEffect, useState } from 'react';
import { Form, Table, Typography, Button, Switch, App } from 'antd';
import { memoryDB } from '../../core/storage/stores/MemoryDB';

const { Title } = Typography;

interface UserFact {
  id: string;
  fact: string;
  category: string;
  confidence: number;
  created: number;
  updated: number;
  source: string;
  status?: 'active' | 'superseded';
  tags?: string[];
  useCount?: number;
  lastUsedAt?: number;
}

export function MemorySection() {
  const { message } = App.useApp();
  const [facts, setFacts] = useState<UserFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  useEffect(() => {
    loadFacts();
  }, []);

  const loadFacts = async () => {
    try {
      const result = await memoryDB.getAllUserFacts();
      setFacts(result);
    } catch {
      setFacts([]);
    }
  };

  const handleToggleMemory = async (enabled: boolean) => {
    setMemoryEnabled(enabled);
    try {
      await chrome.storage.local.set({ np_memory_enabled: enabled });
      message.success(enabled ? 'Memory enabled' : 'Memory disabled');
    } catch {
      message.error('Failed to update memory setting');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await chrome.storage.local.set({ np_memory_enabled: memoryEnabled });
      message.success('Memory settings saved');
    } catch {
      message.error('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const columns = [
    {
      title: 'Fact',
      dataIndex: 'fact',
      key: 'fact',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (value: number) => `${Math.round(value * 100)}%`,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
    {
      title: 'Updated',
      dataIndex: 'updated',
      key: 'updated',
      width: 140,
      render: (value: number) => formatDate(value),
    },
  ];

  return (
    <div data-options-section="memory" style={{ maxWidth: 720 }}>
      <Title level={4}>Memory</Title>
      <p style={{ marginBottom: 16 }}>
        View stored user memory facts. Memory editing will be available in a future update.
      </p>

      <Form layout="horizontal" labelAlign="left" onFinish={handleSave}>
        <Form.Item label="Memory System">
          <Switch
            checked={memoryEnabled}
            onChange={handleToggleMemory}
          />
          <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>
            {memoryEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </Form.Item>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            {facts.length} fact{facts.length !== 1 ? 's' : ''} stored
          </div>
          <Table
            dataSource={facts.filter((f) => f.status !== 'superseded')}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
          />
          {facts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              No memory facts stored yet. Memory facts are automatically collected during conversations.
            </div>
          ) : null}
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
