import React, { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Button, Switch, App, Modal, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { memoryDB } from '../../core/storage/stores/MemoryDB';
import { userMemoryStore } from '../../core/memory/UserMemoryStore';

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
  const { message, modal } = App.useApp();
  const [facts, setFacts] = useState<UserFact[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.local.get('np_memory_enabled').then((result) => {
      setMemoryEnabled(result.np_memory_enabled !== false);
    });
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

  const activeFacts = facts.filter((f) => f.status !== 'superseded');

  const handleToggleMemory = async (enabled: boolean) => {
    setMemoryEnabled(enabled);
    try {
      await chrome.storage.local.set({ np_memory_enabled: enabled });
      message.success(enabled ? 'Memory enabled' : 'Memory disabled');
    } catch {
      message.error('Failed to update memory setting');
    }
  };

  const handleDeleteFact = useCallback(async (id: string) => {
    modal.confirm({
      title: 'Delete memory fact?',
      content: 'This fact will be permanently removed from memory.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setDeleting(id);
        try {
          await userMemoryStore.evictFact(id);
          await loadFacts();
          message.success('Fact deleted');
        } catch {
          message.error('Failed to delete fact');
        } finally {
          setDeleting(null);
        }
      },
    });
  }, [modal, message]);

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
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: unknown, record: UserFact) => (
        <Button
          type="text"
          danger
          size="small"
          loading={deleting === record.id}
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteFact(record.id)}
        />
      ),
    },
  ];

  return (
    <div data-options-section="memory" style={{ maxWidth: 720 }}>
      <Title level={4}>Memory</Title>
      <p style={{ marginBottom: 16 }}>
        View and manage your stored memory facts. Memory facts are automatically collected during conversations.
      </p>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space align="center">
          <Switch
            checked={memoryEnabled}
            onChange={handleToggleMemory}
          />
          <span style={{ fontSize: 12, color: '#888' }}>
            Memory system {memoryEnabled ? 'enabled' : 'disabled'}
          </span>
        </Space>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            {activeFacts.length} fact{activeFacts.length !== 1 ? 's' : ''} stored
          </div>
          {activeFacts.length > 0 ? (
            <Table
              dataSource={activeFacts}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              No memory facts stored yet. Memory facts are automatically collected during conversations.
            </div>
          )}
        </div>
      </Space>
    </div>
  );
}
