import { Input, Typography } from 'antd';
import { STR } from '@/core/i18n/strings';

export function SidePanelRouter() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <Typography.Text type="secondary">{STR.chat.empty}</Typography.Text>
      </div>
      <div style={{ padding: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <Input placeholder="Ask anything, @ models, / prompts" aria-label="Chat input" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            No provider configured
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}
