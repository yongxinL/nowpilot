import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..') + '/';
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as {
  packageManager: string;
  type: string;
  engines: { node: string };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const EXACT_DEPENDENCIES: Record<string, string> = {
  react: '19.3.0',
  'react-dom': '19.3.0',
  antd: '6.6.4',
  '@ant-design/icons': '6.3.4',
  zustand: '5.0.15',
  zod: '4.6.5',
};

const EXACT_DEV_DEPENDENCIES: Record<string, string> = {
  wxt: '0.21.4',
  '@wxt-dev/module-react': '1.2.2',
  vite: '8.3.0',
  typescript: '5.9.3',
  '@types/react': '19.3.0',
  '@types/react-dom': '19.3.0',
  '@types/node': '24.13.6',
  '@types/chrome': '0.3.0',
  eslint: '10.11.0',
  'typescript-eslint': '8.70.0',
  prettier: '3.9.8',
  vitest: '5.0.1',
  jsdom: '30.1.0',
  '@testing-library/react': '16.3.3',
  '@testing-library/dom': '10.4.2',
  '@testing-library/jest-dom': '7.0.1',
};

const REQUIRED_SCRIPTS = [
  'typecheck',
  'lint',
  'test',
  'build',
  'test:manifest',
  'test:isolation',
  'verify:phase-1',
  'verify:all',
];

const VERIFY_CHAIN =
  'pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build && pnpm run test:manifest && pnpm run test:isolation';

describe('toolchain configuration', () => {
  it('uses the pinned package manager, module type, and node engines', () => {
    expect(pkg.packageManager).toBe('pnpm@12.4.2');
    expect(pkg.type).toBe('module');
    expect(pkg.engines.node).toBe('^22.22.2 || ^24.15.0 || >=26.0.0');
  });

  it('pins every runtime and development dependency exactly', () => {
    for (const [name, version] of Object.entries(EXACT_DEPENDENCIES)) {
      expect(pkg.dependencies[name]).toBe(version);
    }
    for (const [name, version] of Object.entries(EXACT_DEV_DEPENDENCIES)) {
      expect(pkg.devDependencies[name]).toBe(version);
    }
  });

  it('declares every required verification script', () => {
    for (const script of REQUIRED_SCRIPTS) {
      expect(pkg.scripts[script], `missing script ${script}`).toBeTypeOf('string');
    }
    expect(pkg.scripts['verify:phase-1']).toBe(VERIFY_CHAIN);
    expect(pkg.scripts['verify:all']).toBe(VERIFY_CHAIN);
  });

  it('provides the test, lint, type-check, and formatting configuration files', () => {
    for (const file of [
      'vitest.config.ts',
      'tests/setup.ts',
      'eslint.config.mjs',
      '.prettierrc',
      '.prettierignore',
    ]) {
      expect(existsSync(`${root}${file}`), `missing ${file}`).toBe(true);
    }
  });
});
