import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { serializePage, SIZE_CAP } from '../../../src/core/content/DomSerializer';

function makeDoc(bodyHtml: string, url = 'https://example.com/page'): Document {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head><title>Fixture</title></head><body>${bodyHtml}</body></html>`,
    { url },
  );
  return dom.window.document;
}

describe('DomSerializer', () => {
  it('omits value for input[type=password] set via the value property', () => {
    const doc = makeDoc('<input type="password" id="pwd">');
    (doc.querySelector('#pwd') as HTMLInputElement).value = 'SuperSecret123';
    const result = serializePage(doc);
    expect(result.html).not.toContain('SuperSecret123');
  });

  it('omits value for input[type=password] set via the value attribute', () => {
    const doc = makeDoc('<input type="password" id="pwd" value="AttrSecret">');
    const result = serializePage(doc);
    expect(result.html).not.toContain('AttrSecret');
  });

  it('omits value for [isPassword] inputs', () => {
    const doc = makeDoc('<input isPassword id="custom" type="text">');
    (doc.querySelector('#custom') as HTMLInputElement).value = 'LegacySecret';
    const result = serializePage(doc);
    expect(result.html).not.toContain('LegacySecret');
  });

  it('omits value for autocomplete=current-password inputs', () => {
    const doc = makeDoc('<input type="text" autocomplete="current-password" id="cc">');
    (doc.querySelector('#cc') as HTMLInputElement).value = 'CurrentPw';
    const result = serializePage(doc);
    expect(result.html).not.toContain('CurrentPw');
  });

  it('omits values for inputs matching the password name heuristic and keeps other inputs', () => {
    // Values set via the value ATTRIBUTE are what outerHTML serializes —
    // property-set values are never part of the serialized HTML.
    const doc = makeDoc(
      '<input name="user_pwd" id="a" value="PwdHeuristic"><input name="username" id="b" value="alice">',
    );
    const result = serializePage(doc);
    expect(result.html).not.toContain('PwdHeuristic');
    expect(result.html).toContain('alice');
  });

  it('never mutates the live document (redaction happens on an in-memory clone)', () => {
    const doc = makeDoc('<input type="password" id="pwd">');
    const input = doc.querySelector('#pwd') as HTMLInputElement;
    input.value = 'KeepMeLive';
    const result = serializePage(doc);
    expect(result.html).not.toContain('KeepMeLive');
    expect((doc.querySelector('#pwd') as HTMLInputElement).value).toBe('KeepMeLive');
  });

  it('captures url, title, size, capturedAt and truncated=false for a plain document', () => {
    const doc = makeDoc('<div>hello</div>');
    const result = serializePage(doc);
    expect(result.url).toBe('https://example.com/page');
    expect(result.title).toBe('Fixture');
    expect(result.size).toBe(result.html.length);
    expect(result.truncated).toBe(false);
    expect(result.capturedAt).toBeGreaterThan(0);
    expect(result.html).toContain('<div>hello</div>');
  });

  it('enforces the ~2MB size cap and flags truncation', () => {
    const big = 'x'.repeat(SIZE_CAP + 4096);
    const doc = makeDoc(`<div>${big}</div>`);
    const result = serializePage(doc);
    expect(result.truncated).toBe(true);
    expect(result.html.length).toBeLessThanOrEqual(SIZE_CAP);
    expect(result.size).toBe(result.html.length);
  });
});
