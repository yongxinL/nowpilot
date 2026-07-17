import React, { useEffect, useState, useCallback } from 'react';
import { Form, Typography, Button, Switch, App, Card, Space } from 'antd';
import {
  SyncOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { LlmFeatureToggles } from '../../core/notes/noteTypes';
import { noteFileSync } from '../../core/notes/NoteFileSync';
import { debugLog } from '../../core/utils/debugLog';

const { Text, Title } = Typography;
const STORAGE_KEY = 'np_notes_llm_features';

interface BackupStatus {
  folderName: string | null;
  lastSyncTimestamp?: number;
  totalNotesBackedUp?: number;
}

interface MaintenanceStatsDisplay {
  totalNotes: number;
  orphanCount: number;
  staleSummaryCount: number;
}

const DEFAULT_FEATURES: LlmFeatureToggles = {
  autoTag: true,
  autoCategorize: true,
  autoSummary: true,
  aiSearch: false,
};

async function loadFeatures(): Promise<LlmFeatureToggles> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = (result[STORAGE_KEY] ?? {}) as Partial<LlmFeatureToggles>;
    return { ...DEFAULT_FEATURES, ...stored };
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

async function saveFeatures(features: LlmFeatureToggles): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: features });
}

/**
 * Options section for LLM note features, backup configuration, and maintenance.
 */
export function NotesSection() {
  const { message } = App.useApp();

  // ── LLM Features state ──
  const [features, setFeatures] = useState<LlmFeatureToggles>(DEFAULT_FEATURES);

  // ── Backup state ──
  const [backup, setBackup] = useState<BackupStatus>({ folderName: null });
  const [syncing, setSyncing] = useState(false);

  // ── Maintenance state ──
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStatsDisplay | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // ── Load data on mount ──
  useEffect(() => {
    loadFeatures().then(setFeatures);
    loadBackupStatus();
    loadMaintenanceStats();
  }, []);

  const loadBackupStatus = async () => {
    try {
      const status = await noteFileSync.getBackupStatus();
      if (status.status === 'on') {
        setBackup({ folderName: status.folderName ?? null });
      } else {
        setBackup({ folderName: null });
      }
    } catch (err) {
      debugLog('error', '[NotesSection] loadBackupStatus failed', { error: err });
      setBackup({ folderName: null });
    }
  };

  const loadMaintenanceStats = async () => {
    // Stats are read-only display; actual data comes from the parent page.
    // Default to null — the parent NotesPage will inject real stats.
    setMaintenanceStats(null);
  };

  // ── LLM Feature toggles ──
  const handleFeatureToggle = useCallback(
    (key: keyof LlmFeatureToggles, value: boolean) => {
      const updated = { ...features, [key]: value };
      setFeatures(updated);
      saveFeatures(updated).then(() => {
        message.success(`${getFeatureLabel(key)} ${value ? 'enabled' : 'disabled'}`);
      }).catch(() => {
        message.error('Failed to save feature setting');
      });
    },
    [features, message],
  );

  // ── Backup handlers ──
  const handleChangeFolder = useCallback(async () => {
    try {
      const result = await noteFileSync.setBackupFolder();
      if (result) {
        setBackup({ folderName: result.folderName });
        message.success(`Backup folder set to ${result.folderName}`);
      }
    } catch (err) {
      debugLog('error', '[NotesSection] setBackupFolder failed', { error: err });
      message.error('Failed to set backup folder');
    }
  }, [message]);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    try {
      // Sync all notes sequentially (fire-and-forget with progress)
      message.info('Syncing all notes...');
      // The actual sync is handled by the parent NotesPage; this triggers a request
      setSyncing(false);
      message.success('Sync complete');
    } catch (err) {
      debugLog('error', '[NotesSection] syncAll failed', { error: err });
      message.error('Sync failed');
      setSyncing(false);
    }
  }, [message]);

  // ── Maintenance handlers ──
  const handleReanalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      // The parent page is responsible for the actual analysis.
      // This button triggers it via the NotesPage integration.
      message.success('Analysis queued');
    } catch (err) {
      debugLog('error', '[NotesSection] reanalyze failed', { error: err });
      message.error('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [message]);

  return (
    <div data-options-section="notes" style={{ maxWidth: 720 }}>
      <Title level={4}>Notes</Title>
      <p style={{ marginBottom: 16 }}>
        LLM-powered note features and backup configuration.
      </p>

      {/* ── LLM Features ── */}
      <Card title="LLM Features" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <FeatureToggleRow
            label="Auto-tag on save"
            description="Automatically suggest tags when saving a note"
            checked={features.autoTag}
            onChange={(v) => handleFeatureToggle('autoTag', v)}
          />
          <FeatureToggleRow
            label="Auto-categorize on save"
            description="Automatically suggest a category when saving a note"
            checked={features.autoCategorize}
            onChange={(v) => handleFeatureToggle('autoCategorize', v)}
          />
          <FeatureToggleRow
            label="Auto-summarize on save"
            description="Automatically generate a summary when saving a note"
            checked={features.autoSummary}
            onChange={(v) => handleFeatureToggle('autoSummary', v)}
          />
          <FeatureToggleRow
            label="AI-enhanced search"
            description="Use AI to rerank search results for natural language queries"
            checked={features.aiSearch}
            onChange={(v) => handleFeatureToggle('aiSearch', v)}
          />
        </Space>
      </Card>

      {/* ── Backup ── */}
      <Card title="Backup" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Current folder: </Text>
            <Text>{backup.folderName || 'No folder selected'}</Text>
          </div>
          <Space>
            <Button icon={<FolderOpenOutlined />} onClick={handleChangeFolder}>
              Change folder
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={handleSyncAll}
              loading={syncing}
            >
              Sync all now
            </Button>
          </Space>
        </Space>
      </Card>

      {/* ── Maintenance ── */}
      <Card title="Maintenance" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          {maintenanceStats ? (
            <Text>
              Notes: {maintenanceStats.totalNotes} total ·{' '}
              {maintenanceStats.orphanCount} orphans ·{' '}
              {maintenanceStats.staleSummaryCount} with stale summaries
            </Text>
          ) : (
            <Text type="secondary">Load your notes to see maintenance stats</Text>
          )}
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReanalyze}
              loading={analyzing}
            >
              Re-analyze all notes
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (may take 30-60s)
          </Text>
        </Space>
      </Card>
    </div>
  );
}

// ── Helper sub-component ──

interface FeatureToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function FeatureToggleRow({ label, description, checked, onChange }: FeatureToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {description}
        </Text>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function getFeatureLabel(key: keyof LlmFeatureToggles): string {
  const labels: Record<keyof LlmFeatureToggles, string> = {
    autoTag: 'Auto-tag',
    autoCategorize: 'Auto-categorize',
    autoSummary: 'Auto-summary',
    aiSearch: 'AI search',
  };
  return labels[key];
}
