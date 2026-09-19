import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkGeneratedManifest, type GeneratedManifest } from './manifestChecks';

const outputDir = resolve(process.cwd(), '.output/chrome-mv3');
const manifestPath = resolve(outputDir, 'manifest.json');

describe('generated Chrome MV3 manifest', () => {
  it('matches the Phase 01 permission and entrypoint contract', () => {
    expect(existsSync(manifestPath), `missing ${manifestPath}; run pnpm run build first`).toBe(
      true,
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as GeneratedManifest;
    const result = checkGeneratedManifest(manifest, {
      standaloneHtmlExists: existsSync(resolve(outputDir, 'standalone.html')),
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
