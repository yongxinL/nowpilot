// tests/fixtures/fixtures.test.ts — D-20/D-21 determinism smoke test (Nyquist).
// Asserts per builder: two calls with identical args deep-equal (fixed
// IDs/timestamps, no real randomness), no NaN/undefined in required fields, and
// the redaction fixture's password field is a distinct key the redaction tests
// can assert absence of. Runs in the default jsdom-align environment (no IDB,
// no chrome.* needed — pure data builders).
import { describe, expect, it } from 'vitest';
import {
  buildArticleFixture,
  buildBoilerplateFixture,
  buildLargeArticleFixture,
  buildNoHeadingFixture,
  buildRawNodeFixture,
  FIXED_TIMESTAMP,
  FIXED_TITLE,
  FIXED_URL,
} from './pageContent';
import {
  buildCrossInstallFixture,
  buildJournalRecoveryFixture,
  buildMigrationFixture,
  buildQuotaShadowFixture,
  buildRedactionFixture,
  buildVaultRoundtripFixture,
} from './index';

describe('tests/fixtures — determinism (D-20/D-21)', () => {
  it('buildVaultRoundtripFixture is deterministic and well-formed', () => {
    const a = buildVaultRoundtripFixture();
    const b = buildVaultRoundtripFixture();
    expect(a).toEqual(b);
    expect(a.salt).toHaveLength(16);
    expect(a.iv).toHaveLength(12);
    expect(a.installSecret.length).toBeGreaterThan(0);
    expect(a.extensionId.length).toBeGreaterThan(0);
    expect(a.plaintext.length).toBeGreaterThan(0);
    // byte-level determinism for the fixed arrays
    expect([...a.salt]).toEqual([...b.salt]);
    expect([...a.iv]).toEqual([...b.iv]);
  });

  it('buildVaultRoundtripFixture honors overrides', () => {
    const a = buildVaultRoundtripFixture({ plaintext: 'sk-custom' });
    const b = buildVaultRoundtripFixture({ plaintext: 'sk-custom' });
    expect(a).toEqual(b);
    expect(a.plaintext).toBe('sk-custom');
    expect(b.installSecret).toBe(buildVaultRoundtripFixture().installSecret);
  });

  it('buildCrossInstallFixture is deterministic with distinct secrets', () => {
    const a = buildCrossInstallFixture();
    const b = buildCrossInstallFixture();
    expect(a).toEqual(b);
    expect(a.secretA).not.toBe(a.secretB);
    expect(a.envelopeA.salt).toHaveLength(16);
    expect(a.envelopeA.iv).toHaveLength(12);
    expect(a.envelopeA.ciphertext.length).toBeGreaterThan(0);
    expect([...a.envelopeA.ciphertext]).toEqual([...b.envelopeA.ciphertext]);
  });

  it('buildJournalRecoveryFixture is deterministic with all statuses present', () => {
    const a = buildJournalRecoveryFixture();
    const b = buildJournalRecoveryFixture();
    expect(a).toEqual(b);
    const statuses = new Set(a.entries.map((e) => e.status));
    expect(statuses.has('pending')).toBe(true);
    expect(statuses.has('applying')).toBe(true);
    expect(statuses.has('completed')).toBe(true);
    // every entry carries the same fixed workspaceId/version in targetIds,
    // except the intentional different-workspaceId edge variant (WR-10)
    for (const e of a.entries) {
      if (e.targetIds.workspaceId === 'ws-other') continue;
      expect(e.targetIds.workspaceId).toBe(a.workspaceId);
      expect(e.targetIds.version).toBe(a.version);
      expect(Number.isFinite(e.createdAt)).toBe(true);
      expect(Number.isFinite(e.updatedAt)).toBe(true);
      expect(Number.isInteger(e.attempts)).toBe(true);
      expect(e.id.length).toBeGreaterThan(0);
    }
    // edge variants first-class: a different-workspaceId entry + an unknown-op entry
    expect(a.entries.some((e) => e.targetIds.workspaceId === 'ws-other')).toBe(true);
    // forward-compat unknown op is modeled via a cast in the fixture (D-07 skip case)
    expect(a.entries.some((e) => e.operation === ('future-sync-op' as never))).toBe(true);
  });

  it('buildJournalRecoveryFixture honors workspaceId/version overrides', () => {
    const a = buildJournalRecoveryFixture({ workspaceId: 'ws-custom', version: '9' });
    const b = buildJournalRecoveryFixture({ workspaceId: 'ws-custom', version: '9' });
    expect(a).toEqual(b);
    for (const e of a.entries) {
      if (e.targetIds.workspaceId === 'ws-other') continue;
      expect(e.targetIds.workspaceId).toBe('ws-custom');
      expect(e.targetIds.version).toBe('9');
    }
  });

  it('buildMigrationFixture is deterministic with fixed legacy rows', () => {
    const a = buildMigrationFixture();
    const b = buildMigrationFixture();
    expect(a).toEqual(b);
    expect(a.dbName.length).toBeGreaterThan(0);
    expect(a.v1Rows.length).toBeGreaterThan(0);
    for (const row of a.v1Rows) {
      expect(row.id.length).toBeGreaterThan(0);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.body.length).toBeGreaterThan(0);
    }
    expect(a.expectedV2.carriedIds).toEqual(a.v1Rows.map((r) => r.id));
    expect(a.expectedV2.addStore.length).toBeGreaterThan(0);
    expect(a.expectedV2.addIndex.name.length).toBeGreaterThan(0);
    expect(a.expectedV2.addIndex.keyPath.length).toBeGreaterThan(0);
  });

  it('buildQuotaShadowFixture is deterministic and models a cosmetic sync key', () => {
    const a = buildQuotaShadowFixture();
    const b = buildQuotaShadowFixture();
    expect(a).toEqual(b);
    expect(['np_theme', 'np_theme_pack', 'np_language']).toContain(a.key);
    expect(a.value.length).toBeGreaterThan(0);
    expect(a.syncRejectError.name.length).toBeGreaterThan(0);
    expect(a.syncRejectError.message.length).toBeGreaterThan(0);
  });

  it('buildRedactionFixture is deterministic and exposes a distinct password key', () => {
    const a = buildRedactionFixture();
    const b = buildRedactionFixture();
    expect(a).toEqual(b);
    expect(a.messages.length).toBeGreaterThan(0);
    for (const m of a.messages) expect(m.length).toBeGreaterThan(0);
    // the password-like field is a distinct key the redaction tests assert ABSENCE of
    expect(a.passwordKey).toBe('password');
    expect(a.structured).toHaveProperty(a.passwordKey);
    expect(a.structured).toHaveProperty('apiKey');
  });
});

