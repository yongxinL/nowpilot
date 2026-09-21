import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Build-inspection gate — the generated MV3 manifest is asserted, not eyeballed.
 *
 * Plan `01-03` Task 1. `CONCERNS.md` § "Manifest/build output is untested" names
 * the absence of this test as the reason two defects shipped behind a green
 * build: an `options_ui` key silently overrode the intent declared in
 * `wxt.config.ts`, and the content script matched no WXT entrypoint glob and was
 * never built at all. Every source-level suite passes without this file — only
 * the built artifact reveals both — so this suite reads
 * `.output/chrome-mv3/manifest.json` and asserts the authorised Phase-1 shape.
 *
 * Read-only by construction: it never runs a build, never writes to `.output`
 * and never mutates the artifact, so two concurrent inspections of one build
 * tree cannot interfere.
 *
 * It FAILS — it never skips — when the artifact is absent or unparseable: a
 * build-inspection test that passes without the build is the very defect it
 * exists to prevent (T-1-14). Every failure message names `pnpm run build:ext`.
 *
 * The `content_scripts` cases (9 and 10) pin the injection-scope decision the
 * operator made in plan `01-03` Task 2 and recorded in
 * `01-MIGRATION-INVENTORY.md` § Resolved hand-off decisions item 1 (Option C):
 * the pilot content script is kept but excluded from the Phase-1 build, so the
 * key must be ABSENT, and its declared host match may never exceed the hosts
 * the manifest already authorises. The decision records the owning plan
 * (Phase 6) and the removal condition for both assertions.
 */

const BUILD_COMMAND = 'pnpm run build:ext';

const MANIFEST_RELATIVE_PATH = join('.output', 'chrome-mv3', 'manifest.json');
const MANIFEST_ABSOLUTE_PATH = join(process.cwd(), MANIFEST_RELATIVE_PATH);

/**
 * The authorised Phase-1 manifest values. Each constant mirrors a declaration in
 * `wxt.config.ts` (or the decision record it cites) rather than a value observed
 * once: drift on either side is meant to be a red test, so the two must move
 * together, deliberately, in one change.
 */
const AUTHORISED_PERMISSIONS = ['sidePanel', 'storage', 'tabs']; // wxt.config.ts `permissions` (least privilege, D-19a)
const AUTHORISED_HOST_PERMISSIONS = [
  '*://*.service-now.com/*',
  '*://support.servicenow.com/*',
]; // wxt.config.ts `host_permissions` — T-1-11: no host may be added silently
const AUTHORISED_CSP = "script-src 'self'; object-src 'self'; connect-src 'none'"; // OQ5 / H-6
/**
 * The pilot content-script source, staged under a name no WXT content glob
 * matches (decision item 1, Option C). Phase 6 restores it as `index.ts` and
 * flips cases 9 and 10 in the same change.
 */
const CONTENT_SCRIPT_SOURCE_PATH = join(
  process.cwd(),
  'src',
  'entrypoints',
  'content',
  'core.content.ts',
);

type GeneratedManifest = Record<string, unknown>;

/**
 * Read and parse the generated manifest. Throws — never returns a null the
 * callers could skip over — with a message naming the build command.
 */
function loadManifest(): GeneratedManifest {
  let raw: string;
  try {
    raw = readFileSync(MANIFEST_ABSOLUTE_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `generated manifest not found at ${MANIFEST_RELATIVE_PATH} — run \`${BUILD_COMMAND}\` first, then re-run this suite. ` +
        'A build-inspection test that passes without the artifact is indistinguishable from one that inspected nothing (T-1-14). ' +
        `Underlying error: ${(error as Error).message}`,
    );
  }
  try {
    return JSON.parse(raw) as GeneratedManifest;
  } catch (error) {
    throw new Error(
      `generated manifest at ${MANIFEST_RELATIVE_PATH} is not parseable JSON — re-run \`${BUILD_COMMAND}\` (a half-written artifact is not a passing build). ` +
        `Underlying error: ${(error as Error).message}`,
    );
  }
}

/** Read the staged content-script source; a missing file is a failure, never a skip. */
function contentScriptSource(): string {
  try {
    return readFileSync(CONTENT_SCRIPT_SOURCE_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      'pilot content-script source is missing from its staged path — see `01-MIGRATION-INVENTORY.md` ' +
        '§ Resolved hand-off decisions item 1 (its owning plan and removal condition are recorded there). ' +
        `Underlying error: ${(error as Error).message}`,
    );
  }
}

