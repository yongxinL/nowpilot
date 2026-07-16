import React, { useCallback, useEffect, useState } from 'react';
import { Form, Table, Typography, Button, InputNumber, Switch, Popconfirm, Select, App } from 'antd';
import { useProviderStore } from '../../core/stores/providerStore';
import type { ModelEntry } from '../../core/ai/providers/providerTypes';

const { Title } = Typography;

interface ModelEntryRow {
  key: string;
  providerId: string;
  modelId: string;
  contextWindow: number;
  enabled: boolean;
}

export function ModelsSection() {
  const { message } = App.useApp();
  const modelEntries = useProviderStore((s) => s.modelEntries);
  const setModelEntries = useProviderStore((s) => s.setModelEntries);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ModelEntryRow[]>([]);

  useEffect(() => {
    setRows(
      modelEntries.map((e) => ({
        key: `${e.providerId}-${e.modelId}`,
        providerId: e.providerId,
        modelId: e.modelId,
        contextWindow: e.contextWindow,
        enabled: true,
      })),
    );
  }, [modelEntries]);

  const groupedByProvider = rows.reduce<Record<string, ModelEntryRow[]>>((acc, row) => {
    if (!acc[row.providerId]) acc[row.providerId] = [];
    acc[row.providerId].push(row);
    return acc;
  }, {});

  const handleToggleEnabled = (key: string, enabled: boolean) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, enabled } : r)));
  };

  const handleContextWindowChange = (key: string, contextWindow: number) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, contextWindow } : r)));
  };

  const handleRemoveModel = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleAddModel = (providerId: string) => {
    const newRow: ModelEntryRow = {
      key: `${providerId}-new-${Date.now()}`,
      providerId,
      modelId: '',
      contextWindow: 4096,
      enabled: true,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated: ModelEntry[] = rows
        .filter((r) => r.modelId)
        .map((r) => ({
          providerId: r.providerId,
          modelId: r.modelId,
          costTier: 'haiku' as const,
          contextWindow: r.contextWindow,
          modalities: { text: true, image: false, toolUse: false, structuredOutput: false },
        }));
      setModelEntries(updated);
      message.success('Models saved');
    } catch {
      message.error('Failed to save models');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: ModelEntryRow) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleEnabled(record.key, checked)}
        />
      ),
    },
    {
      title: 'Model ID',
      dataIndex: 'modelId',
      key: 'modelId',
      render: (modelId: string, record: ModelEntryRow) =>
        modelId ? (
          <span>{modelId}</span>
        ) : (
          <Select
            style={{ width: 200 }}
            placeholder="Select or type model..."
            options={[]}
            onSelect={(val) => {
              setRows((prev) =>
                prev.map((r) => (r.key === record.key ? { ...r, modelId: val } : r)),
              );
            }}
          />
        ),
    },
    {
      title: 'Context Window',
      dataIndex: 'contextWindow',
      key: 'contextWindow',
      width: 180,
      render: (contextWindow: number, record: ModelEntryRow) => (
        <InputNumber
          min={1024}
          max={524288}
          step={1024}
          value={contextWindow}
          onChange={(val) => {
            if (val != null) handleContextWindowChange(record.key, val);
          }}
          style={{ width: 150 }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: ModelEntryRow) => (
        <Popconfirm
          title="Delete this model?"
          description="This action cannot be undone."
          onConfirm={() => handleRemoveModel(record.key)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div data-options-section="models" style={{ maxWidth: 720 }}>
      <Title level={4}>Models</Title>
      <p style={{ marginBottom: 16 }}>Enable, configure, and manage models per provider.</p>

      <Form layout="horizontal" labelAlign="left" onFinish={handleSave}>
        {Object.entries(groupedByProvider).length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
            No models configured. Add a provider first, then add models.
          </div>
        ) : (
          Object.entries(groupedByProvider).map(([providerId, providerRows]) => (
            <div
              key={providerId}
              style={{
                marginBottom: 24,
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Title level={5} style={{ margin: 0 }}>
                  {providerId}
                </Title>
                <Button size="small" onClick={() => handleAddModel(providerId)}>
                  + Add Model
                </Button>
              </div>
              <Table
                dataSource={providerRows}
                columns={columns}
                rowKey="key"
                pagination={false}
                size="small"
              />
            </div>
          ))
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
