import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandRegistry, registerDefaultCommands } from '@/core/commands/CommandRegistry';

describe('CommandRegistry', () => {
  beforeEach(() => {
    CommandRegistry.clear();
  });

  it('registers and looks up commands', () => {
    CommandRegistry.register({ id: 'cmd', label: 'Cmd', handler: () => {} });
    expect(CommandRegistry.get('cmd')).toBeDefined();
    expect(CommandRegistry.list()).toHaveLength(1);
  });

  it('executes a command handler', async () => {
    let called = false;
    CommandRegistry.register({
      id: 'exec',
      label: 'Exec',
      handler: () => {
        called = true;
      },
    });
    await CommandRegistry.execute('exec');
    expect(called).toBe(true);
  });

  it('is idempotent on duplicate registration', () => {
    CommandRegistry.register({ id: 'dup', label: 'Dup', handler: () => {} });
    CommandRegistry.register({ id: 'dup', label: 'Dup2', handler: () => {} });
    expect(CommandRegistry.get('dup')?.label).toBe('Dup');
  });

  it('filters visible commands by when clause', () => {
    CommandRegistry.register({
      id: 'side',
      label: 'Side',
      when: 'in-side-panel',
      handler: () => {},
    });
    CommandRegistry.register({ id: 'always', label: 'Always', handler: () => {} });

    const sideVisible = CommandRegistry.getVisible('sidepanel').map((c) => c.id);
    expect(sideVisible).toContain('side');
    expect(sideVisible).toContain('always');

    const standaloneVisible = CommandRegistry.getVisible('standalone').map((c) => c.id);
    expect(standaloneVisible).not.toContain('side');
    expect(standaloneVisible).toContain('always');
  });

  it('registers the default Flow 10 command set', () => {
    registerDefaultCommands();
    const ids = CommandRegistry.list().map((c) => c.id);
    expect(ids).toContain('open-standalone');
    expect(ids).toContain('focus-side-panel');
    expect(ids).toContain('open-options');
  });
});
