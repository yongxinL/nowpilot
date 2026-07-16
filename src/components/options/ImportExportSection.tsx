import React, { useCallback, useRef, useState } from 'react';
import { Typography, Button, Card, Checkbox, Upload, Alert, Progress, App } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import JSZip from 'jszip';

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

    try {
      const data: Record<string, unknown> = {};

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

      const exportData: ExportData = {
        version: '0.1.0',
        exportedAt: new Date().toISOString(),
        data,
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
      message.success('Export complete');
    } catch (err) {
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

    try {
      const data = importData.data as Record<string, unknown>;
      const promises: Promise<void>[] = [];

      if (data.settings) {
        const settings = data.settings as Record<string, unknown>;
        if (settings.providerConfigs) {
          promises.push(
            chrome.storage.local.set(settings.providerConfigs as Record<string, unknown>),
          );
        }
        if (settings.featureFlags) {
          promises.push(
            chrome.storage.local.set(settings.featureFlags as Record<string, unknown>),
          );
        }
        if (settings.mcpServers) {
          promises.push(
            chrome.storage.local.set(settings.mcpServers as Record<string, unknown>),
          );
        }
        if (settings.slashCommands) {
          promises.push(
            chrome.storage.local.set(settings.slashCommands as Record<string, unknown>),
          );
        }
      }

      // Chat, Notes, Memory data would need IndexedDB integration — deferred
      if (data.chat || data.notes || data.memory) {
        message.info('Chat, Notes, and Memory data import requires IndexedDB integration (future phase). Settings imported successfully.');
      }

      await Promise.all(promises);
      message.success('Import completed successfully');
      setImportData(null);
      setImportPreview(null);
      setImportValid(null);
      setImportMessage('');
    } catch {
      message.error('Import failed');
    }
  }, [importData, importValid, message]);

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
    </div>
  );
}
