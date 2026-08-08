#!/usr/bin/env node
// tests/e2e/load-smoke.mjs — verify:e2e-phase-1 (I1 Option A)
// Proves the extension actually LOADS in a real MV3 browser, not just unit-green.
//
// Steps:
//   (a) fetch a PINNED Chrome-for-Testing build via @puppeteer/browsers `install`
//       into a repo-local .cache/chrome-for-testing dir
//   (b) launch it headless via puppeteer-core
//   (c) load the built unpacked extension from .output/chrome-mv3 with
//       --disable-extensions-except + --load-extension
//   (d) assert both extension surfaces mount their #root WITHOUT console errors
//       (RUNTIME-01 real-browser MV3 load; RUNTIME-02/03 surface mounts)
//
// Console error-level messages (excluding benign favicon/net errors) cause exit 1
// with the messages listed; exit 0 only when both pages mount clean.
//
// Fails with a clear "run `pnpm wxt build` first" hint if .output/chrome-mv3 is absent.
// node-built-ins + @puppeteer/browsers + puppeteer-core only.
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  install,
  computeExecutablePath,
  resolveBuildId,
  Browser,
  BrowserPlatform,
  ChromeReleaseChannel,
} from '@puppeteer/browsers';
import puppeteer from 'puppeteer-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, '.output', 'chrome-mv3');
const browserCacheDir = join(root, '.cache', 'chrome-for-testing');

// Benign errors ignored during mount assertions (favicon fetches, net:: errors
// from extension-internal lookups that don't affect page mounting).
const BENIGN_ERROR_PATTERNS = [
  /favicon/i,
  /net::ERR_/i,
  /Failed to load resource: the server responded with a status of 404/i,
];

function isBenign(message) {
  return BENIGN_ERROR_PATTERNS.some((re) => re.test(message));
}

async function main() {
  if (!existsSync(outDir)) {
    console.error('verify:e2e-phase-1: .output/chrome-mv3 is missing. Run `pnpm wxt build` first.');
    process.exit(1);
  }

  // (a) pinned Chrome-for-Testing build (stable channel) into repo-local cache
  const platform = detectPlatform();
  // @puppeteer/browsers v3 does NOT resolve a 'stable' channel tag inside
  // install(); resolve the concrete buildId first, then install that exact build.
  const buildId = await resolveBuildId(Browser.CHROME, platform, ChromeReleaseChannel.STABLE);
  console.log(`load-smoke: installing Chrome for Testing (stable → ${buildId})…`);
  const installed = await install({
    browser: Browser.CHROME,
    buildId,
    baseUrl: 'https://storage.googleapis.com/chrome-for-testing-public',
    cacheDir: browserCacheDir,
  });
  const executablePath = computeExecutablePath({
    browser: Browser.CHROME,
    buildId: installed.buildId,
    platform,
    cacheDir: browserCacheDir,
  });
  console.log(`load-smoke: Chrome for Testing at ${executablePath}`);

  // (b) + (c) launch headless with the built unpacked extension loaded
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        `--disable-extensions-except=${outDir}`,
        `--load-extension=${outDir}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
  } catch (err) {
    console.error(
      'load-smoke: could not launch Chrome for Testing — the machine is missing ' +
        'Chrome runtime system libraries (e.g. libnspr4.so, libnss3.so). Install them ' +
        'with your distro package manager (Debian/Ubuntu: sudo apt install libnspr4 ' +
        'libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libxcomposite1 ' +
        'libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2) ' +
        'and re-run `pnpm verify:e2e-phase-1`.',
    );
    console.error(`load-smoke: launch error: ${err.message}`);
    process.exit(1);
  }

  const failures = [];
  try {
    for (const pageFile of ['sidepanel.html', 'standalone.html']) {
      const url = `chrome-extension://${getExtensionId(outDir)}/${pageFile}`;
      console.log(`load-smoke: loading ${url}`);
      const page = await browser.newPage();

      const consoleErrors = [];
      const onConsole = (msg) => {
        if (msg.type() === 'error' && !isBenign(msg.text())) {
          consoleErrors.push(msg.text());
        }
      };
      page.on('console', onConsole);

      // load the page AND give the root render a moment (stub renders synchronously)
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // (d) assert the #root element mounted with content
      const mounted = await page
        .evaluate(() => {
          const rootEl = document.getElementById('root');
          return !!rootEl && rootEl.children.length > 0;
        })
        .catch(() => false);

      const msgs = [...consoleErrors];
      page.off('console', onConsole);
      await page.close();

      if (!mounted) {
        failures.push(`${pageFile}: #root did not mount (no child elements)`);
      }
      for (const msg of msgs) {
        failures.push(`${pageFile} console error: ${msg}`);
      }
      if (mounted && msgs.length === 0) {
        console.log(`load-smoke: ${pageFile} mounted clean ✓`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error('load-smoke: FAILED');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('load-smoke: both surfaces mounted console-error-free ✓');
  process.exit(0);
}

function detectPlatform() {
  switch (process.platform) {
    case 'darwin':
      return process.arch === 'arm64' ? BrowserPlatform.MAC_ARM : BrowserPlatform.MAC;
    case 'win32':
      return BrowserPlatform.WIN64;
    default:
      return BrowserPlatform.LINUX;
  }
}

// Chrome derives a load-unpacked extension ID deterministically from the
// extension directory's absolute path: SHA256(path) → first 16 bytes → each
// byte split into two nibbles mapped onto the a–p alphabet (32 chars).
function getExtensionId(outDirPath) {
  const pathKey = outDirPath.replace(/\\/g, '/');
  const digest = createHash('sha256').update(pathKey, 'utf8').digest();
  const alphabet = 'abcdefghijklmnop';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += alphabet[(digest[i] >> 4) & 0x0f];
    id += alphabet[digest[i] & 0x0f];
  }
  return id;
}

main().catch((err) => {
  console.error('load-smoke: unhandled error:', err);
  process.exit(1);
});
