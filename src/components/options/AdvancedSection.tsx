import React, { useState } from 'react';
import { Tabs, Button, Typography, App, theme } from 'antd';
import { OnboardingModal } from '../../core/onboarding/OnboardingModal';
import { MemorySection } from './MemorySection';
import { ImportExportSection } from './ImportExportSection';
import { FeatureFlagsSection } from './FeatureFlagsSection';
import { RoleModelConfig } from './RoleModelConfig';
import { DiagnosticsSection } from './DiagnosticsSection';

const { Title, Paragraph } = Typography;

export function AdvancedSection() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleFactoryReset = async () => {
    try {
      await chrome.storage.local.clear();
      message.success('Factory reset completed successfully. All settings cleared.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      message.error('Failed to reset settings');
    }
  };

  const optionCard: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    marginBottom: 24,
  };

  const cardContentStyle: React.CSSProperties = {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    color: token.colorText,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: token.colorTextSecondary,
  };

  const renderOnboardingTab = () => (
    <div style={{ marginTop: 24 }}>
      {/* Onboarding Setup Card */}
      <div style={optionCard}>
        <div style={cardContentStyle}>
          <div style={labelStyle}>Onboarding Setup</div>
          <div style={descStyle}>
            Verify your current installation settings, check workspace connectivity, or run the initial welcome walkthrough again.
          </div>
          <div>
            <Button
              type="primary"
              onClick={() => setShowOnboarding(true)}
              style={{ borderRadius: 9999, height: 38, fontWeight: 500, paddingInline: 20 }}
            >
              Relaunch Welcome Onboarding
            </Button>
          </div>
        </div>
      </div>

      {/* Factory Reset Card */}
      <div style={optionCard}>
        <div style={cardContentStyle}>
          <div style={{ ...labelStyle, color: token.colorError }}>Factory Reset</div>
          <div style={descStyle}>
            Clears all locally stored credentials, prompts, history logs, and databases. This action is irreversible.
          </div>
          <div>
            <Button
              danger
              type="primary"
              onClick={handleFactoryReset}
              style={{ borderRadius: 9999, height: 38, fontWeight: 500, paddingInline: 20 }}
            >
              Reset to Default
            </Button>
          </div>
        </div>
      </div>

      <OnboardingModal open={showOnboarding} onComplete={() => setShowOnboarding(false)} />
    </div>
  );

  const tabItems = [
    {
      key: 'onboarding',
      label: 'Onboarding & Verification',
      children: renderOnboardingTab(),
    },
    {
      key: 'memory',
      label: 'Memory',
      children: (
        <div style={{ marginTop: 24 }}>
          <MemorySection />
        </div>
      ),
    },
    {
      key: 'backup',
      label: 'Backup & Data',
      children: (
        <div style={{ marginTop: 24 }}>
          <ImportExportSection />
        </div>
      ),
    },
    {
      key: 'flags',
      label: 'Feature Flags',
      children: (
        <div style={{ marginTop: 24 }}>
          <FeatureFlagsSection />
        </div>
      ),
    },
    {
      key: 'models',
      label: 'Role Models',
      children: (
        <div style={{ marginTop: 24 }}>
          <RoleModelConfig />
        </div>
      ),
    },
    {
      key: 'diagnostics',
      label: 'Diagnostics & Debugging',
      children: (
        <div style={{ marginTop: 24 }}>
          <DiagnosticsSection />
        </div>
      ),
    },
  ];

  return (
    <div data-options-section="advanced" style={{ paddingBottom: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Advanced</Title>
          <Paragraph style={{ color: token.colorTextSecondary, marginTop: 8, fontSize: 14 }}>
            Configure advanced developer tools, diagnostic tracing, local memory, feature flags, and settings backup.
          </Paragraph>
        </div>

        <Tabs defaultActiveKey="onboarding" items={tabItems} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}
