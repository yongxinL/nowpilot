// src/components/standalone/StandaloneRouter.tsx — standalone surface selector
// (entry root mounted in 01-09). Renders StandaloneShell with page routing
// driven by StandalonePageRegistry ids (01-07) — 'chat' is the default landing
// page; navigateToPage (the standalone router action) sets the active page and
// backs the Cmd+K 'Open Options' command (W-8). Pure store/registry-driven
// selector — no extension API calls (Pitfall 4/P5). navigateToPage/
// useStandaloneNav are re-exported here (their module avoids a
// CmdKPicker↔router import cycle).
import { StandaloneShell } from '@/components/standalone/StandaloneShell';
import { useStandaloneNav } from '@/components/standalone/standaloneNav';

export { navigateToPage, useStandaloneNav } from '@/components/standalone/standaloneNav';

export function StandaloneRouter() {
  const activePageId = useStandaloneNav((s) => s.activePageId);
  return <StandaloneShell activePageId={activePageId} />;
}
