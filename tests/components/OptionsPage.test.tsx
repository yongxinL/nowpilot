import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ConfigProvider, App as AntApp } from 'antd';
import { OptionsPage } from '../../src/core/pages/OptionsPage';

// Mock chrome.storage.local globally (already in setup.ts, but ensure for these tests)
beforeEach(() => {
  vi.clearAllMocks();
});

function setup(jsx: React.ReactElement) {
  return render(
    <ConfigProvider>
      <AntApp>{jsx}</AntApp>
    </ConfigProvider>,
  );
}

describe('OptionsPage section routing', () => {
  it('renders GeneralSection for sectionId general', () => {
    const { container } = setup(<OptionsPage sectionId="general" />);
    const el = container.querySelector('[data-options-section="general"]');
    expect(el).toBeTruthy();
  });

  it('renders SidebarSection for sectionId sidebar', () => {
    const { container } = setup(<OptionsPage sectionId="sidebar" />);
    const el = container.querySelector('[data-options-section="sidebar"]');
    expect(el).toBeTruthy();
  });

  it('renders TranslateSection for sectionId translate', () => {
    const { container } = setup(<OptionsPage sectionId="translate" />);
    const el = container.querySelector('[data-options-section="translate"]');
    expect(el).toBeTruthy();
  });

  it('renders ProvidersSection for sectionId providers', () => {
    const { container } = setup(<OptionsPage sectionId="providers" />);
    const el = container.querySelector('[data-options-section="providers"]');
    expect(el).toBeTruthy();
  });

  it('renders ModelsSection for sectionId models', () => {
    const { container } = setup(<OptionsPage sectionId="models" />);
    const el = container.querySelector('[data-options-section="models"]');
    expect(el).toBeTruthy();
  });

  it('renders MCPSection for sectionId mcp', () => {
    const { container } = setup(<OptionsPage sectionId="mcp" />);
    const el = container.querySelector('[data-options-section="mcp"]');
    expect(el).toBeTruthy();
  });

  it('renders PromptsSection for sectionId prompts', () => {
    const { container } = setup(<OptionsPage sectionId="prompts" />);
    const el = container.querySelector('[data-options-section="prompts"]');
    expect(el).toBeTruthy();
  });

  it('renders SlashSection for sectionId slash', () => {
    const { container } = setup(<OptionsPage sectionId="slash" />);
    const el = container.querySelector('[data-options-section="slash"]');
    expect(el).toBeTruthy();
  });

  it('renders MemorySection for sectionId memory', () => {
    const { container } = setup(<OptionsPage sectionId="memory" />);
    const el = container.querySelector('[data-options-section="memory"]');
    expect(el).toBeTruthy();
  });

  it('renders AppearanceSection for sectionId appearance', () => {
    const { container } = setup(<OptionsPage sectionId="appearance" />);
    const el = container.querySelector('[data-options-section="appearance"]');
    expect(el).toBeTruthy();
  });

  it('renders DiagnosticsSection for sectionId diagnostics', () => {
    const { container } = setup(<OptionsPage sectionId="diagnostics" />);
    const el = container.querySelector('[data-options-section="diagnostics"]');
    expect(el).toBeTruthy();
  });

  it('renders ImportExportSection for sectionId import-export', () => {
    const { container } = setup(<OptionsPage sectionId="import-export" />);
    const el = container.querySelector('[data-options-section="import-export"]');
    expect(el).toBeTruthy();
  });

  it('renders FeatureFlagsSection for sectionId feature-flags', () => {
    const { container } = setup(<OptionsPage sectionId="feature-flags" />);
    const el = container.querySelector('[data-options-section="feature-flags"]');
    expect(el).toBeTruthy();
  });

  it('renders AddonSettingsSection for sectionId addons', () => {
    const { container } = setup(<OptionsPage sectionId="addons" />);
    const el = container.querySelector('[data-options-section="addons"]');
    expect(el).toBeTruthy();
  });

  it('renders AboutSection for sectionId about', () => {
    const { container } = setup(<OptionsPage sectionId="about" />);
    const el = container.querySelector('[data-options-section="about"]');
    expect(el).toBeTruthy();
  });

  it('renders AdvancedSection for sectionId advanced', () => {
    const { container } = setup(<OptionsPage sectionId="advanced" />);
    const el = container.querySelector('[data-options-section="advanced"]');
    expect(el).toBeTruthy();
  });

  it('renders default placeholder for unknown sectionId', () => {
    const { container } = setup(<OptionsPage sectionId="unknown-section" />);
    expect(container.querySelector('.ant-card')).toBeTruthy();
    expect(container.textContent).toContain('unknown-section');
  });

  it('defaults to general section when no sectionId provided', () => {
    const { container } = setup(<OptionsPage />);
    const el = container.querySelector('[data-options-section="general"]');
    expect(el).toBeTruthy();
  });
});
