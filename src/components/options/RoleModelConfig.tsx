import { useEffect, useState } from 'react';
import { Select, Typography, Alert, App, theme } from 'antd';
import { useProviderStore } from '../../core/stores/providerStore';
import { getRoleModelConfig, setRoleModelConfig } from '../../core/storage/roleModelConfig';
import type { RoleModelConfig } from '../../core/storage/roleModelConfig';
import type { ModelEntry } from '../../core/ai/providers/providerTypes';

const ROLES: { key: keyof RoleModelConfig; label: string; description: string }[] = [
  { key: 'planner', label: 'Planner', description: 'Determines the next action (tool call or answer). Uses the cheapest capable model.' },
  { key: 'renderer', label: 'Renderer', description: 'Generates the final response text to the user.' },
  { key: 'memory', label: 'Memory Extraction', description: 'Extracts user facts and conversation summaries after each turn.' },
];

const DEFAULT_OPTION = '__default__';

export function RoleModelConfig() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const modelEntries = useProviderStore((s) => s.modelEntries);

  const [config, setConfig] = useState<RoleModelConfig>({ planner: null, renderer: null, memory: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getRoleModelConfig().then((c) => {
      setConfig(c);
      setLoaded(true);
    });
  }, []);

  const missingModels: { role: string; modelId: string }[] = [];
  for (const role of ROLES) {
    const modelId = config[role.key];
    if (modelId && !modelEntries.some((m: ModelEntry) => m.modelId === modelId)) {
      missingModels.push({ role: role.label, modelId });
    }
  }

  const handleChange = async (role: keyof RoleModelConfig, value: string) => {
    const newConfig = { ...config, [role]: value === DEFAULT_OPTION ? null : value };
    setConfig(newConfig);
    await setRoleModelConfig(newConfig);
    message.success(`${ROLES.find((r) => r.key === role)?.label} model updated`);
  };

  const optionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 12,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 14,
    color: token.colorText,
    minWidth: 140,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 12,
    color: token.colorTextSecondary,
    lineHeight: '18px',
  };

  return (
    <div data-role-model-config style={{ padding: '8px 0' }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Role-Specific Model Assignment
      </Typography.Title>
      <Typography.Paragraph style={{ fontSize: 13, color: token.colorTextSecondary }}>
        Assign a specific model to each role. Leave as "Use active model" to use the model
        selected in the chat dropdown. If a model becomes unavailable, a warning will appear here.
      </Typography.Paragraph>

      {missingModels.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Models no longer available"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {missingModels.map((m) => (
                <li key={m.role}>
                  <strong>{m.role}</strong>: "{m.modelId}" — this model is no longer enabled or available.
                  Please select a different model below.
                </li>
              ))}
            </ul>
          }
        />
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ROLES.map((role) => {
          const currentValue = config[role.key] ?? DEFAULT_OPTION;
          const isMissing = missingModels.some((m) => m.role === role.label);

          return (
            <div key={role.key} style={optionStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 140 }}>
                  <div style={labelStyle}>{role.label}</div>
                  <div style={descStyle}>{role.description}</div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Select
                    style={{ width: '100%' }}
                    value={currentValue}
                    onChange={(val) => handleChange(role.key, val)}
                    status={isMissing ? 'error' : undefined}
                    options={[
                      { value: DEFAULT_OPTION, label: 'Use active model (default)' },
                      ...modelEntries.map((m: ModelEntry) => ({
                        value: m.modelId,
                        label: `${m.providerId} / ${m.modelId}`,
                      })),
                    ]}
                  />
                  {isMissing ? (
                    <div style={{ color: token.colorWarning, fontSize: 12, marginTop: 4 }}>
                      Previously selected model is no longer available. Pick a new one.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
