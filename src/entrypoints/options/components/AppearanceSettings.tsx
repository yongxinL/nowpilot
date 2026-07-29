import React from 'react';
import { Select, Typography } from 'antd';
import { useExtensionStore } from '../../../store/useExtensionStore';
import { useThemeStore } from '../../../core/theme/ThemeStore';
import { DisplayMode, ThemeId } from '../../../themes/types';

const { Text } = Typography;

export const AppearanceSettings: React.FC = () => {
  const config = useExtensionStore((s) => s.config);
  const updateConfig = useExtensionStore((s) => s.updateConfig);

  const displayMode = (config.displayMode || config.themeMode || 'auto').toLowerCase() as DisplayMode;

  const currentThemeId = (config.themeId || config.appTheme || 'liquid-glass').toLowerCase();
  const themeValue: ThemeId =
    currentThemeId === 'claude' || (config.appTheme as string) === 'Claude'
      ? 'claude'
      : 'liquid-glass';

  const handleDisplayModeChange = (val: string) => {
    const mode = val as DisplayMode;
    const titleCaseMode = mode === 'auto' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark';
    updateConfig({ displayMode: mode, themeMode: titleCaseMode });
    useThemeStore.getState().setMode(mode);
  };

  const handleThemeChange = (val: string) => {
    const id = val as ThemeId;
    const titleCaseTheme = id === 'claude' ? 'Claude' : 'Liquid Glass';
    updateConfig({ themeId: id, appTheme: titleCaseTheme });
    useThemeStore.getState().setThemeId(id);
  };

  return (
    <div className="p-5 bg-[var(--np-card)] rounded-[24px] border border-[var(--np-border)] space-y-4 shadow-2xs">
      {/* Display Mode Dropdown */}
      <div className="flex items-center justify-between border-b border-[var(--np-border)] pb-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm text-[var(--np-fg)]">Display mode</span>
          <Text className="text-xs text-[var(--np-muted-fg)]">Choose how NowPilot is displayed.</Text>
        </div>
        <Select
          value={displayMode}
          onChange={handleDisplayModeChange}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          className="w-48"
        />
      </div>

      {/* Theme Dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm text-[var(--np-fg)]">Theme</span>
          <Text className="text-xs text-[var(--np-muted-fg)]">Choose the visual theme for NowPilot.</Text>
        </div>
        <Select
          value={themeValue}
          onChange={handleThemeChange}
          options={[
            { value: 'liquid-glass', label: 'Liquid Glass' },
            { value: 'claude', label: 'Claude' },
          ]}
          className="w-48"
        />
      </div>
    </div>
  );
};
