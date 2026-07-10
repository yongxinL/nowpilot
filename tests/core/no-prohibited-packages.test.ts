import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const PACKAGE_JSON = join(REPO_ROOT, 'package.json');

const PROHIBITED_PACKAGES = [
  'tailwindcss',
  '@tailwindcss/vite',
  'shadcn',
  '@radix-ui',
  'framer-motion',
  '@ant-design/x-sdk',
  '@ant-design/x-card',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
];

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function packageNames(deps: Record<string, string> | undefined): string[] {
  if (!deps) return [];
  return Object.keys(deps);
}

describe('SETUP-05/06 — Prohibited packages not present in package.json', () => {
  it('package.json does not declare any prohibited package (tailwindcss, shadcn, @radix-ui, framer-motion, @ant-design/x-sdk, @ant-design/x-card, etc.)', () => {
    const raw = readFileSync(PACKAGE_JSON, 'utf-8');
    const pkg = JSON.parse(raw) as PackageJsonShape;
    const declared = [...packageNames(pkg.dependencies), ...packageNames(pkg.devDependencies)];

    const violations = PROHIBITED_PACKAGES.filter((prohibited) =>
      declared.some((name) => name === prohibited || name.startsWith(`${prohibited}/`) || name.startsWith(`${prohibited}-`)),
    );

    expect(violations).toEqual([]);
  });
});
