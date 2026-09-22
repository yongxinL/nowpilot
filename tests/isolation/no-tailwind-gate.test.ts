import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Self-test for `scripts/verify-no-tailwind.sh` (plan `01-13` Task 1; WR-01).
 *
 * The gate's first version only matched the utility token *inside* a
 * `className="…"` literal or immediately after `className={`, so a class string
 * held in a variable (`color: 'text-emerald-500'` rendered as
 * `className={tag.color}`) passed while three Tailwind strings shipped. This
 * suite runs the real script against fixture trees and proves the value scan
 * still catches that shape — a gate that can silently stop covering its target
 * is the defect, not just the strings it missed.
 *
 * Read-only with respect to the repository: the fixtures live in a temp
 * directory, and the script is invoked with the optional scan-root argument.
 */

const SCRIPT = join(process.cwd(), 'scripts', 'verify-no-tailwind.sh');

const tempDirs: string[] = [];

function fixtureRoot(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'np-tailwind-gate-'));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf8');
  }
  return dir;
}

function runGate(scanRoot: string): { status: number | null; output: string } {
  const result = spawnSync('bash', [SCRIPT, scanRoot], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('verify-no-tailwind.sh — value scan (WR-01)', () => {
  it('fails on a Tailwind class held in a variable and rendered as className={variable}', () => {
    const root = fixtureRoot({
      'Leaky.tsx': [
        "const tag = { name: 'ServiceNow', color: 'text-emerald-500' };",
        'export const Tag = () => <TagOutlined className={tag.color} />;',
        '',
      ].join('\n'),
    });

    const { status, output } = runGate(root);

    expect(status).toBe(1);
    expect(output).toContain('Leaky.tsx');
    expect(output).toContain('text-emerald-500');
  });

  it('fails on a bare group class string', () => {
    const root = fixtureRoot({
      'Bare.tsx': 'export const Row = () => <div className="group" />;\n',
    });

    const { status, output } = runGate(root);

    expect(status).toBe(1);
    expect(output).toContain('group');
  });

  it('passes a legitimate AntD/inline-style tree without false positives', () => {
    const root = fixtureRoot({
      'Clean.tsx': [
        'const style = {',
        "  display: 'flex',",
        "  justifyContent: 'space-between',",
        "  fontFamily: 'var(--font-sans)',",
        "  borderColor: 'var(--border)',",
        "  transition: 'color 150ms ease, background 150ms ease',",
        "  maxWidth: 'max-content',",
        '};',
        "export const id = 'fixture-wh-1';",
        'export const Row = () => <div style={style} className="np-fade-in" />;',
        '',
      ].join('\n'),
    });

    const { status, output } = runGate(root);

    expect(output).toContain('0 Tailwind utility strings');
    expect(status).toBe(0);
  });

  it('refuses to report a pass for a scan root that does not exist', () => {
    const { status, output } = runGate(join(tmpdir(), 'np-tailwind-gate-missing-root'));

    expect(status).toBe(1);
    expect(output).toContain('does not exist');
  });
});
