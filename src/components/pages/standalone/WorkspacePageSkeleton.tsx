// src/components/pages/standalone/WorkspacePageSkeleton.tsx — the shared
// standalone workspace empty/skeleton body (UI-SPEC E5 loading row: avatar +
// 2-3 paragraph rows) + a currentPageContext summary card reading
// useWorkspaceStore().workspace.currentPageContext — display only (content
// extraction lands in Phase 4a, so the card renders only when a context exists).
// Display-only — no store mutations, no chrome API calls (Pitfall 4).
import { Card, Skeleton, Typography } from 'antd';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';

export function WorkspacePageSkeleton() {
  const currentPageContext = useWorkspaceStore((s) => s.workspace.currentPageContext);

  return (
    <div>
      <Skeleton avatar active paragraph={{ rows: 3 }} />
      {currentPageContext !== undefined && (
        <Card size="small" title="Current page context">
          <Typography.Text ellipsis>{currentPageContext.title}</Typography.Text>
        </Card>
      )}
    </div>
  );
}
