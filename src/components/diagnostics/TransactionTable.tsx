import { Table, Tag, Typography, Button } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useDiagnosticsStore } from '../../core/stores/diagnosticsStore';
import { exportSingleTrace, downloadBlob } from '../../core/telemetry/export';
import type { AITransaction } from '../../core/telemetry/types';

const statusIconMap: Record<string, React.ReactNode> = {
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  aborted: <WarningOutlined style={{ color: '#faad14' }} />,
  started: <SyncOutlined style={{ color: '#1890ff' }} spin />,
  streaming: <SyncOutlined style={{ color: '#1890ff' }} spin />,
};

const severityColorMap: Record<string, string> = {
  DEBUG: 'default',
  INFO: 'blue',
  WARNING: 'orange',
  ERROR: 'red',
  CRITICAL: 'red',
};

const typeColorMap: Record<string, string> = {
  chat: 'green',
  planner: 'blue',
  tool: 'purple',
  agent: 'cyan',
  renderer: 'geekblue',
  system: 'default',
};

function formatDurationMs(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts?: number): string {
  if (ts == null) return '—';
  return new Date(ts).toLocaleString();
}

export function TransactionTable() {
  const transactions = useDiagnosticsStore((s) => s.transactions);
  const loading = useDiagnosticsStore((s) => s.loading);
  const selectedOperationId = useDiagnosticsStore((s) => s.selectedOperationId);
  const selectTransaction = useDiagnosticsStore((s) => s.selectTransaction);
  const privacyMode = useDiagnosticsStore((s) => s.privacyMode);

  const handleExport = async (operationId: string) => {
    const blob = await exportSingleTrace(operationId, privacyMode);
    if (blob) {
      downloadBlob(blob, `trace-${operationId}.json`);
    }
  };

  const columns: ColumnsType<AITransaction> = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 60,
      render: (_: unknown, record: AITransaction) => (
        <span title={record.status}>{statusIconMap[record.status] ?? <ExclamationCircleOutlined />}</span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type: string) => <Tag color={typeColorMap[type] ?? 'default'}>{type}</Tag>,
    },
    {
      title: 'Provider',
      key: 'provider',
      width: 160,
      render: (_: unknown, record: AITransaction) => (
        <span>
          <Tag>{record.providerId}</Tag>
          {record.model ? <Typography.Text ellipsis style={{ maxWidth: 100 }}>{record.model}</Typography.Text> : null}
        </span>
      ),
    },
    {
      title: 'Operation ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (id: string) => (
        <Typography.Text copyable code ellipsis style={{ maxWidth: 190 }}>
          {id}
        </Typography.Text>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 90,
      render: (_: unknown, record: AITransaction) => formatDurationMs(record.durationMs),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (severity: string | undefined) =>
        severity ? (
          <Tag color={severityColorMap[severity] ?? 'default'}>{severity}</Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Timestamp',
      key: 'timestamp',
      width: 160,
      render: (_: unknown, record: AITransaction) => formatTimestamp(record.startedAt),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AITransaction) => (
        <Button
          type="link"
          size="small"
          icon={<DownloadOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleExport(record.id);
          }}
        >
          Export
        </Button>
      ),
    },
  ];

  return (
    <Table<AITransaction>
      columns={columns}
      dataSource={transactions}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      size="small"
      scroll={{ x: 900 }}
      onRow={(record) => ({
        onClick: () => selectTransaction(record.id),
        style: {
          cursor: 'pointer',
          background: record.id === selectedOperationId ? 'var(--ant-color-primary-bg, #e6f4ff)' : undefined,
        },
      })}
    />
  );
}
