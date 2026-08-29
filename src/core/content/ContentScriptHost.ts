// ContentScriptHost — the content-script serializer shell (D-85 / §26.6).
//
// Serializes a PRE-STRIPPED clone of document.documentElement: script/style/
// noscript/svg/cross-origin iframe markup is removed and form action
// attributes are stripped; text, headings, links and input controls are kept.
// The payload stamps the page's EFFECTIVE base URL (document.baseURI) so the
// panel's detached DOMParser resolves relative URLs (§26.4), and applies the
// hard PAGE_HTML_MAX_BYTES (2 MB) cap with ELEMENT-BOUNDARY truncation +
// truncated:true (§26.6) — never a mid-element cut (a mid-element cut would
// produce invalid HTML that DOMParser must repair lossily), never
// multi-envelope chunking in v0.1.
//
// Content-bundle constraints (Pitfall 8 / T-P6-03): this module imports ONLY
// the runtime-envelope module (types + createEnvelope) — never the panel-side
// extraction layer, never zod. The 2 MB cap constant is therefore mirrored
// LOCALLY (same value as the IExtractionStrategy tunable, which the content
// bundle must not import).
//
// Privacy (§26.6 / D-85/D-90): the serializer strips markup but performs NO
// redaction (panel-side only); password VALUES are never serialized — input
// values are runtime state, absent from outerHTML, and the AxDomWalker omits
// them at capture (D-86).
import { createEnvelope, type PageHtmlPayload } from '../runtime/RuntimeEnvelope';

/** §26.6 hard size cap (2 MB). Mirrors the IExtractionStrategy tunable —
 * the content bundle must not import the panel-side extraction layer
 * (Pitfall 8), so the value is mirrored locally. */
export const PAGE_HTML_MAX_BYTES = 2_000_000;

/** True when the iframe's src resolves to a different origin than the host
 * page — such markup is removed at serialization (D-85 / T-P6-17: third-party
 * DOM never crosses into the panel; same-origin iframes are kept). */
function isCrossOriginIframe(el: Element): boolean {
  const src = el.getAttribute('src');
  if (src === null || src === '') return false; // about:blank / srcdoc — same document
  let origin: string;
  try {
    origin = new URL(src, document.baseURI).origin;
  } catch {
    origin = 'null';
  }
  return origin !== window.location.origin;
}

/** §26.6 pre-strip: remove script/style/noscript/svg + cross-origin iframe
 * markup and strip form action attributes. Mutates and returns the given root
 * (callers pass a disposable clone). */
export function stripForSerialization(root: Element): Element {
  const skipTags = new Set(['script', 'style', 'noscript', 'svg']);
  const toRemove: Element[] = [];
  root.querySelectorAll('script, style, noscript, svg, iframe, form').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (skipTags.has(tag)) {
      toRemove.push(el);
      return;
    }
    if (tag === 'iframe' && isCrossOriginIframe(el)) {
      toRemove.push(el);
      return;
    }
    if (tag === 'form') el.removeAttribute('action');
  });
  for (const el of toRemove) el.remove();
  return root;
}

/** Serialize `root`'s children incrementally at ELEMENT boundaries under
 * `budget`. A root that fits is returned whole; an overflowing root is
 * serialized as a valid fragment of complete elements — the walk descends
 * into any element whose full serialization would overflow (serialize
 * children individually) and stops at a leaf that does not fit. Never a
 * mid-element cut; truncated:true whenever any content was dropped. */
function serializeWithinBudget(root: Element, budget: number): { html: string; truncated: boolean } {
  const rootHTML = root.outerHTML;
  if (rootHTML.length <= budget) {
    return { html: rootHTML, truncated: false };
  }

  // The root wrapper itself is dropped (element-boundary descent) — the
  // serialization is incomplete by definition.
  let out = '';
  const truncated = true;

  const visit = (el: Element): boolean => {
    const full = el.outerHTML;
    if (out.length + full.length <= budget) {
      out += full;
      return true;
    }
    // Would overflow the remaining budget: never cut mid-element — descend
    // into the children (each serialized as a complete element).
    if (el.children.length > 0) {
      for (const child of Array.from(el.children)) {
        if (!visit(child)) return false; // budget exhausted inside — stop
      }
    }
    return false; // the element (or its wrapper) was dropped — stop here
  };

  for (const child of Array.from(root.children)) {
    if (!visit(child)) break;
  }

  return { html: out, truncated };
}

/** §26.6 serializer: pre-strip a clone of document.documentElement, stamp the
 * effective base URL, apply the hard cap with element-boundary truncation. */
export function serializePage(budget: number = PAGE_HTML_MAX_BYTES): PageHtmlPayload {
  const clone = document.documentElement.cloneNode(true) as Element;
  stripForSerialization(clone);
  const { html, truncated } = serializeWithinBudget(clone, budget);
  return { html, baseUrl: document.baseURI, truncated };
}

/** PAGE_HTML_PAYLOAD producer (D-84): sends the serialized payload to the
 * surface over chrome.runtime. The round-trip flows content-script → surface
 * directly; BackgroundRouter stays stateless (no background handler). */
export function sendHtmlPayload(payload: PageHtmlPayload = serializePage()): void {
  chrome.runtime.sendMessage(createEnvelope('PAGE_HTML_PAYLOAD', payload, 'content')).catch(() => {});
}