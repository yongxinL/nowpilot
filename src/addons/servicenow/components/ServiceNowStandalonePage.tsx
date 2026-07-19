import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Table, Drawer, Alert, Button, Tag, Spin, Tabs, Descriptions, App } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { serviceNowTableClient, type ServiceNowTableQuery } from '../services/ServiceNowTableClient';
import { serviceNowSessionAdapter } from '../services/ServiceNowSessionAdapter';

const { Title } = Typography;

const SERVICE_NOW_PATTERN = /\.service-now\.com$/;

interface CaseRecord {
  number: string;
  short_description: string;
  priority: string;
  state: string;
  assigned_to?: { display_value: string };
  sys_updated_on: string;
  sys_id: string;
  [key: string]: unknown;
}

interface CommentEntry {
  author: string;
  timestamp: string;
  text: string;
}

const priorityColors: Record<string, string> = {
  '1': 'red',
  '2': 'orange',
  '3': 'yellow',
  '4': 'blue',
  '5': 'green',
};

const priorityLabels: Record<string, string> = {
  '1': 'Critical',
  '2': 'High',
  '3': 'Moderate',
  '4': 'Low',
  '5': 'Planning',
};

const columns = [
  {
    title: 'Number',
    dataIndex: 'number',
    key: 'number',
    width: 140,
    render: (text: string) => <strong>{text}</strong>,
  },
  {
    title: 'Short Description',
    dataIndex: 'short_description',
    key: 'short_description',
    ellipsis: true,
  },
  {
    title: 'Priority',
    dataIndex: 'priority',
    key: 'priority',
    width: 100,
    render: (text: string) => (
      <Tag color={priorityColors[text] ?? 'default'}>
        {priorityLabels[text] ?? text}
      </Tag>
    ),
  },
  {
    title: 'State',
    dataIndex: 'state',
    key: 'state',
    width: 120,
    render: (text: string) => (
      <Tag>{text}</Tag>
    ),
  },
  {
    title: 'Assigned To',
    dataIndex: ['assigned_to', 'display_value'],
    key: 'assigned_to',
    width: 160,
    render: (text: string | undefined) => text || '—',
  },
  {
    title: 'Updated',
    dataIndex: 'sys_updated_on',
    key: 'sys_updated_on',
    width: 180,
    render: (text: string) => text ? new Date(text).toLocaleString() : '—',
  },
];

export function ServiceNowStandalonePage() {
  const { message } = App.useApp();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);

  const detectAndFetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Detect ServiceNow instance from active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.url) {
        throw new Error('No active tab detected.');
      }

      const url = new URL(tab.url);
      if (!SERVICE_NOW_PATTERN.test(url.hostname)) {
        throw new Error('No ServiceNow session detected. Open a ServiceNow tab and log in, then try again.');
      }

      const instance = `${url.protocol}//${url.hostname}`;
      setInstanceUrl(instance);

      // Query incidents
      const query: ServiceNowTableQuery = {
        table: 'incident',
        limit: 50,
        fields: ['number', 'short_description', 'priority', 'state', 'assigned_to', 'sys_updated_on', 'sys_id'],
      };

      const response = await serviceNowTableClient.queryTable(instance, query, tab.id);
      setCases((response.result ?? []) as CaseRecord[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load cases';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    detectAndFetchCases();
  }, [detectAndFetchCases]);

  const handleRowClick = useCallback(
    (record: CaseRecord) => {
      setSelectedCase(record);
      setDrawerOpen(true);
    },
    [],
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedCase(null);
  }, []);

  // --- Loading state ---
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', marginTop: 48 }}>
        <Spin tip="Loading ServiceNow cases..." />
      </div>
    );
  }

  // --- Error state ---
  if (error && cases.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={4}>ServiceNow Cases</Title>
        <Alert
          type="error"
          message="Failed to load cases"
          description={error}
          showIcon
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={detectAndFetchCases}
            >
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div data-options-section="servicenow-standalone" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>ServiceNow Cases</Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={detectAndFetchCases}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {instanceUrl && (
        <Alert
          type="info"
          message={`Connected to ${instanceUrl}`}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        dataSource={cases}
        columns={columns}
        rowKey="sys_id"
        size="middle"
        loading={loading}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      <Drawer
        title={selectedCase ? `Case ${selectedCase.number}` : 'Case Details'}
        open={drawerOpen}
        onClose={handleDrawerClose}
        width={560}
      >
        {selectedCase && (
          <>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Number">{selectedCase.number}</Descriptions.Item>
              <Descriptions.Item label="Short Description">{selectedCase.short_description}</Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={priorityColors[selectedCase.priority] ?? 'default'}>
                  {priorityLabels[selectedCase.priority] ?? selectedCase.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="State">
                <Tag>{selectedCase.state}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Assigned To">
                {selectedCase.assigned_to?.display_value || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {selectedCase.sys_updated_on ? new Date(selectedCase.sys_updated_on).toLocaleString() : '—'}
              </Descriptions.Item>
            </Descriptions>

            <Tabs
              items={[
                {
                  key: 'comments',
                  label: 'Comments',
                  children: <p style={{ color: '#888' }}>Comments feature requires additional API calls. Coming soon.</p>,
                },
                {
                  key: 'work-notes',
                  label: 'Work Notes',
                  children: <p style={{ color: '#888' }}>Work notes feature requires additional API calls. Coming soon.</p>,
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
