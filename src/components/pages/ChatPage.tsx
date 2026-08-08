// src/components/pages/ChatPage.tsx — §18 canonical page (W-6 flat name; shared
// by the Side Panel shell and the Standalone shell; Agent is a Chat MODE, so
// this page hosts the empty chat surface). Renders the chat empty state
// (STR.chat.empty/loading from 01-02) in an antd Empty/Card over the shared
// ChatPageSkeleton block — NO chat messages state, NO send flow (chat lands in
// its phase; minimal mode is NOT part of this phase — I2). Wrapped in
// ErrorBoundary (01-04). No chrome API calls (Pitfall 4).
import { Card, Empty, Typography } from 'antd';
import { ChatPageSkeleton } from '@/components/pages/sidepanel/ChatPageSkeleton';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { STR } from '@/core/i18n/strings';

export function ChatPage() {
  return (
    <ErrorBoundary>
      <Card>
        <ChatPageSkeleton />
        <Empty description={STR.chat.empty}>
          <Typography.Text type="secondary">{STR.chat.loading}</Typography.Text>
        </Empty>
      </Card>
    </ErrorBoundary>
  );
}