describe('tests/fixtures/pageContent — shared golden HTML fixtures (D-4a-24)', () => {
  it('every HTML builder is deterministic — two calls with identical args deep-equal', () => {
    expect(buildArticleFixture()).toEqual(buildArticleFixture());
    expect(buildBoilerplateFixture()).toEqual(buildBoilerplateFixture());
    expect(buildNoHeadingFixture()).toEqual(buildNoHeadingFixture());
    expect(buildLargeArticleFixture()).toEqual(buildLargeArticleFixture());
    expect(buildRawNodeFixture()).toEqual(buildRawNodeFixture());
  });

  it('builders honor overrides deterministically', () => {
    const a = buildArticleFixture({ title: 'Custom Title' });
    const b = buildArticleFixture({ title: 'Custom Title' });
    expect(a).toEqual(b);
    expect(a.title).toBe('Custom Title');
    // fixed constants unchanged across override paths
    expect(buildArticleFixture().url).toBe(FIXED_URL);
    expect(buildRawNodeFixture().extractedAt).toBe(FIXED_TIMESTAMP);
  });

  it('fixed constants are stable and non-empty', () => {
    expect(FIXED_URL.length).toBeGreaterThan(0);
    expect(FIXED_TITLE.length).toBeGreaterThan(0);
    expect(Number.isFinite(FIXED_TIMESTAMP)).toBe(true);
  });

  it('article fixture carries the password-omission + base-URL-stamp shapes (D-4a-08/20)', () => {
    const { html, title, url } = buildArticleFixture();
    expect(title).toBe(FIXED_TITLE);
    expect(url).toBe(FIXED_URL);
    // a password input is present with NO value attribute (never captured, D-4a-20)
    expect(html).toMatch(/<input type="password" name="password">/);
    expect(html).toMatch(/<input type="text" name="username" value="alice">/);
    // the fixture must exercise relative + absolute links (base-URL stamp, D-4a-08)
    expect(html).toContain('href="/guide/quickstart"');
    expect(html).toContain('href="https://docs.example.com/article/how-nowpilot-extracts"');
  });

  it('boilerplate fixture is nav/footer heavy with a minimal main (D-4a-18 fallback)', () => {
    const { html } = buildBoilerplateFixture();
    // dense nav + footer link lists dominate; the main content is a single short paragraph
    const navLinks = html.match(/<a href/g) ?? [];
    expect(navLinks.length).toBeGreaterThanOrEqual(10);
    expect(html).toMatch(/<main>\s*<p>Welcome to Acme Corporation\.<\/p>\s*<\/main>/);
  });

  it('no-heading fixture has zero h1-h6 and multiple paragraph blocks (D-4a-16 fallback)', () => {
    const { html } = buildNoHeadingFixture();
    expect(html).not.toMatch(/<h[1-6][\s>]/i);
    const paragraphs = html.match(/<p>/g) ?? [];
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
  });

  it('large-article fixture has multiple long sections exceeding the ~500-token chunk budget', () => {
    const { html } = buildLargeArticleFixture();
    const headings = html.match(/<h2>/g) ?? [];
    expect(headings.length).toBeGreaterThanOrEqual(3);
    // each section body (~1,400 chars) exceeds the ~2,000-char / ~500-token budget
    const body = html.match(/<h2>Layered Strategy Order<\/h2>([\s\S]*?)<h2>Ephemeral/);
    expect(body).not.toBeNull();
    if (body) {
      expect(body[1].length).toBeGreaterThan(2000);
    }
  });

  it('raw-node fixture enforces the password invariant shape (isPassword true, no value key)', () => {
    const { root } = buildRawNodeFixture();
    // the D-4a-20 invariant: the password control carries isPassword: true and NO value field
    const passControl = findFormControl(root, 'password');
    expect(passControl).toBeDefined();
    expect(passControl?.isPassword).toBe(true);
    expect(passControl).not.toHaveProperty('value');
    // the text control MAY carry a value (only passwords are omitted)
    const userControl = findFormControl(root, 'username');
    expect(userControl?.value).toBe('alice');
    expect(userControl?.isPassword).toBe(false);
  });
});

/** Depth-first search for a form control by fieldName inside a RawNode tree. */
function findFormControl(
  node: {
    form?: { control?: { fieldName?: string; isPassword?: boolean; value?: string } };
    children?: unknown[];
  },
  fieldName: string,
): { fieldName?: string; isPassword?: boolean; value?: string } | undefined {
  if (node.form?.control?.fieldName === fieldName) return node.form.control;
  for (const child of node.children ?? []) {
    const found = findFormControl(child as Parameters<typeof findFormControl>[0], fieldName);
    if (found) return found;
  }
  return undefined;
}