describe('generated MV3 manifest is the authorised shape (plan 01-03)', () => {
  it('1. exposes a built, parseable manifest — a missing artifact fails, it never skips', () => {
    const manifest = loadManifest();
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    expect(manifest.name).toBe('NowPilot');
  });

  it('2. declares exactly the least-privilege permission set (a silent addition is a red test)', () => {
    const manifest = loadManifest();
    expect(Array.isArray(manifest.permissions)).toBe(true);
    // Sorted deep-equal, not `toContain`: an extra permission must fail here.
    expect([...(manifest.permissions as string[])].sort()).toEqual(
      [...AUTHORISED_PERMISSIONS].sort(),
    );
  });

  it('3. carries no options_ui key', () => {
    const manifest = loadManifest();
    // Why this is a case of its own: `options_ui` silently forces
    // `"open_in_tab": false` into the generated manifest, so it overrode the
    // intent declared in `wxt.config.ts` and shipped unseen. §5.1 lists no
    // options entrypoint — Options renders inside the Standalone shell at
    // `standalone.html?page=options` (§5.4, §8.6).
    expect('options_ui' in manifest).toBe(false);
  });

  it('4. carries no options_page key', () => {
    const manifest = loadManifest();
    // The legacy key must stay absent alongside `options_ui`: either one
    // re-introduces a standalone options entrypoint the spec does not have.
    expect('options_page' in manifest).toBe(false);
  });

  it('5. is an MV3 manifest', () => {
    expect(loadManifest().manifest_version).toBe(3);
  });

  it('6. points the side panel at sidepanel.html', () => {
    const manifest = loadManifest();
    const sidePanel = manifest.side_panel as { default_path?: unknown } | undefined;
    expect(sidePanel?.default_path).toBe('sidepanel.html');
  });

  it('7. pins the Phase-1 CSP by string equality (widening it is a red test)', () => {
    const manifest = loadManifest();
    const csp = manifest.content_security_policy as { extension_pages?: unknown } | undefined;
    // No Phase-1 code path performs a network request (D-05, D-08), so any
    // reachable host is pure attack surface: `connect-src 'none'` is asserted
    // as an exact string so a later widening cannot pass unnoticed (T-1-13).
    expect(csp?.extension_pages).toBe(AUTHORISED_CSP);
  });

  it('8. declares exactly the authorised host_permissions set — recorded, not assumed', () => {
    const manifest = loadManifest();
    const hosts = (manifest.host_permissions as string[] | undefined) ?? [];
    expect(Array.isArray(hosts)).toBe(true);
    // The authorised set is non-empty in Phase 1 (ServiceNow only). Were it
    // ever emptied, this case would assert emptiness explicitly against `[]`
    // rather than letting an absent key pass unexamined.
    expect([...hosts].sort()).toEqual([...AUTHORISED_HOST_PERMISSIONS].sort());
  });

  it('9. carries no content_scripts key — the pilot entrypoint is excluded from the Phase-1 build', () => {
    const manifest = loadManifest();
    // This case encodes the injection-scope decision recorded in
    // `01-MIGRATION-INVENTORY.md` § Resolved hand-off decisions item 1
    // (Option C): the entrypoint is kept at
    // `src/entrypoints/content/core.content.ts`, a name no WXT content-script
    // glob matches, so the build registers nothing for it and Phase 1 requests
    // no host access. A key appearing here means the discovery switch was
    // flipped (a rename back to `index.ts`) without the decision's removal
    // condition being applied.
    expect('content_scripts' in manifest).toBe(false);
  });
});

describe('pilot content-script source is staged for the recorded decision (plan 01-03 Task 3)', () => {
  it('10. declares no host match wider than the manifest already authorises', () => {
    const source = contentScriptSource();
    // The source half of T-1-12: the declared scope may never name a host the
    // manifest has not already granted, so restoring this file as a WXT
    // entrypoint cannot silently widen host access — never `<all_urls>` again.
    const declared = /matches:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? '';
    const matches = (declared.match(/'[^']*'|"[^"]*"/g) ?? []).map((s) => s.slice(1, -1));
    expect(matches).not.toContain('<all_urls>');
    expect([...matches].sort()).toEqual([...AUTHORISED_HOST_PERMISSIONS].sort());
  });
});
