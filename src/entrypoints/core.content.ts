import { defineContentScript } from 'wxt/utils/define-content-script';
import { debugLog } from '@/core/log/debugLog';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    debugLog('CONTENT_SCRIPT_LOADED', 'Content script loaded (extraction-only).');
  },
});
