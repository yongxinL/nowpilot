/**
 * Content-script-safe DOM serializer with password redaction (D-01, D-02).
 *
 * Pure utility: captures `document.documentElement.outerHTML` (size-capped at
 * ~2MB) with password field values omitted. NEVER imports React, AntD,
 * defuddle, yaml, or File System Access APIs (D-20) — this module runs inside
 * the content script bundle.
 */

/** ~2MB serialized HTML cap per D-01. */
export const SIZE_CAP = 2 * 1024 * 1024;

const PASSWORD_INPUT_SELECTOR =
  'input[type="password"], [isPassword], input[autocomplete="current-password"]';

const PASSWORD_NAME_PATTERN = /^(?:.*pass(?:word|wd)?.*|.*pwd.*)$/i;

export interface SerializedPage {
  html: string;
  url: string;
  title: string;
  capturedAt: number;
  size: number;
  truncated: boolean;
}

/**
 * Serializes the given document to HTML with password values redacted.
 *
 * Redaction runs on an in-memory clone (never the live document): clearing
 * `value` on live password fields would wipe the user's typed password — a
 * visible host-page mutation. The clone keeps the capture path a pure read
 * of the page (per the content-script negative contract: no host-page DOM
 * mutation beyond non-visible read operations such as cloning into memory).
 *
 * @param doc - The document to capture (the content script's live document).
 * @returns The serialized page; `truncated: true` when the HTML exceeded
 *   SIZE_CAP and was sliced.
 */
export function serializePage(doc: Document): SerializedPage {
  // Realm-safe element test: instanceof against the environment global
  // (HTMLInputElement) fails for documents created by another jsdom/happy-dom
  // instance (each window has its own constructor). tagName works universally;
  // the selectors used below already restrict matches to input elements.
  const isInput = (el: Element): el is HTMLInputElement => el.tagName === 'INPUT';

  const passwordFields = Array.from(doc.querySelectorAll(PASSWORD_INPUT_SELECTOR));
  const nameMatchedInputs = Array.from(doc.querySelectorAll('input')).filter(
    (el) =>
      isInput(el) && PASSWORD_NAME_PATTERN.test(el.name || '') && el.value.length > 0,
  );

  const hasTypedPassword = passwordFields.some((el) => isInput(el) && el.value.length > 0);

  let source: Document = doc;
  if (hasTypedPassword || nameMatchedInputs.length > 0) {
    // Redact on a clone: D-02 privacy boundary without mutating the live page.
    source = doc.cloneNode(true) as Document;
    for (const el of source.querySelectorAll(PASSWORD_INPUT_SELECTOR)) {
      if (!isInput(el) || !el.value) continue;
      // The value ATTRIBUTE is what outerHTML serializes — the value IDL
      // property and the content attribute are decoupled, so clearing the
      // property alone would still leak attribute-set values (D-02).
      el.removeAttribute('value');
      el.value = '';
    }
    for (const el of source.querySelectorAll('input')) {
      if (!isInput(el)) continue;
      if (!PASSWORD_NAME_PATTERN.test(el.name || '') || !el.value) continue;
      el.removeAttribute('value');
      el.value = '';
    }
  }

  let html = source.documentElement.outerHTML;
  let truncated = false;
  if (html.length > SIZE_CAP) {
    html = html.slice(0, SIZE_CAP);
    truncated = true;
  }

  return {
    html,
    url: doc.URL,
    title: doc.title,
    capturedAt: Date.now(),
    size: html.length,
    truncated,
  };
}
