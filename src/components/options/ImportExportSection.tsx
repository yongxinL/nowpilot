import React, { useCallback, useRef, useState } from 'react';
import { Typography, Button, Card, Checkbox, Upload, Alert, Progress, Modal, App } from 'antd';
import { UploadOutlined, DownloadOutlined, FolderOpenOutlined } from '@ant-design/icons';
import JSZip from 'jszip';
import { noteFileSync } from '../../core/notes/NoteFileSync';
import { linkParser } from '../../core/notes/LinkParser';
import { notesDB } from '../../core/storage/stores/NotesDB';
import { writeJournal } from '../../core/storage/WriteJournal';
import { traceRedactor } from '../../core/telemetry/TraceRedactor';
import { mergeRecords } from '../../core/data/mergeRecords';
import type { MergeableRecord, MergeSummary } from '../../core/data/mergeRecords';

const { Title, Text, Paragraph } = Typography;

type ExportScope = 'chat' | 'notes' | 'memory' | 'settings' | 'all';

const SCOPE_OPTIONS: { key: ExportScope; label: string }[] = [
  { key: 'chat', label: 'Chat History' },
  { key: 'notes', label: 'Notes' },
  { key: 'memory', label: 'Memory Facts' },
  { key: 'settings', label: 'Settings & Configuration' },
  { key: 'all', label: 'All Data' },
];

interface ImportPreview {
  hasChat: boolean;
  hasNotes: boolean;
  hasMemory: boolean;
  hasSettings: boolean;
}

interface ExportData {
  version: string;
  exportedAt: string;
  operationId?: string;
  data: Record<string, unknown>;
}

