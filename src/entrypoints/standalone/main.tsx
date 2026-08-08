// src/entrypoints/standalone/main.tsx — Appendix F.3 standalone mount
// (BLOCKER 2 / W4: canonical path src/entrypoints/standalone/, REPLACES the
// 01-01 stub body, does NOT regenerate). The standalone opens as an extension
// TAB via the 01-06 update-or-create dedupe (W-12) — no popup window
// dimensions apply here.
//
// Mirrors the side panel mount (01-09 Task 1): exactly ONE provider per surface
// (§5.5 / Appendix F) — the XProvider from @ant-design/x EXTENDS antd's
// provider, so the getAntdConfig (01-05) config is spread into the single
// XProvider with the DEFAULT density (compact: false per RUNTIME-04). AntdApp →
// ErrorBoundary (01-04) → StandaloneRouter (01-08). Theme readiness gate
// (T-1-22) + lifted global mod+k capture (isCmdK → controlled CmdKPicker) —
// identical to the side panel entrypoint. Pitfall 4: no content-script module
// imports; entrypoints are the ONLY createRoot call sites.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { StandaloneRouter } from '@/components/standalone/StandaloneRouter';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { isCmdK } from '@/core/input/KeymapRegistry';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
// The single provider reference on this surface (Appendix F: XProvider EXTENDS
// antd's provider — exactly one provider per surface, grep fixture).
export type { ConfigProviderProps } from 'antd';

function StandaloneRoot() {
  const isReady = useThemeStore((s) => s.isReady);
  const mode = useThemeStore((s) => s.mode);
  const pack = useThemeStore((s) => s.pack);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // Fire-and-forget hydrate (idempotent): re-fires only if the mount raced
    // the module-scope init.
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

  const cfg = getAntdConfig({ mode, pack, compact: false });
  return (
    <XProvider {...cfg}>
      <AntdApp>
        <ErrorBoundary>
          <StandaloneRouter pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
}

/** Testable app root (mount smoke tests render this; no hooks run here). */
export function createStandaloneApp() {
  return <StandaloneRoot />;
}

// Fire the theme hydrate before first render (plan truth). Module-scope guard:
// only mount when a #root element exists (jsdom tests have none).
if (typeof document !== 'undefined') {
  void useThemeStore.getState().init();
  const rootElement = document.getElementById('root');
  if (rootElement !== null) {
    createRoot(rootElement).render(<StandaloneRoot />);
  }
}
