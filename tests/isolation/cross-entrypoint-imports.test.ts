import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('cross-entrypoint import isolation', () => {
  it('no sidepanel files import from app/', () => {
    const result = execSync(
      `grep -r "from.*components/app" src/components/sidepanel/ 2>/dev/null || true`,
    ).toString();
    const lines = result
      .split('\n')
      .filter((line) => line.trim() !== '' && !/^\s*\/\//.test(line));
    expect(lines).toHaveLength(0);
  });

  it('no app files import from sidepanel/', () => {
    const result = execSync(
      `grep -r "from.*components/sidepanel" src/components/app/ 2>/dev/null || true`,
    ).toString();
    const lines = result
      .split('\n')
      .filter((line) => line.trim() !== '' && !/^\s*\/\//.test(line));
    expect(lines).toHaveLength(0);
  });

  it('no common components import from app/ or sidepanel/', () => {
    const sidepanelResult = execSync(
      `grep -r "from.*components/app" src/components/common/ 2>/dev/null || true`,
    ).toString();
    const appResult = execSync(
      `grep -r "from.*components/sidepanel" src/components/common/ 2>/dev/null || true`,
    ).toString();
    const sidepanelLines = sidepanelResult
      .split('\n')
      .filter((line) => line.trim() !== '' && !/^\s*\/\//.test(line));
    const appLines = appResult
      .split('\n')
      .filter((line) => line.trim() !== '' && !/^\s*\/\//.test(line));
    expect(sidepanelLines).toHaveLength(0);
    expect(appLines).toHaveLength(0);
  });
});
