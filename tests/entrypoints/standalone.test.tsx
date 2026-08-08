// tests/entrypoints/standalone.test.tsx — 01-09 mount smoke test for the
// standalone entry root (Appendix F.3). Imports the REAL entrypoint module and
// renders its exported createStandaloneApp() tree in jsdom; the module-scope
// createRoot mount is inert (no #root element in jsdom). Asserts:
//   (a) the tree mounts without throwing,
//   (b) exactly one provider renders (single `.ant-app` — XProvider extends
//       antd's provider, Appendix F/§5.5),
//   (c) the StandaloneShell header (STR.standalone.openTitle) renders,
//   (d) the lifted mod+k capture opens the Cmd+K palette (controlled picker).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createStandaloneApp } from '@/entrypoints/standalone/main';
import { STR } from '@/core/i18n/strings';

describe('standalone entrypoint mount', () => {
  it('mounts the tree without throwing and renders the shell header', async () => {
    const { container } = render(createStandaloneApp());
    expect(await screen.findByText(STR.standalone.openTitle)).toBeTruthy();
    expect(container.querySelectorAll('.ant-app').length).toBe(1);
  });

  it('renders exactly one provider wrapper (single XProvider, Appendix F)', async () => {
    const { container } = render(createStandaloneApp());
    await screen.findByText(STR.standalone.openTitle);
    expect(container.querySelectorAll('.ant-app').length).toBe(1);
  });

  it('opens the Cmd+K palette via the lifted global mod+k capture (controlled picker)', async () => {
    render(createStandaloneApp());
    await screen.findByText(STR.standalone.openTitle);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByPlaceholderText(STR.cmdk.placeholder)).toBeTruthy();
  });
});
