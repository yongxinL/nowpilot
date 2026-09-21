import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Background wiring contract for D-07's legacy credential cleanup (plan
 * `01-10`, Task 3).
 *
 * The cleanup is not a fourth registration: it runs **inside** the two install
 * and startup handlers the background already owns, and it runs before the
 * other install/startup migration so nothing in the same wake can read the
 * prototype's plaintext provider keys first. This suite is a source scan
 * because the property is structural — the handler bodies are the subject, and
 * importing the service worker's module graph into jsdom would prove nothing
 * about the order inside those handlers.
 *
 * Comments are stripped before scanning so the contract's own prose (which
 * names the functions it describes) cannot satisfy the assertions.
 */

const BACKGROUND_PATH = join(process.cwd(), 'src', 'entrypoints', 'background.ts');

function backgroundCode(): string {
  return readFileSync(BACKGROUND_PATH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('background.ts — the legacy credential cleanup is wired into install and startup', () => {
  it('imports the cleanup module', () => {
    expect(backgroundCode()).toMatch(
      /import\s*\{\s*runLegacyCredentialCleanup\s*\}\s*from\s*'\.\.\/core\/storage\/legacyCredentialCleanup'/,
    );
  });

  it('invokes the cleanup in both existing handlers, fire-and-forget, and nowhere else', () => {
    const code = backgroundCode();

    expect(code.match(/void runLegacyCredentialCleanup\(\)/g) ?? []).toHaveLength(2);
  });

  it('runs the cleanup before the onboarding migration inside each handler', () => {
    const code = backgroundCode();

    for (const handler of [
      'chrome.runtime.onStartup.addListener',
      'chrome.runtime.onInstalled.addListener',
    ]) {
      const handlerIndex = code.indexOf(handler);
      expect(handlerIndex, `${handler} must exist`).toBeGreaterThan(-1);

      const cleanupIndex = code.indexOf('runLegacyCredentialCleanup()', handlerIndex);
      const onboardingIndex = code.indexOf('migrateLegacyOnboardingFlag()', handlerIndex);

      expect(cleanupIndex, `${handler} must invoke the cleanup`).toBeGreaterThan(handlerIndex);
      expect(onboardingIndex, `${handler} must invoke the onboarding migration`).toBeGreaterThan(
        handlerIndex,
      );
      // The cleanup runs FIRST: no later read in the same wake may observe the
      // legacy plaintext configuration.
      expect(cleanupIndex, `${handler} must clean before anything else reads`).toBeLessThan(
        onboardingIndex,
      );
    }
  });

  it('adds no new top-level listener registration', () => {
    const registrations =
      backgroundCode().match(/chrome\.runtime\.on[A-Za-z]+\.addListener/g) ?? [];

    // Exactly the two registrations D-13's contract already documented: the
    // cleanup extends them rather than adding a fourth thing to the file.
    expect(registrations).toEqual([
      'chrome.runtime.onStartup.addListener',
      'chrome.runtime.onInstalled.addListener',
    ]);
  });
});
