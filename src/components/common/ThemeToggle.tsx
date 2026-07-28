import React from 'react';
import { Button, Tooltip, App } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { t } from '../../core/i18n/strings';

const nextMode: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
};

const modeIcon: Record<ThemeMode, React.ReactNode> = {
  light: <SunOutlined />,
  dark: <MoonOutlined />,
  auto: <SunOutlined />,
};

const modeTooltip: Record<ThemeMode, string> = {
  light: t('theme.switchToDark'),
  dark: t('theme.switchToLight'),
  auto: t('theme.toggle'),
};

const modeLabel: Record<ThemeMode, string> = {
  light: t('theme.light'),
  dark: t('theme.dark'),
  auto: t('theme.auto'),
};

export const ThemeToggle: React.FC = () => {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const { message } = App.useApp();

  const handleClick = () => {
    const next = nextMode[mode];
    setMode(next);
    message.info(modeLabel[next]);
  };

  return (
    <Tooltip title={modeTooltip[mode]}>
      <Button
        type="text"
        size="small"
        icon={modeIcon[mode]}
        onClick={handleClick}
        aria-label={t('theme.toggle')}
      />
    </Tooltip>
  );
};