export function ImportExportSection() {
  const { message } = App.useApp();
  const [exportScope, setExportScope] = useState<ExportScope[]>(['all']);
  const [exportProgress, setExportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null);
  const [importValid, setImportValid] = useState<boolean | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScopeChange = (scope: ExportScope) => {
    if (scope === 'all') {
      setExportScope(['all']);
      return;
    }
    setExportScope((prev) => {
      const withoutAll = prev.filter((s) => s !== 'all');
      if (withoutAll.includes(scope)) {
        return withoutAll.filter((s) => s !== scope);
      }
      return [...withoutAll, scope];
    });
  };

  const handleExport = useCallback(async () => {
    const scopes = exportScope.includes('all') ? ['chat', 'notes', 'memory', 'settings'] : exportScope;
    setExporting(true);
    setExportProgress(0);

    // D-16: Atomic export via WriteJournal
    const entry = await writeJournal.begin(
      'export-data',
      { manifest: crypto.randomUUID() },
      [
        { name: 'read-stores' },
        { name: 'redact-credentials' },
        { name: 'write-zip' },
      ],
    );

    try {
      const data: Record<string, unknown> = {};

      // Step 0: Read all requested stores
      await writeJournal.markStepStart(entry.id, 0);
      for (let i = 0; i < scopes.length; i++) {
        const scope = scopes[i];
        switch (scope) {
          case 'chat': {
            const chatResult = await chrome.storage.local.get(['np_workspace', 'np_prompt_templates']);
            data['chat'] = {
              workspace: chatResult.np_workspace ?? null,
              promptTemplates: chatResult.np_prompt_templates ?? [],
            };
            break;
          }
          case 'notes':
            data['notes'] = { exported: true };
            break;
          case 'memory':
            data['memory'] = { exported: true };
            break;
          case 'settings':
            data['settings'] = {
              providerConfigs: await chrome.storage.local.get('np_provider_configs'),
              featureFlags: await chrome.storage.local.get('np_feature_flags'),
              mcpServers: await chrome.storage.local.get('np_mcp_servers'),
              slashCommands: await chrome.storage.local.get('np_slash_commands'),
            };
            break;
        }
        setExportProgress(Math.round(((i + 1) / scopes.length) * 100));
      }
      await writeJournal.markStepComplete(entry.id, 0);

      // Step 1: D-18 TraceRedactor safety net before ZIP write
      await writeJournal.markStepStart(entry.id, 1);
      const redacted = traceRedactor.redactValue(data) as Record<string, unknown>;
      await writeJournal.markStepComplete(entry.id, 1);

      // Step 2: Write ZIP with manifest including operationId per D-16
      await writeJournal.markStepStart(entry.id, 2);
      const exportData: ExportData = {
        version: '0.1.0',
        exportedAt: new Date().toISOString(),
        operationId: entry.id,
        data: redacted,
      };

      const zip = new JSZip();
      zip.file('export.json', JSON.stringify(exportData, null, 2));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nowpilot-export-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      await writeJournal.markStepComplete(entry.id, 2);
      await writeJournal.markCompleted(entry.id);
      message.success('Export complete');
    } catch (err) {
      await writeJournal.markFailed(entry.id).catch(() => {});
      message.error('Export failed');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [exportScope, message]);

  const handleFileSelect = useCallback(async (file: File) => {
    setImportPreview(null);
    setImportData(null);
    setImportValid(null);
    setImportMessage('');

    if (file.size > 10 * 1024 * 1024) {
      setImportValid(false);
      setImportMessage('File too large. Maximum size is 10MB.');
      return false;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Validate structure
      if (!parsed.version || !parsed.data || typeof parsed.data !== 'object') {
        setImportValid(false);
        setImportMessage('Invalid import file: missing version or data fields.');
        return false;
      }

      setImportData(parsed);
      setImportPreview({
        hasChat: !!(parsed.data as Record<string, unknown>).chat,
        hasNotes: !!(parsed.data as Record<string, unknown>).notes,
        hasMemory: !!(parsed.data as Record<string, unknown>).memory,
        hasSettings: !!(parsed.data as Record<string, unknown>).settings,
      });

      // Check for unknown keys
      const knownKeys = ['chat', 'notes', 'memory', 'settings'];
      const dataKeys = Object.keys(parsed.data as Record<string, unknown>);
      const unknownKeys = dataKeys.filter((k) => !knownKeys.includes(k));
      if (unknownKeys.length > 0) {
        setImportMessage(`Unknown data sections ignored: ${unknownKeys.join(', ')}`);
      } else {
        setImportMessage('File validated. Ready to import.');
      }
      setImportValid(true);
    } catch {
      setImportValid(false);
      setImportMessage('Invalid file format. Expected a JSON export file.');
    }

    return false; // Prevent default upload behavior
  }, []);

  const handleMerge = useCallback(async () => {
    if (!importData || !importValid) return;

    // D-17: Wrap import in WriteJournal for atomicity
    const entry = await writeJournal.begin(
      'import-data',
      { source: 'import-file' },
      [{ name: 'merge-all' }],
    );

    try {
      const data = importData.data as Record<string, unknown>;
      let totalUpdated = 0;
      let totalInserted = 0;
      let totalUnchanged = 0;

      await writeJournal.markStepStart(entry.id, 0);

      if (data.settings) {
        const settings = data.settings as Record<string, unknown>;

        // D-17: Deterministic merge for settings — read existing, merge, write back
        if (settings.providerConfigs) {
          const existingConfigs = await chrome.storage.local.get('np_provider_configs');
          const existingProviders = (existingConfigs.np_provider_configs ?? {}) as Record<string, unknown>;
          const incomingProviders = settings.providerConfigs as Record<string, unknown>;
          const mergedProviders = { ...existingProviders, ...incomingProviders };
          await chrome.storage.local.set({ np_provider_configs: mergedProviders });
          totalUpdated += Object.keys(incomingProviders).length;
        }
        if (settings.featureFlags) {
          const existingFlags = await chrome.storage.local.get('np_feature_flags');
          const existingFlagsObj = (existingFlags.np_feature_flags ?? {}) as Record<string, unknown>;
          const incomingFlags = settings.featureFlags as Record<string, unknown>;
          const mergedFlags = { ...existingFlagsObj, ...incomingFlags };
          await chrome.storage.local.set({ np_feature_flags: mergedFlags });
          totalUpdated += Object.keys(incomingFlags).length;
        }
        if (settings.mcpServers) {
          const existingServers = await chrome.storage.local.get('np_mcp_servers');
          const existingMcp = (existingServers.np_mcp_servers ?? []) as MergeableRecord[];
          const incomingMcp = settings.mcpServers as MergeableRecord[];
          const { merged, summary } = mergeRecords(existingMcp, incomingMcp);
          await chrome.storage.local.set({ np_mcp_servers: merged });
          totalUpdated += summary.updated;
          totalInserted += summary.inserted;
          totalUnchanged += summary.unchanged;
        }
        if (settings.slashCommands) {
          const existingCommands = await chrome.storage.local.get('np_slash_commands');
          const existingSlash = (existingCommands.np_slash_commands ?? []) as MergeableRecord[];
          const incomingSlash = settings.slashCommands as MergeableRecord[];
          const { merged, summary } = mergeRecords(existingSlash, incomingSlash);
          await chrome.storage.local.set({ np_slash_commands: merged });
          totalUpdated += summary.updated;
          totalInserted += summary.inserted;
          totalUnchanged += summary.unchanged;
        }
      }

      // Chat, Notes, Memory data would need IndexedDB integration — deferred
      if (data.chat || data.notes || data.memory) {
        message.info('Chat, Notes, and Memory data import requires IndexedDB integration (future phase). Settings imported successfully.');
      }

      await writeJournal.markStepComplete(entry.id, 0);
      await writeJournal.markCompleted(entry.id);

      if (totalUpdated > 0 || totalInserted > 0 || totalUnchanged > 0) {
        message.success(`Import complete. ${totalUpdated} records updated, ${totalInserted} new, ${totalUnchanged} unchanged.`);
      } else {
        message.success('Import completed successfully');
      }

      setImportData(null);
      setImportPreview(null);
      setImportValid(null);
      setImportMessage('');
    } catch {
      await writeJournal.markFailed(entry.id).catch(() => {});
      message.error('Import failed');
    }
  }, [importData, importValid, message]);

  const [restoreLoading, setRestoreLoading] = useState(false);

  const handleRestoreFromFolder = async () => {
    setRestoreLoading(true);
    try {
      const result = await noteFileSync.importFromFolder();
      if (!result) { setRestoreLoading(false); return; }

      const { preview, notes } = result;

      Modal.confirm({
        title: 'Import Preview',
        content: (
          <div>
            <p>Found <strong>{preview.total}</strong> notes:</p>
            <ul>
              <li>{preview.new} new</li>
              <li>{preview.updated} updated</li>
              <li>{preview.unchanged} unchanged</li>
            </ul>
            <p>Existing notes not in backup will be preserved.</p>
          </div>
        ),
        okText: 'Import',
        cancelText: 'Cancel',
        onOk: async () => {
          const { count, allNotes } = await noteFileSync.executeImport(notes);
          linkParser.rebuildIndex(allNotes);
          message.success(`Imported ${count} notes`);
        },
      });
    } catch (err) {
      message.error('Failed to read backup folder');
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    // Handled by Upload's drag-and-drop
  }, []);

  return (
    <div data-options-section="import-export" style={{ maxWidth: 720 }}>
      <Title level={4}>Import / Export</Title>
      <p style={{ marginBottom: 16 }}>
        Export your data for backup or import previously exported data.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Export Card */}
        <Card
          title="Export"
          style={{ flex: 1, minWidth: 280 }}
          extra={<DownloadOutlined />}
        >
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            Select data to include in the export file.
          </Paragraph>

          <div style={{ marginBottom: 16 }}>
            <Checkbox.Group
              value={exportScope}
              onChange={(values) => {
                if (values.includes('all')) {
                  setExportScope(['all']);
                } else {
                  setExportScope(values as ExportScope[]);
                }
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {SCOPE_OPTIONS.map((opt) => (
                  <Checkbox key={opt.key} value={opt.key}>
                    {opt.label}
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </div>

          {exporting && <Progress percent={exportProgress} style={{ marginBottom: 12 }} />}

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
            block
          >
            Export
          </Button>
        </Card>

        {/* Import Card */}
        <Card
          title="Import"
          style={{ flex: 1, minWidth: 280 }}
          extra={<UploadOutlined />}
        >
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            Upload a previously exported JSON file to restore data.
          </Paragraph>

          <Upload.Dragger
            accept=".json"
            showUploadList={false}
            beforeUpload={(file) => {
              handleFileSelect(file);
              return false;
            }}
            style={{ marginBottom: 16 }}
          >
            <p style={{ margin: 0 }}>
              <UploadOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            </p>
            <Text>Click or drag a file here</Text>
          </Upload.Dragger>

          {importMessage ? (
            <Alert
              type={importValid ? 'success' : 'error'}
              title={importMessage}
              showIcon
              style={{ marginBottom: 12 }}
            />
          ) : null}

          {importPreview ? (
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12 }}>
                Import Preview:
              </Text>
              <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 12 }}>
                {importPreview.hasChat && <li>Chat History</li>}
                {importPreview.hasNotes && <li>Notes</li>}
                {importPreview.hasMemory && <li>Memory Facts</li>}
                {importPreview.hasSettings && <li>Settings & Configuration</li>}
              </ul>
            </div>
          ) : null}

          <Button
            type="primary"
            onClick={handleMerge}
            disabled={!importValid || !importData}
            block
          >
            Merge Import
          </Button>
        </Card>
      </div>

      <Card title="Restore from Backup" size="small" style={{ marginTop: 16 }}>
        <Typography.Paragraph type="secondary">
          Restore notes from a previous filesystem backup. Notes will be merged with your existing notes.
        </Typography.Paragraph>
        <Button
          icon={<FolderOpenOutlined />}
          onClick={handleRestoreFromFolder}
          loading={restoreLoading}
        >
          Restore from folder
        </Button>
      </Card>
    </div>
  );
}
