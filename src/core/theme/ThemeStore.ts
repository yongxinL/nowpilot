import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  ThemeModeSchema,
  ThemePackSchema,
  type ThemeMode,
  type ThemePack,
} from './themeTypes';

export interface ThemePreferences {
  mode: ThemeMode;
  pack: ThemePack;
}

export interface ThemeStore {
  read(): Promise<ThemePreferences>;
  writeMode(mode: ThemeMode): Promise<void>;
  writePack(pack: ThemePack): Promise<void>;
  subscribe(listener: (preferences: ThemePreferences) => void): () => void;
}

export function createThemeStore(storage: ValidatedStorage): ThemeStore {
  async function read(): Promise<ThemePreferences> {
    const modeResult = await storage.read('np_theme', ThemeModeSchema);
    const packResult = await storage.read('np_theme_pack', ThemePackSchema);
    if (modeResult.status === 'invalid') {
      debugLog(createErrorRecord('THEME_INVALID_VALUE', { key: 'np_theme' }));
    }
    if (packResult.status === 'invalid') {
      debugLog(createErrorRecord('THEME_INVALID_VALUE', { key: 'np_theme_pack' }));
    }
    return {
      mode: modeResult.status === 'valid' ? modeResult.value : DEFAULT_THEME_MODE,
      pack: packResult.status === 'valid' ? packResult.value : DEFAULT_THEME_PACK,
    };
  }

  return {
    read,
    async writeMode(mode) {
      try {
        await storage.write('np_theme', ThemeModeSchema, mode);
      } catch {
        debugLog(createErrorRecord('THEME_PERSIST_FAILED', { key: 'np_theme' }));
        throw new Error('THEME_PERSIST_FAILED');
      }
    },
    async writePack(pack) {
      try {
        await storage.write('np_theme_pack', ThemePackSchema, pack);
      } catch {
        debugLog(createErrorRecord('THEME_PERSIST_FAILED', { key: 'np_theme_pack' }));
        throw new Error('THEME_PERSIST_FAILED');
      }
    },
    subscribe(listener) {
      const emit = () => {
        void read().then(listener);
      };
      const offMode = storage.subscribe('np_theme', ThemeModeSchema, emit);
      const offPack = storage.subscribe('np_theme_pack', ThemePackSchema, emit);
      return () => {
        offMode();
        offPack();
      };
    },
  };
}
