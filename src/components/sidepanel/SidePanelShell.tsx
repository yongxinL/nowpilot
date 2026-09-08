import { useEffect, useState } from 'react';
import { Avatar, Button, Tooltip, Typography } from 'antd';
import { ExpandAltOutlined, SettingOutlined } from '@ant-design/icons';
import { CommandPalette } from '@/components/CommandPalette';
import { OnboardingModal } from '@/components/OnboardingModal';
import { startWorkspaceSync } from '@/core/workspace/WorkspaceSync';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';
import { SidePanelRouter } from './SidePanelRouter';

export function SidePanelShell() {
  const [onboardingOpen, setOnboardingOpen] = useState(true);

  useEffect(() => startWorkspaceSync('sidepanel'), []);

  const handleOpenStandalone = async () => {
    await WorkspaceRouter.openStandalone();
  };

  const handleOpenOptions = async () => {
    await WorkspaceRouter.openStandalone({ page: 'options' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
      >
        <Avatar size="small" style={{ backgroundColor: '#3B82F6' }}>
          N
        </Avatar>
        <Typography.Text strong style={{ marginLeft: 8 }}>
          NowPilot
        </Typography.Text>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Tooltip title="Options">
            <Button
              type="text"
              icon={<SettingOutlined />}
              aria-label="Options"
              onClick={handleOpenOptions}
            />
          </Tooltip>
          <Tooltip title="Switch to Full chat">
            <Button
              type="text"
              icon={<ExpandAltOutlined />}
              aria-label="Switch to Full chat"
              onClick={handleOpenStandalone}
            />
          </Tooltip>
        </div>
      </div>
      <SidePanelRouter />
      <CommandPalette />
      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}
