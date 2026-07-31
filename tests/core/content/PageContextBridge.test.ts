import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { serializePage, SIZE_CAP } from '../../../src/core/content/DomSerializer';

/**
 * PageContextBridge messaging contract test (D-06, D-02).
 *
 * Verifies the EXTRACT_PAGE_CONTENT handler returns correct SerializedPage
 * shape: password field redaction (all selector patterns + name heuristic),
 * size cap enforcement, metadata extraction, and non-password field preservation.
 * The handler is `extractPageContentHandler` → `serializePage(document)` —
 * testing serializePage directly is equivalent to testing the handler.
 */

function makeDoc(
  bodyHtml: string,
  opts?: { url?: string; title?: string },
): Document {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><title>${opts?.title ?? 'Test Page'}</title></head><body>${bodyHtml}</body></html>`,
    { url: opts?.url ?? 'https://example.com/test' },
  );
  return dom.window.document;
}

describe('PageContextBridge (EXTRACT_PAGE_CONTENT handler)', () => {
  // ── Test 1: Returns SerializedPage with correct shape ───────────────
  it('returns SerializedPage with correct shape { html, url, title, capturedAt, size, truncated }', () => {
    const doc = makeDoc('<p>Hello, World!</p>');
    const result = serializePage(doc);

    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('capturedAt');
    expect(result).toHaveProperty('size');
    expect(result).toHaveProperty('truncated');
    expect(typeof result.html).toBe('string');
    expect(typeof result.url).toBe('string');
    expect(typeof result.title).toBe('string');
    expect(typeof result.capturedAt).toBe('number');
    expect(typeof result.size).toBe('number');
    expect(typeof result.truncated).toBe('boolean');
    expect(result.html.length).toBeGreaterThan(0);
  });

  // ── Test 2: Password field redaction — input[type=password] ─────────
  it('omits value for input[type=password] set via the value property', () => {
    const doc = makeDoc('<input type="password" name="pass" id="pwd">');
    (doc.querySelector('#pwd') as HTMLInputElement).value = 'secret123';
    const result = serializePage(doc);
    expect(result.html).not.toContain('secret123');
  });

  // ── Test 3: Password field redaction — autocomplete=current-password ─
  it('omits value for autocomplete=current-password inputs (selector + name heuristic)', () => {
    const doc = makeDoc(
      '<input type="text" autocomplete="current-password" name="pwd" id="cc">',
    );
    // Set value via the attribute so it appears in outerHTML
    (doc.querySelector('#cc') as HTMLInputElement).setAttribute('value', 'hidden');
    (doc.querySelector('#cc') as HTMLInputElement).value = 'hidden';
    const result = serializePage(doc);
    expect(result.html).not.toContain('hidden');
  });

  // ── Test 4: Password field redaction — [isPassword] selector ────────
  it('omits value for [isPassword] attribute inputs', () => {
    const doc = makeDoc('<input isPassword id="custom" type="text" value="hidden2">');
    (doc.querySelector('#custom') as HTMLInputElement).value = 'hidden2';
    const result = serializePage(doc);
    expect(result.html).not.toContain('hidden2');
  });

  // ── Test 5: Password field redaction — name-pattern heuristic ───────
  it('omits values for inputs matching the password name heuristic', () => {
    const doc = makeDoc(
      '<input name="user_passwd" id="a" value="heuristicPwd"><input name="username" id="b" value="john">',
    );
    const result = serializePage(doc);
    expect(result.html).not.toContain('heuristicPwd');
    expect(result.html).toContain('john');
  });

  it('omits values for inputs with name containing "pwd"', () => {
    const doc = makeDoc(
      '<input name="db_pwd" id="a" value="dbSecret"><input name="email" id="b" value="alice@example.com">',
    );
    const result = serializePage(doc);
    expect(result.html).not.toContain('dbSecret');
    expect(result.html).toContain('alice@example.com');
  });

  // ── Test 6: Non-password fields preserve values ─────────────────────
  it('preserves values for non-password input fields', () => {
    const doc = makeDoc(
      '<input type="text" name="username" value="john"><input type="email" name="email" value="alice@example.com">',
    );
    const result = serializePage(doc);
    expect(result.html).toContain('john');
    expect(result.html).toContain('alice@example.com');
  });

  // ── Test 7: Size cap enforcement ────────────────────────────────────
  it('enforces the ~2MB size cap and flags truncation', () => {
    const bigContent = 'x'.repeat(SIZE_CAP + 4096);
    const doc = makeDoc(`<div>${bigContent}</div>`);
    const result = serializePage(doc);
    expect(result.truncated).toBe(true);
    expect(result.html.length).toBeLessThanOrEqual(SIZE_CAP);
    expect(result.size).toBe(result.html.length);
  });

  // ── Test 8: Metadata extraction ─────────────────────────────────────
  it('extracts correct metadata (title, url, capturedAt)', () => {
    const doc = makeDoc('<p>content</p>', {
      title: 'Test Page',
      url: 'https://example.com/article',
    });
    const result = serializePage(doc);
    expect(result.title).toBe('Test Page');
    expect(result.url).toBe('https://example.com/article');
    expect(result.capturedAt).toBeGreaterThan(0);
    expect(result.capturedAt).toBeLessThanOrEqual(Date.now() + 1000);
    expect(result.capturedAt).toBeGreaterThanOrEqual(Date.now() - 5000);
  });

  // ── Test 9: Live document is never mutated ──────────────────────────
  it('never mutates the live document (redaction on an in-memory clone)', () => {
    const doc = makeDoc('<input type="password" id="pwd">');
    const input = doc.querySelector('#pwd') as HTMLInputElement;
    input.value = 'KeepMeLive';
    const result = serializePage(doc);
    expect(result.html).not.toContain('KeepMeLive');
    // Live document value is preserved
    expect((doc.querySelector('#pwd') as HTMLInputElement).value).toBe('KeepMeLive');
  });
});
