import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Typography, Button, Space, Tooltip } from 'antd';
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { extractionLogDB, type ExtractionLogEntry } from '../../core/storage/stores/ExtractionLogDB';

const { Text } = Typography;

const EXTRACTION_TYPE_COLORS: Record<string, string> = {
  readability: 'green',
  'visible-content': 'orange',
  'metadata-only': 'red',
};

const QUALITY_COLORS: Record<string, string> = {
  article: 'blue',
  generic: 'geekblue',
  minimal: 'default',
};

const STEP_STATUS_COLORS: Record<string, string> = {
  start: 'default',
  ok: 'green',
  skip: 'orange',
  fail: 'red',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

interface ExtractionLogListProps {
  refreshTrigger?: number;
}

export function ExtractionLogList({ refreshTrigger }: ExtractionLogListProps) {
  const [logs, setLogs] = useState<ExtractionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await extractionLogDB.getAll(200);
      setLogs(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const handleClear = async () => {
    await extractionLogDB.clear();
    setLogs([]);
  };

  const columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 90,
      render: (ts: number) => <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{formatTimestamp(ts)}</Text>,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text style={{ fontSize: 12 }}>{url.length > 60 ? url.slice(0, 60) + '…' : url}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: ['trace', 'extractionType'],
      key: 'extractionType',
      width: 120,
      render: (val: string | undefined) =>
        val ? <Tag color={EXTRACTION_TYPE_COLORS[val] || 'default'}>{val}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Quality',
      dataIndex: ['trace', 'extractionQuality'],
      key: 'extractionQuality',
      width: 90,
      render: (val: string | undefined) =>
        val ? <Tag color={QUALITY_COLORS[val] || 'default'}>{val}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Duration',
      dataIndex: ['trace', 'totalDurationMs'],
      key: 'duration',
      width: 90,
      render: (ms: number) => <Text style={{ fontFamily: 'monospace' }}>{ms}ms</Text>,
    },
    {
      title: 'Steps',
      dataIndex: ['trace', 'steps'],
      key: 'steps',
      width: 60,
      render: (steps: unknown[]) => <Text>{Array.isArray(steps) ? steps.length : 0}</Text>,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
        <Button size="small" icon={<ClearOutlined />} onClick={handleClear} danger>
          Clear
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {logs.length} extraction{logs.length !== 1 ? 's' : ''}
        </Text>
      </Space>
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
        expandable={{
          expandedRowRender: (record) => <ExtractionStepDetail steps={record.trace.steps} url={record.url} />,
          rowExpandable: (record) => record.trace.steps.length > 0,
        }}
        style={{ fontSize: 12 }}
      />
    </div>
  );
}

function ExtractionStepDetail({ steps, url }: { steps: ExtractionLogEntry['trace']['steps']; url: string }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <Text strong style={{ fontSize: 12 }}>Extraction Steps:</Text>
      <table style={{ width: '100%', marginTop: 4, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 180 }}>Step</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', width: 60 }}>Status</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', width: 60 }}>Duration</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Detail</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #fafafa' }}>
              <td style={{ padding: '2px 8px', fontFamily: 'monospace' }}>{s.step}</td>
              <td style={{ padding: '2px 8px' }}>
                <Tag color={STEP_STATUS_COLORS[s.status] || 'default'} style={{ margin: 0, fontSize: 11 }}>
                  {s.status}
                </Tag>
              </td>
              <td style={{ padding: '2px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                {s.durationMs > 0 ? `${s.durationMs}ms` : '—'}
              </td>
              <td style={{ padding: '2px 8px', color: '#666', fontSize: 11 }}>{s.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>URL: {url}</Text>
      </div>
    </div>
  );
}
