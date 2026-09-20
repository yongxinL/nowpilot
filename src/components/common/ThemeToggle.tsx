import React, { useEffect, useState } from 'react';
import { Segmented, Typography, App as AntdApp, theme } from 'antd';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { applyThemeToSync, startThemeOnChangedSync } from '../../core/theme/ThemeSync';

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/**
 * Plan 01-07 (D-10 UI half, REQ-F12): visible, propagating theme Segmented
 * control mounted in BOTH the Side Panel header (ChatHeader) and the
 * Standalone top chrome (WorkspaceSidebar). Same component, no per-surface
 * copy (APPR-04).
 *
 * Behavior:
 *   - Toggling is local-first: the in-memory mode updates immediately, no
 *     remount, no flicker (APPR-04).
 *   - The same write is fanned out via `applyThemeToSync` (chrome.storage.sync).
 *   - Other surfaces receive the change via `startThemeOnChangedSync`
 *     (chrome.storage.onChanged listener, scoped to the `sync` area).
 *   - A failed sync write surfaces an actionable `message.error` toast —
 *     "Couldn't apply theme to other surface" with a "Try syncing again"
 *     link that re-invokes the failed write. The LOCAL mode is NOT rolled
 *     back (local-first, per 01-UI-SPEC.md Copywriting Contract).
 */
export const ThemeToggle: React.FC = () => {
  const { token } = theme.useToken();
  const mode = useThemeStore((s) => s.mode);
  const pack = useThemeStore((s) => s.pack);
  const setMode = useThemeStore((s) => s.setMode);
  const { message: antMessage } = AntdApp.useApp();
  // Avoid an SSR/no-chrome fallback that would otherwise `useEffect` on
  // undefined — keep the subscription opt-in to chrome.storage presence.
  const hasStorageOnChanged =
    typeof chrome !== 'undefined' && Boolean(chrome?.storage?.onChanged);

  useEffect(() => {
    if (!hasStorageOnChanged) return;
    return startThemeOnChangedSync();
  }, [hasStorageOnChanged]);

  const handleChange = async (next: string | number) => {
    const nextMode = next as ThemeMode;
    if (nextMode === mode) return;

    // Local-first: the in-memory mode updates immediately so the user
    // sees the change without waiting on the async cross-surface write.
    setMode(nextMode);

    const result = await applyThemeToSync(nextMode, pack);
    if (result.ok) {
      // No success toast on every toggle — the Segmented control's own
      // selected-state move IS the visible success signal (UI-SPEC).
      // A success toast would be noisy during a 3x rapid-toggle sweep.
      return;
    }

    // The sync write failed — surface an actionable toast. The local
    // mode is NOT rolled back; the retry affordance lets the user
    // explicitly try the cross-surface sync again.
    const tryAgain = (
      <Typography.Link
        onClick={() => {
          void handleChange(nextMode);
        }}
      >
        Try syncing again
      </Typography.Link>
    );
    antMessage.error({
      content: (
        <span>
          Couldn't apply theme to other surface — {tryAgain}
        </span>
      ),
      duration: 4,
    });
  };

  return (
    <div
      data-testid="theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: token.paddingXXS,
      }}
    >
      <Segmented
        aria-label="Theme mode"
        value={mode}
        onChange={(v) => void handleChange(v)}
        options={THEME_OPTIONS}
        size="small"
        style={{
          background: token.colorFillTertiary,
        }}
      />
    </div>
  );
};
