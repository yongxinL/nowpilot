import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Self-test for `scripts/verify-no-tailwind.sh` (plan `01-13` Task 1; WR-01,
 * WR-08).
 *
 * The gate's first version only matched the utility token *inside* a
 * `className="…"` literal or immediately after `className={`, so a class string
 * held in a variable (`color: 'text-emerald-500'` rendered as
 * `className={tag.color}`) passed while three Tailwind strings shipped. This
 * suite runs the real script against fixture trees and proves the value scan
 * still catches that shape — a gate that can silently stop covering its target
 * is the defect, not just the strings it missed.
 *
 * WR-08: the rebuilt gate was family-blind — its vocabulary covered
 * colour/number-shaped utilities but none of the display/layout/typography
 * families, so `'flex items-center justify-between'`, `'hidden'`,
 * `'absolute inset-0'`, `'grid grid-cols-3'`, `'truncate whitespace-nowrap'`
 * and `'leading-tight tracking-wide'` all reported a clean pass. Each probed
 * string is pinned **in isolation** below, so a family that silently drops out
 * of the vocabulary fails loudly instead of hiding behind its siblings.
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

describe('verify-no-tailwind.sh — family coverage (WR-08)', () => {
  // The strings the WR-08 probe ran against the rebuilt gate, each one alone in
  // its own fixture so no family can hide behind another.
  const probedStrings: Array<[family: string, classString: string]> = [
    ['display/layout list', 'flex items-center justify-between'],
    ['display/layout bare keyword', 'hidden'],
    ['display/layout inset', 'absolute inset-0'],
    ['display/layout grid', 'grid grid-cols-3'],
    ['typography list', 'truncate whitespace-nowrap'],
    ['typography leading/tracking', 'leading-tight tracking-wide'],
  ];

  it.each(probedStrings)('fails on a %s held in a string value', (_family, classString) => {
    const root = fixtureRoot({
      'Leak.tsx': `export const leaked = '${classString}';\n`,
    });

    const { status, output } = runGate(root);

    expect(status).toBe(1);
    expect(output).toContain('Leak.tsx');
  });

  // The probed strings above also carry a Tier-2 bare keyword, so on their own
  // they would still pass with a Tier-1 family removed. These pin the
  // unambiguous families themselves: every string is keyword-free, so only the
  // family vocabulary can report it.
  const familyStrings: Array<[family: string, classString: string]> = [
    ['layout list', 'items-center justify-between'],
    ['layout grid', 'grid-cols-3 col-span-2'],
    ['layout min/max', 'min-w-0 max-w-md'],
    ['layout overflow', 'overflow-hidden'],
    ['typography whitespace', 'whitespace-nowrap'],
    ['typography leading/tracking', 'leading-tight tracking-wide'],
    ['typography bare utilities', 'truncate sr-only'],
    ['interaction list', 'cursor-pointer select-none'],
    ['interaction transition', 'transition-colors duration-150 ease-in-out'],
    ['interaction animation', 'animate-spin'],
    ['interaction pointer events', 'pointer-events-none'],
    ['shape/effect list', 'rounded-lg font-semibold'],
    ['sizing list', 'p-4 gap-2'],
    ['colour list', 'text-emerald-500'],
    ['variant list', 'hover:bg-gray-100'],
    ['aspect list', 'aspect-square'],
  ];

  it.each(familyStrings)('fails on a %s held in a string value', (_family, classString) => {
    const root = fixtureRoot({
      'Leak.tsx': `export const leaked = '${classString}';\n`,
    });

    const { status, output } = runGate(root);

    expect(status).toBe(1);
    expect(output).toContain('Leak.tsx');
  });

  it.each([
    ['a class attribute', 'export const Row = () => <div className="np-fade-in hidden" />;\n'],
    ['a class attribute expression', "export const Row = () => <div className={'hidden'} />;\n"],
    ['a data object value', "const props = { className: 'hidden' };\n"],
    ['a double-quoted string', 'export const leaked = "hidden";\n'],
  ])('fails on a bare keyword held in %s', (_shape, source) => {
    const root = fixtureRoot({ 'Leak.tsx': source });

    const { status, output } = runGate(root);

    expect(status).toBe(1);
    expect(output).toContain('Leak.tsx');
  });

  it('passes the non-class value contexts the bare keywords legitimately appear in', () => {
    const root = fixtureRoot({
      'Clean.tsx': [
        'const style = {',
        "  display: 'flex',",
        "  position: 'absolute',",
        "  overflow: 'hidden',",
        "  visibility: isHovered ? 'visible' : 'hidden',",
        "  textTransform: 'uppercase',",
        "  textDecoration: 'underline',",
        '};',
        "export type Gate = 'reading' | 'present' | 'hidden';",
        'export const Row = () => <div style={style} variant="block" />;',
        "export const Inline = ({ variant = 'inline' }: { variant?: string }) => (",
        "  <span data-x={variant === 'block' ? 'inline' : 'block'} />",
        ');',
        '',
      ].join('\n'),
    });

    const { status, output } = runGate(root);

    expect(output).toContain('0 Tailwind utility strings');
    expect(status).toBe(0);
  });
});
