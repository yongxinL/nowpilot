import { useEffect, useCallback } from 'react';
import { Row, Col, Select, DatePicker, Input, Switch, Button, Space, Alert, Typography } from 'antd';
import { useDiagnosticsStore } from '../../core/stores/diagnosticsStore';
import { TransactionTable } from '../diagnostics/TransactionTable';
import { TraceDetailPanel } from '../diagnostics/TraceDetailPanel';
import type { TransactionType, TransactionStatus, Severity } from '../../core/telemetry/types';

const { RangePicker } = DatePicker;

const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'planner', label: 'Planner' },
  { value: 'tool', label: 'Tool' },
  { value: 'agent', label: 'Agent' },
  { value: 'renderer', label: 'Renderer' },
  { value: 'system', label: 'System' },
];

const TRANSACTION_STATUS_OPTIONS: { value: TransactionStatus; label: string }[] = [
  { value: 'started', label: 'Started' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'aborted', label: 'Aborted' },
];

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'DEBUG' as Severity, label: 'DEBUG' },
  { value: 'INFO' as Severity, label: 'INFO' },
  { value: 'WARNING' as Severity, label: 'WARNING' },
  { value: 'ERROR' as Severity, label: 'ERROR' },
  { value: 'CRITICAL' as Severity, label: 'CRITICAL' },
];

export function DiagnosticsPanel() {
  const filterType = useDiagnosticsStore((s) => s.filterType);
  const filterStatus = useDiagnosticsStore((s) => s.filterStatus);
  const filterProvider = useDiagnosticsStore((s) => s.filterProvider);
  const filterSeverity = useDiagnosticsStore((s) => s.filterSeverity);
  const filterDateRange = useDiagnosticsStore((s) => s.filterDateRange);
  const searchQuery = useDiagnosticsStore((s) => s.searchQuery);
  const diagnosticMode = useDiagnosticsStore((s) => s.diagnosticMode);
  const privacyMode = useDiagnosticsStore((s) => s.privacyMode);
  const setFilter = useDiagnosticsStore((s) => s.setFilter);
  const setDiagnosticMode = useDiagnosticsStore((s) => s.setDiagnosticMode);
  const setPrivacyMode = useDiagnosticsStore((s) => s.setPrivacyMode);
  const refreshTransactions = useDiagnosticsStore((s) => s.refreshTransactions);
  const clearFilters = useDiagnosticsStore((s) => s.clearFilters);
  const pendingOperationId = useDiagnosticsStore((s) => s.pendingOperationId);
  const setPendingOperationId = useDiagnosticsStore((s) => s.setPendingOperationId);
  const selectTransaction = useDiagnosticsStore((s) => s.selectTransaction);

  // Load initial data on mount
  useEffect(() => {
    refreshTransactions();
  }, [refreshTransactions]);

  // Handle deep-link: auto-select the pending operationId on mount
  useEffect(() => {
    if (pendingOperationId) {
      selectTransaction(pendingOperationId);
      setPendingOperationId(undefined);
    }
  }, [pendingOperationId, selectTransaction, setPendingOperationId]);

  const handleFilterChange = useCallback(
    (key: string, value: unknown) => {
      setFilter(key, value);
      // Refresh on next tick so store state is updated
      setTimeout(() => refreshTransactions(), 0);
    },
    [setFilter, refreshTransactions],
  );

  const handleRangeChange = useCallback(
    (_: unknown, dateStrings: [string, string]) => {
      if (dateStrings[0] && dateStrings[1]) {
        const from = new Date(dateStrings[0]).getTime();
        const to = new Date(dateStrings[1]).getTime();
        setFilter('filterDateRange', [from, to] as [number, number]);
        setTimeout(() => refreshTransactions(), 0);
      } else {
        setFilter('filterDateRange', undefined);
        setTimeout(() => refreshTransactions(), 0);
      }
    },
    [setFilter, refreshTransactions],
  );

  const handleSearch = useCallback(
    (value: string) => {
      setFilter('searchQuery', value);
      setTimeout(() => refreshTransactions(), 0);
    },
    [setFilter, refreshTransactions],
  );

  const handleExport = useCallback(() => {
    // For now: refresh and trigger export
    refreshTransactions();
  }, [refreshTransactions]);

  return (
    <div data-diagnostics-panel>
      {/* Privacy Mode Banner */}
      {privacyMode ? (
        <Alert
          message="Privacy Mode active — content fields hidden."
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {/* Filter Bar */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap size={[8, 8]}>
          <Select
            aria-label="Filter by type"
            placeholder="Type"
            allowClear
            style={{ width: 120 }}
            value={filterType}
            onChange={(val) => handleFilterChange('filterType', val)}
            options={TRANSACTION_TYPE_OPTIONS}
          />
          <Select
            aria-label="Filter by status"
            placeholder="Status"
            allowClear
            style={{ width: 130 }}
            value={filterStatus}
            onChange={(val) => handleFilterChange('filterStatus', val)}
            options={TRANSACTION_STATUS_OPTIONS}
          />
          <Select
            aria-label="Filter by provider"
            placeholder="Provider"
            allowClear
            style={{ width: 140 }}
            value={filterProvider}
            onChange={(val) => handleFilterChange('filterProvider', val)}
          />
          <Select
            aria-label="Filter by severity"
            placeholder="Severity"
            allowClear
            style={{ width: 120 }}
            value={filterSeverity}
            onChange={(val) => handleFilterChange('filterSeverity', val)}
            options={SEVERITY_OPTIONS}
          />
          <RangePicker
            aria-label="Filter by date range"
            onChange={handleRangeChange as never}
          />
          <Input.Search
            aria-label="Search transactions"
            placeholder="Search (ID, model, provider, error)..."
            allowClear
            style={{ width: 240 }}
            value={searchQuery}
            onSearch={handleSearch}
            onChange={(e) => setFilter('searchQuery', e.target.value)}
          />
          <Space>
            <Typography.Text style={{ fontSize: 12 }}>Diagnostic</Typography.Text>
            <Switch
              aria-label="Toggle diagnostic mode"
              checked={diagnosticMode}
              onChange={setDiagnosticMode}
            />
          </Space>
          <Space>
            <Typography.Text style={{ fontSize: 12 }}>Privacy</Typography.Text>
            <Switch
              aria-label="Toggle privacy mode"
              checked={privacyMode}
              onChange={setPrivacyMode}
            />
          </Space>
          <Button onClick={handleExport}>Export</Button>
          <Button onClick={clearFilters}>Clear Filters</Button>
        </Space>
      </div>

      {/* Master-Detail Layout */}
      <Row gutter={12} style={{ height: 'calc(100vh - 200px)' }}>
        <Col span={10} style={{ minWidth: 0 }}>
          <TransactionTable />
        </Col>
        <Col span={14} style={{ minWidth: 0, overflowY: 'auto' }}>
          <TraceDetailPanel />
        </Col>
      </Row>
    </div>
  );
}
