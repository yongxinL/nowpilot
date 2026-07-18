import { describe, it, expect } from 'vitest';
import { personaInjector } from '../../../../src/core/ai/persona/PersonaInjector';
import React from 'react';

describe('PersonaInjector', () => {
  // Test 1: inject() prepends PERSONA block
  it('inject() returns string starting with ## PERSONA and ending with the original prompt', () => {
    const result = personaInjector.inject('System instructions.');
    expect(result.startsWith('## PERSONA')).toBe(true);
    expect(result.endsWith('\n\nSystem instructions.')).toBe(true);
  });

  // Test 2: PERSONA block contains identity name and tagline
  it('injected PERSONA block contains identity name and tagline', () => {
    const result = personaInjector.inject('prompt');
    expect(result).toContain('NowPilot');
    expect(result).toContain('Your AI work co-pilot');
  });

  // Test 3: hints append Context-Specific Guidance section
  it('inject with hints appends Context-Specific Guidance subsection', () => {
    const result = personaInjector.inject('prompt', [
      { type: 'user_frustrated', instruction: 'User is frustrated — be extra patient.' },
    ]);
    expect(result).toContain('### Context-Specific Guidance');
    expect(result).toContain('User is frustrated — be extra patient.');
  });

  // Test 4: empty hints array works identically to no hints
  it('inject with empty hints array works identically to no hints', () => {
    const withHints = personaInjector.inject('prompt', []);
    const withoutHints = personaInjector.inject('prompt');
    expect(withHints).toBe(withoutHints);
  });
});

describe('BunnyAvatar', () => {
  // Test 5: BunnyAvatar exports a React functional component with viewBox
  it('BunnyAvatar exports a React component with viewBox 0 0 100 100', async () => {
    const { BunnyAvatar } = await import('../../../../src/components/common/BunnyAvatar');
    expect(BunnyAvatar).toBeDefined();
    expect(typeof BunnyAvatar).toBe('function');
    // Test rendered output contains viewBox
    const div = document.createElement('div');
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(div);
    root.render(React.createElement(BunnyAvatar));
    // Wait a tick for render
    await new Promise((r) => setTimeout(r, 50));
    expect(div.innerHTML).toContain('viewBox="0 0 100 100"');
    root.unmount();
  });
});
