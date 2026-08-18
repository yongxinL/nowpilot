import React from 'react';
import { Tooltip } from 'antd';
import { SunOutlined, MoonOutlined, MonitorOutlined } from '@ant-design/icons';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

const nextMode = (current: ThemeMode): ThemeMode => {
  const idx = MODE_CYCLE.indexOf(current);
  return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
};

const modeIcon = (mode: ThemeMode) => {
  switch (mode) {
    case 'light': return <SunOutlined />;
    case 'dark': return <MoonOutlined />;
    case 'auto': return <MonitorOutlined />;
  }
};

const tooltipText = (mode: ThemeMode) => {
  const next = nextMode(mode);
  switch (next) {
    case 'light': return 'Switch to light mode';
    case 'dark': return 'Switch to dark mode';
    case 'auto': return 'Switch to system theme';
  }
};

export const ThemeToggle: React.FC = () => {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const handleClick = () => {
    setMode(nextMode(mode));
  };

  return (
    <Tooltip title={tooltipText(mode)}>
      <button
        onClick={handleClick}
        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer text-xs flex items-center justify-center"
        aria-label="Toggle theme"
      >
        {modeIcon(mode)}
      </button>
    </Tooltip>
  );
};
