import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('cross-entrypoint import isolation', () => {
  it('entrypoints do not import from other entrypoint directories', () => {
    const sidepanelImports = execSync(
      `grep -r "from.*entrypoints/standalone\\|from.*entrypoints/options" entrypoints/sidepanel/ 2>/dev/null || true`,
    ).toString();
    const standaloneImports = execSync(
      `grep -r "from.*entrypoints/sidepanel\\|from.*entrypoints/options" entrypoints/standalone/ 2>/dev/null || true`,
    ).toString();
    const optionsImports = execSync(
      `grep -r "from.*entrypoints/sidepanel\\|from.*entrypoints/standalone" entrypoints/options/ 2>/dev/null || true`,
    ).toString();
    const lines = [sidepanelImports, standaloneImports, optionsImports]
      .join('')
      .split('\n')
      .filter(l => l.trim() && !/^\s*\/\//.test(l) && !l.includes('entrypoints/options/components'));
    expect(lines).toHaveLength(0);
  });

  it('no sidepanel files import from app/ components', () => {
    const result = execSync(
      `test -d src/components/sidepanel && grep -r "from.*components/app" src/components/sidepanel/ 2>/dev/null || true`,
    ).toString();
    const lines = result.split('\n').filter(l => l.trim() && !/^\s*\/\//.test(l));
    expect(lines).toHaveLength(0);
  });

  it('no app files import from sidepanel/ components', () => {
    const result = execSync(
      `test -d src/components/app && grep -r "from.*components/sidepanel" src/components/app/ 2>/dev/null || true`,
    ).toString();
    const lines = result.split('\n').filter(l => l.trim() && !/^\s*\/\//.test(l));
    expect(lines).toHaveLength(0);
  });

  it('common components do not import from surface-specific component dirs', () => {
    const sidepanelResult = execSync(
      `grep -r "from.*components/sidepanel" src/components/common/ 2>/dev/null || true`,
    ).toString();
    const appResult = execSync(
      `grep -r "from.*components/app" src/components/common/ 2>/dev/null || true`,
    ).toString();
    const standaloneResult = execSync(
      `grep -r "from.*components/standalone" src/components/common/ 2>/dev/null || true`,
    ).toString();
    const lines = [sidepanelResult, appResult, standaloneResult]
      .join('')
      .split('\n')
      .filter(l => l.trim() && !/^\s*\/\//.test(l));
    expect(lines).toHaveLength(0);
  });


});
