import { Segmented, Space, Typography } from 'antd';
import { THEME_MODES, THEME_PACKS, type ThemeMode, type ThemePack } from '@/core/theme/themeTypes';

const MODE_LABELS: Record<ThemeMode, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

const PACK_LABELS: Record<ThemePack, string> = {
  default: 'Default',
  'liquid-glass': 'Liquid Glass',
  'claude-warm': 'Claude Warm',
};

export interface AppearanceSectionProps {
  mode: ThemeMode;
  pack: ThemePack;
  onModeChange(mode: ThemeMode): void;
  onPackChange(pack: ThemePack): void;
}

export function AppearanceSection({
  mode,
  pack,
  onModeChange,
  onPackChange,
}: AppearanceSectionProps) {
  return (
    <Space direction="vertical" size="middle">
      <Typography.Title level={4} style={{ marginBottom: 0 }}>
        Appearance
      </Typography.Title>
      <Space direction="vertical" size="small">
        <Typography.Text>Display mode</Typography.Text>
        <Segmented
          value={mode}
          options={THEME_MODES.map((value) => ({ value, label: MODE_LABELS[value] }))}
          onChange={(value) => onModeChange(value as ThemeMode)}
        />
      </Space>
      <Space direction="vertical" size="small">
        <Typography.Text>Theme pack</Typography.Text>
        <Segmented
          value={pack}
          options={THEME_PACKS.map((value) => ({ value, label: PACK_LABELS[value] }))}
          onChange={(value) => onPackChange(value as ThemePack)}
        />
      </Space>
    </Space>
  );
}
