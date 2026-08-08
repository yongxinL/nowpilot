// src/components/pages/AgentPage.tsx — §18 canonical page (W-6 flat name).
// Renders the UI-SPEC E5 Agent empty state — verbatim copy 'Agent runs land
// here.' — over the shared WorkspacePageSkeleton (E5 loading row: avatar + 2-3
// paragraph rows on the 8/12/16 px rhythm). No agent orchestration logic in
// Phase 1 (Planner→Executor→Renderer lands with the chat phase). Wrapped in
// ErrorBoundary. No chrome API calls (Pitfall 4).
import { Card, Empty, Typography } from 'antd';
import { WorkspacePageSkeleton } from '@/components/pages/standalone/WorkspacePageSkeleton';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';

// UI-SPEC Copywriting Contract — E5 Agent empty state (verbatim).
const AGENT_EMPTY_COPY = 'Agent runs land here.';

export function AgentPage() {
  return (
    <ErrorBoundary>
      <Card>
        <WorkspacePageSkeleton />
        <Empty description={AGENT_EMPTY_COPY}>
          <Typography.Text type="secondary">Agent mode is a Chat mode</Typography.Text>
        </Empty>
      </Card>
    </ErrorBoundary>
  );
}
