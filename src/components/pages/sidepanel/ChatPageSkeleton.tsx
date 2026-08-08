// src/components/pages/sidepanel/ChatPageSkeleton.tsx — the shared chat
// empty/skeleton body (UI-SPEC E2 loading row: avatar + 2-3 paragraph rows on
// the 8/12/16 px rhythm, DESIGN_SYSTEM.md §9 — skeletons over spinners).
// ChatPage (Task 3) renders this for its skeleton block; the shell renders
// ChatPage. Display-only — no chat logic (chat lands in its phase).
import { Skeleton } from 'antd';

export function ChatPageSkeleton() {
  return (
    <div>
      <Skeleton avatar active paragraph={{ rows: 3 }} />
    </div>
  );
}
