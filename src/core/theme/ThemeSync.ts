import { useEffect } from 'react';
import { subscribe, publish } from '../runtime/BroadcastBus';
import { useThemeStore, type ThemeMode } from './ThemeStore';

interface ThemeChangeMessage {
  type: 'THEME_CHANGED';
  mode: ThemeMode;
}

/**
 * Hook that subscribes to the 'np_theme' BroadcastChannel and applies
 * theme changes broadcast from other extension surfaces (Side Panel ↔ Full App Tab).
 *
 * Must be called in both surface shells for bidirectional theme sync.
 */
export function useThemeSync(): void {
  useEffect(() => {
    const unsubscribe = subscribe<ThemeChangeMessage>('np_theme', (msg) => {
      if (msg.type === 'THEME_CHANGED') {
        useThemeStore.getState().setMode(msg.mode);
      }
    });
    return unsubscribe;
  }, []);
}

/**
 * Publish a theme change to the 'np_theme' BroadcastChannel so other
 * surfaces can react immediately.
 */
export function publishThemeChange(mode: ThemeMode): void {
  publish('np_theme', { type: 'THEME_CHANGED', mode });
}
