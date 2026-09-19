import { useEffect, useState } from 'react';
import { Card, Typography } from 'antd';
import { getChromeStorage, createValidatedStorage } from '@/core/storage/chromeStorage';
import { createThemeStore, type ThemeStore } from '@/core/theme/ThemeStore';
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PACK,
  type ThemeMode,
  type ThemePack,
} from '@/core/theme/themeTypes';
import { AppearanceSection } from './AppearanceSection';

export interface OptionsPageProps {
  store?: ThemeStore;
}

export function OptionsPage({ store }: OptionsPageProps) {
  const [themeStore] = useState<ThemeStore>(
    () => store ?? createThemeStore(createValidatedStorage(getChromeStorage())),
  );
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [pack, setPack] = useState<ThemePack>(DEFAULT_THEME_PACK);

  useEffect(() => {
    let active = true;
    const unsubscribe = themeStore.subscribe((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    void themeStore.read().then((preferences) => {
      if (!active) return;
      setMode(preferences.mode);
      setPack(preferences.pack);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [themeStore]);

  return (
    <section data-testid="standalone-page-options" aria-label="Options">
      <Typography.Title level={3}>General</Typography.Title>
      <Card>
        <AppearanceSection
          mode={mode}
          pack={pack}
          onModeChange={(next) => {
            setMode(next);
            void themeStore.writeMode(next);
          }}
          onPackChange={(next) => {
            setPack(next);
            void themeStore.writePack(next);
          }}
        />
      </Card>
    </section>
  );
}
