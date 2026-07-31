import type { RuntimeEnvelope } from '../runtime/RuntimeEnvelope';
import { serializePage, type SerializedPage } from './DomSerializer';

/**
 * Content-script-side EXTRACT_PAGE_CONTENT handler (D-06).
 *
 * Thin glue layer: provides the typed handler that
 * `entrypoints/content.core.ts` main() imports and registers via MessageBus.
 * The synchronous SerializedPage return value is forwarded to sendResponse by
 * MessageBus.init() (D-04) — the extension-page consumer triggers it via
 * `chrome.tabs.sendMessage(tabId, EXTRACT_PAGE_CONTENT envelope)`.
 */
export function extractPageContentHandler(
  _envelope: RuntimeEnvelope<unknown>,
  _sender: chrome.runtime.MessageSender,
): SerializedPage {
  return serializePage(document);
}
