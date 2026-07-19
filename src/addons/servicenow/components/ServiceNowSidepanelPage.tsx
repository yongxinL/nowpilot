import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Alert, Spin, App } from 'antd';
import { ThunderboltOutlined, SearchOutlined, SmileOutlined } from '@ant-design/icons';
import { serviceNowSessionAdapter, type ServiceNowSession } from '../services/ServiceNowSessionAdapter';
import { serviceNowSkillTemplates } from '../skills/serviceNowSkills';
import { useWorkspaceStore } from '../../../core/stores/workspaceStore';

const { Title, Paragraph } = Typography;

const SERVICE_NOW_PATTERN = /\.service-now\.com$/;

const skillIcons: Record<string, React.ReactNode> = {
  'servicenow-case-analyzer': <SearchOutlined />,
  'servicenow-catchup': <ThunderboltOutlined />,
  'servicenow-sentiment': <SmileOutlined />,
};

const skillLabels: Record<string, string> = {
  'servicenow-case-analyzer': 'Analyze case',
  'servicenow-catchup': 'Catch up',
  'servicenow-sentiment': 'Check sentiment',
};

export function ServiceNowSidepanelPage() {
  const { message } = App.useApp();
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const [session, setSession] = useState<ServiceNowSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);

  const acquireSession = useCallback(async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.url) {
        setError('No active tab detected.');
        setLoading(false);
        return;
      }

      const url = new URL(tab.url);
      if (!SERVICE_NOW_PATTERN.test(url.hostname)) {
        setError('No ServiceNow session detected. Open a ServiceNow tab and log in, then try again.');
        setLoading(false);
        return;
      }

      const instance = `${url.protocol}//${url.hostname}`;
      setInstanceUrl(instance);

      const acquiredSession = await serviceNowSessionAdapter.acquireSession(instance, tab.id);
      if (!acquiredSession) {
        setError('No ServiceNow session detected. Open a ServiceNow tab and log in, then try again.');
        setLoading(false);
        return;
      }

      setSession(acquiredSession);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to acquire ServiceNow session';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    setLoading(true);
    acquireSession();
  }, [acquireSession]);

  const handleSkillClick = useCallback(
    (template: string) => {
      setDraft('servicenow', template);
      useWorkspaceStore.getState().setActiveSurface('sidepanel');
    },
    [setDraft],
  );

  // --- Loading state ---
  if (loading) {
    return (
      <div style={{ maxWidth: 720, padding: 16, textAlign: 'center', marginTop: 48 }}>
        <Spin tip="Connecting to ServiceNow..." />
      </div>
    );
  }

  return (
    <div data-options-section="servicenow-sidepanel" style={{ maxWidth: 720, padding: 16 }}>
      <Title level={4}>ServiceNow</Title>

      {/* No session state */}
      {!session && error && (
        <Alert
          type="warning"
          message="No ServiceNow Session"
          description={error}
          showIcon
          action={
            <Button size="small" onClick={acquireSession}>
              Retry
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Error after session was established */}
      {session && error && (
        <Alert
          type="error"
          message="Connection Error"
          description={error}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Case context card — shown when session is active */}
      {session && !error && (
        <>
          <Card
            title="Case Context"
            style={{ marginBottom: 16 }}
            size="small"
          >
            <Paragraph type="secondary">
              Connected to {instanceUrl}
            </Paragraph>
            <Paragraph style={{ marginBottom: 0 }}>
              ServiceNow session active — skills are ready to use.
            </Paragraph>
          </Card>

          {/* Skills card */}
          <Card title="Skills" size="small">
            {serviceNowSkillTemplates.map((skill) => (
              <Button
                key={skill.id}
                block
                style={{ marginBottom: 8, textAlign: 'left' }}
                icon={skillIcons[skill.id]}
                onClick={() => handleSkillClick(skill.template)}
              >
                {skillLabels[skill.id] ?? skill.name}
              </Button>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
