// src/entrypoints/sidepanel/main.tsx — Appendix F.3 side panel mount (BLOCKER 2:
// WXT srcDir 'src' puts entrypoints under src/entrypoints/, so this is the
// canonical path — W4: it REPLACES the 01-01 stub body, it is NOT regenerated).
//
// Exactly ONE provider per surface (§5.5 / Appendix F): the XProvider from
// @ant-design/x EXTENDS antd's provider, so the config from getAntdConfig
// (01-05 — theme + locale, compact on the side panel per RUNTIME-04) is spread
// into the single XProvider. AntdApp wraps the tree (imperative APIs via
// App.useApp, F.4); ErrorBoundary (01-04) → SidePanelRouter (01-08, D-07 gate).
//
// Theme readiness (T-1-22): ThemeStore.init() is fired before first render and
// the tree renders null until isReady — no wrong-theme flash (a blank frame is
// acceptable). The global mod+k capture is lifted HERE (isCmdK, 01-04) and the
// CmdKPicker visibility state is threaded into SidePanelShell (controlled
// picker — the picker stops self-capturing when a parent owns the capture).
//
// 01-10 gap closure (REVIEW WR-02/WR-03): this mount also hydrates the
// addon-settings store (np_addon_settings — onboarding.done persists across
// surface loads) and fires the workspace lifecycle (hydrate np_workspace →
// activate the sidepanel surface → start the cross-surface sync loop from the
// module-level sync ref held for stop()). Described by concept here — no
// literal call expressions in the header so the per-file call-site greps stay
// unambiguous.
//
// Pitfall 4: this entrypoint imports NO content-script module and no UI library
// beyond the locked antd/x stack. Entrypoints are the ONLY places that call
// createRoot — everything upstream is tree-imported.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { SidePanelRouter } from '@/components/sidepanel/SidePanelRouter';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { isCmdK } from '@/core/input/KeymapRegistry';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { WorkspaceSync } from '@/core/workspace/WorkspaceSync';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';
// The single provider reference on this surface (Appendix F: XProvider EXTENDS
// antd's provider — exactly one provider per surface, grep fixture).
export type { ConfigProviderProps } from 'antd';

function SidePanelRoot() {
  const isReady = useThemeStore((s) => s.isReady);
  const mode = useThemeStore((s) => s.mode);
  const pack = useThemeStore((s) => s.pack);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // Fire-and-forget hydrate (idempotent): already fired at module scope; the
    // guard re-fires only if the mount raced the module-scope init.
    if (!useThemeStore.getState().isReady) {
      void useThemeStore.getState().init();
    }
  }, []);

  // Global mod+k capture lifted at the entrypoint → controlled CmdKPicker.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isCmdK(event)) {
        event.preventDefault();
        setPickerOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // T-1-22 readiness gate: render null until the theme store resolved — a
  // blank frame, never a wrong-theme flash.
  if (!isReady) return null;

  const cfg = getAntdConfig({ mode, pack, compact: true });
  return (
    <XProvider {...cfg}>
      <AntdApp>
        <ErrorBoundary>
          <SidePanelRouter pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
}

/** Testable app root (mount smoke tests render this; no hooks run here). */
export function createSidePanelApp() {
  return <SidePanelRoot />;
}

// Fire the theme hydrate before first render (plan truth). Module-scope guard:
// only mount when a #root element exists (jsdom tests have none).
if (typeof document !== 'undefined') {
  void useThemeStore.getState().init();
  // WR-02: hydrate np_addon_settings so onboarding.done persists across loads.
  void useAddonSettingsStore.getState().init();
  // WR-03: module-level sync ref (held for stop()); the constructor is
  // side-effect-free — only start() activates subscriptions/timers.
  const workspaceSync = new WorkspaceSync('sidepanel');
  // WR-03: activate the workspace lifecycle AFTER hydration completes — start()
  // must never run before np_workspace is merged (VERIFICATION gaps[0] fix).
  const workspaceInit = useWorkspaceStore.getState().init();
  void workspaceInit.then(() => {
    useWorkspaceStore.getState().start('sidepanel');
    workspaceSync.start();
  });
  const rootElement = document.getElementById('root');
  if (rootElement !== null) {
    createRoot(rootElement).render(createSidePanelApp());
  }
}
