import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  serializePage,
  SIZE_CAP,
  isPasswordFieldName,
} from '../../../src/core/content/DomSerializer';

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

  it('does not redact values for passenger/passport/compass/bypass field names (WR-03)', () => {
    const doc = makeDoc(
      '<input name="passenger_first_name" id="a" value="JaneDoe">' +
        '<input name="passport_number" id="b" value="AB1234567">' +
        '<input name="compass_bearing" id="c" value="42">' +
        '<input name="bypass_code" id="d" value="open">' +
        '<input name="user_pwd" id="e" value="SecretPass">',
    );
    const result = serializePage(doc);
    // All four allowlisted field values survive the contains-match heuristic…
    expect(result.html).toContain('JaneDoe');
    expect(result.html).toContain('AB1234567');
    expect(result.html).toContain('42');
    expect(result.html).toContain('open');
    // …while a real password name stays redacted on the same page.
    expect(result.html).not.toContain('SecretPass');
  });

  it('still redacts passcode-named values (D-02 err on false positives)', () => {
    const doc = makeDoc('<input name="passcode" id="a" value="123456">');
    const result = serializePage(doc);
    expect(result.html).not.toContain('123456');
  });

  it('keeps passage-prefixed names out of the innocuous allowlist — values stay redacted (D-02, WR-03)', () => {
    // passage is deliberately NOT in NON_PASSWORD_NAME_PATTERN (the allowlist
    // must never grow to cover passage-class names — plan prohibition). These
    // names therefore still match the password heuristic, so the predicate
    // returns TRUE and their values remain redacted (accepted false-negative
    // space). This test guards the allowlist against re-introducing passage.
    expect(isPasswordFieldName('passage_number')).toBe(true);
    expect(isPasswordFieldName('boarding_passage')).toBe(true);

    const doc = makeDoc(
      '<input name="passage_number" id="a" value="GATE-7">' +
        '<input name="boarding_passage" id="b" value="B-12">',
    );
    const result = serializePage(doc);
    expect(result.html).not.toContain('GATE-7');
    expect(result.html).not.toContain('B-12');
  });
});
