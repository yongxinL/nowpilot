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

export interface StandaloneRouterProps {
  /** Controlled Cmd+K palette visibility (lifted at the 01-09 entrypoint). */
  pickerOpen?: boolean;
  /** Controlled Cmd+K palette visibility change callback. */
  onPickerOpenChange?: (open: boolean) => void;
}

export function StandaloneRouter({ pickerOpen, onPickerOpenChange }: StandaloneRouterProps = {}) {
  const activePageId = useStandaloneNav((s) => s.activePageId);
  return (
    <StandaloneShell
      activePageId={activePageId}
      pickerOpen={pickerOpen}
      onPickerOpenChange={onPickerOpenChange}
    />
  );
}
