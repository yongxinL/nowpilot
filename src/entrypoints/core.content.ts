// src/entrypoints/content/core.content.ts — the wxt content-script entry
// (§18 canonical content entry; W-7 path reconciliation: wxt 0.19.29 globs only
// discover `*.content.ts` AT the entrypoints root — the §18 `content/`
// subdirectory spelling is NOT discovered (verified: build emitted no
// content-scripts output for it), so the entry lives at the flat path whose name
// resolves to 'core' exactly as the plan's W-7 note promises).
//
// D-16: extraction-only skeleton — ISOLATED world (explicit for clarity; the
// default), all-URLs match, document_idle. Content scripts NEVER mount UI and
// NEVER mutate the page DOM (R-5 — extraction-only; clipboard-only write-back,
// none this phase). defineContentScript is a wxt auto-imported global (same
// pattern as background.ts).
import { ContentScriptHost } from '@/core/content/ContentScriptHost';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main: () => {
    const host = new ContentScriptHost();
    host.start();
  },
});
