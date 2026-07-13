import { Empty, Spin, Typography, Tag, Collapse, Progress, Button, Divider } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useDiagnosticsStore } from '../../core/stores/diagnosticsStore';
import { exportSingleTrace, downloadBlob } from '../../core/telemetry/export';
import { ProviderTimeline } from './ProviderTimeline';
import { ToolCallDescriptions } from './ToolCallDescriptions';
import { CacheStats } from './CacheStats';
import type { PromptTrace, MemoryTrace, WriteJournalTrace } from '../../core/telemetry/types';

export function TraceDetailPanel() {
  const selectedOperationId = useDiagnosticsStore((s) => s.selectedOperationId);
  const traceTree = useDiagnosticsStore((s) => s.traceTree);
  const loading = useDiagnosticsStore((s) => s.loading);
  const diagnosticMode = useDiagnosticsStore((s) => s.diagnosticMode);
  const privacyMode = useDiagnosticsStore((s) => s.privacyMode);

  // No transaction selected
  if (!selectedOperationId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="Select a transaction to view details" />
      </div>
    );
  }

  // Loading state
  if (loading || !traceTree) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin tip="Loading trace details..." />
      </div>
    );
  }

  const { transaction, promptTraces, toolTraces, providerTraces, cacheTraces, memoryTraces, writeJournalTraces } =
    traceTree;

  const handleExport = async () => {
    const blob = await exportSingleTrace(selectedOperationId, privacyMode);
    if (blob) {
      downloadBlob(blob, `trace-${selectedOperationId}.json`);
    }
  };

  const statusColorMap: Record<string, string> = {
    completed: 'green',
    failed: 'red',
    aborted: 'orange',
    started: 'blue',
    streaming: 'blue',
  };

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Transaction Header */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Typography.Title level={5} style={{ margin: 0, flex: 1, minWidth: 0 }}>
            <Typography.Text copyable code>
              {selectedOperationId}
            </Typography.Text>
          </Typography.Title>
          <Tag color={statusColorMap[transaction.status] ?? 'default'}>{transaction.status}</Tag>
          {transaction.severity ? <Tag>{transaction.severity}</Tag> : null}
          <span style={{ color: '#666' }}>
            {transaction.durationMs != null ? `${(transaction.durationMs / 1000).toFixed(1)}s` : '—'}
          </span>
          <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            Export
          </Button>
        </div>
        {transaction.errorCode ? (
          <Tag color="red" style={{ marginTop: 4 }}>
            Error: {transaction.errorCode}
          </Tag>
        ) : null}
      </section>

      <Divider style={{ margin: '8px 0' }} />

      {/* Provider Timeline */}
      <section style={{ marginBottom: 16 }}>
        <Typography.Title level={5}>Provider Timeline</Typography.Title>
        <ProviderTimeline providerTraces={providerTraces} />
      </section>

      {/* Tool Call Descriptions */}
      {toolTraces.length > 0 ? (
        <section style={{ marginBottom: 16 }}>
          <Typography.Title level={5}>Tool Calls</Typography.Title>
          <ToolCallDescriptions toolTraces={toolTraces} />
        </section>
      ) : null}

      {/* Cache Stats */}
      {cacheTraces.length > 0 ? (
        <section style={{ marginBottom: 16 }}>
          <Typography.Title level={5}>Cache Stats</Typography.Title>
          <CacheStats cacheTraces={cacheTraces} />
        </section>
      ) : null}

      {/* Prompt Section */}
      {promptTraces.length > 0 ? (
        <section style={{ marginBottom: 16 }}>
          <Typography.Title level={5}>Prompts</Typography.Title>
          {promptTraces.map((pt: PromptTrace) => (
            <div key={pt.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag>{pt.source}</Tag>
                <Typography.Text copyable code style={{ fontSize: 11 }}>
                  {pt.promptHash}
                </Typography.Text>
                <Tag>{pt.contextTier}</Tag>
                {pt.truncated ? <Tag color="orange">Truncated</Tag> : null}
                {pt.minimalMode ? <Tag color="orange">Minimal</Tag> : null}
              </div>
              {pt.cacheStats ? (
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    Cache: {pt.cacheStats.sectionsMarked} sections marked, ~
                    {pt.cacheStats.estimatedSavings} tokens saved
                    {pt.cacheStats.hitRate != null ? `, hit rate ${(pt.cacheStats.hitRate * 100).toFixed(0)}%` : ''}
                  </span>
                </div>
              ) : null}
              {pt.tokenBreakdown ? (
                <div style={{ marginTop: 4 }}>
                  {Object.entries(pt.tokenBreakdown).map(([key, val]) => {
                    if (key === 'total' || val === 0) return null;
                    const pct = pt.tokenBreakdown.total > 0 ? (val / pt.tokenBreakdown.total) * 100 : 0;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ width: 60, fontSize: 11, color: '#666' }}>{key}</span>
                        <Progress
                          percent={Math.round(pct)}
                          size="small"
                          style={{ flex: 1, margin: 0 }}
                          format={() => `${val}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* Memory Section */}
      {memoryTraces.length > 0 ? (
        <section style={{ marginBottom: 16 }}>
          <Typography.Title level={5}>Memory</Typography.Title>
          {memoryTraces.map((mt: MemoryTrace) => (
            <div key={mt.id} style={{ marginBottom: 4 }}>
              <Tag>{mt.phase}</Tag>
              {mt.factsRetrieved != null ? <span>{mt.factsRetrieved} facts retrieved</span> : null}
              {mt.factsExtracted != null ? <span>, {mt.factsExtracted} facts extracted</span> : null}
              {mt.summarized ? <Tag style={{ marginLeft: 4 }}>Summarized</Tag> : null}
              {mt.extractionAttempt != null && mt.extractionAttempt > 1 ? (
                <Tag style={{ marginLeft: 4 }}>Attempt #{mt.extractionAttempt}</Tag>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* WriteJournal Section */}
      {writeJournalTraces.length > 0 ? (
        <section style={{ marginBottom: 16 }}>
          <Typography.Title level={5}>Write Journal</Typography.Title>
          {writeJournalTraces.map((wjt: WriteJournalTrace) => (
            <div key={wjt.id} style={{ marginBottom: 4 }}>
              <Tag>operation: {wjt.operation}</Tag>
              <Tag color={wjt.status === 'completed' ? 'green' : wjt.status === 'failed' ? 'red' : 'default'}>
                {wjt.status}
              </Tag>
              <span>
                {wjt.stepsCount} steps{wjt.recovered ? ', recovered' : ''}
              </span>
              {wjt.failedSteps && wjt.failedSteps.length > 0 ? (
                <span style={{ marginLeft: 4, color: '#ff4d4f' }}>
                  Failed steps: [{wjt.failedSteps.join(', ')}]
                </span>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* Redacted Details Collapse (D-37) */}
      <section style={{ marginBottom: 16 }}>
        {diagnosticMode ? (
          <Collapse
            size="small"
            items={[
              {
                key: 'redacted',
                label: 'Show redacted details',
                children: (
                  <Typography.Text type="secondary">
                    Redacted trace content appears here in diagnostic mode. This is currently
                    placeholder content — full redacted detail rendering will be wired when the
                    trace data pipeline provides serialized redacted traces.
                  </Typography.Text>
                ),
              },
            ]}
          />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Enable Diagnostic Mode to view details
          </Typography.Text>
        )}
      </section>
    </div>
  );
}
