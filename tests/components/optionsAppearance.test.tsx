import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppearanceSection } from '@/components/options/AppearanceSection';
import { OptionsPage } from '@/components/options/OptionsPage';
import type { ThemePreferences, ThemeStore } from '@/core/theme/ThemeStore';

afterEach(cleanup);

describe('AppearanceSection', () => {
  it('renders display mode and theme pack controls with the approved options', () => {
    render(
      <AppearanceSection
        mode="auto"
        pack="default"
        onModeChange={() => {}}
        onPackChange={() => {}}
      />,
    );
    expect(screen.getByText('Display mode')).toBeInTheDocument();
    expect(screen.getByText('Theme pack')).toBeInTheDocument();
    for (const option of ['Auto', 'Light', 'Dark']) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }
    for (const option of ['Default', 'Liquid Glass', 'Claude Warm']) {
      expect(screen.getByText(option)).toBeInTheDocument();
    }
  });

  it('reports mode and pack changes', () => {
    const onModeChange = vi.fn();
    const onPackChange = vi.fn();
    render(
      <AppearanceSection
        mode="auto"
        pack="default"
        onModeChange={onModeChange}
        onPackChange={onPackChange}
      />,
    );
    fireEvent.click(screen.getByText('Dark'));
    expect(onModeChange).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByText('Liquid Glass'));
    expect(onPackChange).toHaveBeenCalledWith('liquid-glass');
  });
});

describe('OptionsPage', () => {
  it('renders only the General → Appearance controls', () => {
    const store: ThemeStore = {
      read: vi.fn(async (): Promise<ThemePreferences> => ({ mode: 'auto', pack: 'default' })),
      writeMode: vi.fn(async () => {}),
      writePack: vi.fn(async () => {}),
      subscribe: vi.fn(() => () => {}),
    };
    render(<OptionsPage store={store} />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Display mode')).toBeInTheDocument();
    expect(screen.getByText('Theme pack')).toBeInTheDocument();
    expect(screen.queryByText('Providers')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument();
  });
});
