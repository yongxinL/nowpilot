# Phase 5 — UI Review

**Audited:** 2026-08-02
**Baseline:** 05-UI-SPEC.md (design contract — data-layer phase, "no direct UI components")
**Screenshots:** not captured (no dev server on 3000/5173/8080 — code-only audit)
**Phase type:** Persistence / Infrastructure. No new screens. Frontend-visible surface = search result snippets (`<mark>` highlights in MiniSearchNoteIndex.ts), startup bootstrap wiring (knowledgeBaseBootstrap.ts + 3 entrypoints), and the 19-key i18n copy contract.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All 19 UI-SPEC copy keys present with exact match; 1 documented deferral (`notes.error`) |
| 2. Visuals | 3/4 | `<mark>` highlight structure sound (WR-07 escape-first), but visual contract incomplete: no `<mark>` color spec, non-Latin queries produce zero highlights |
| 3. Color | 4/4 | Zero color-bearing code introduced; no hardcoded colors, no accent overuse — gap is contract-side only (see Pillar 2) |
| 4. Typography | 4/4 | No typography introduced; snippet length is a data constant, not a type-scale decision |
| 5. Spacing | 4/4 | No spacing/layout introduced by bootstrap wiring or snippet builder |
| 6. Experience Design | 3/4 | Empty/loading/error state contracts satisfied at data level per UI-SPEC; surface-election identity collision can defeat MEM-02 single-writer cross-context |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Surface-identity collision in primary election** — `main.tsx` and `SidePanelShell.tsx` BOTH elect `'sidepanel'` while `AppShell.tsx` elects `'full-app'` (src/main.tsx:20, src/components/sidepanel/SidePanelShell.tsx:15, src/components/app/AppShell.tsx:15). Two contexts sharing `'sidepanel'` both pass `isPrimarySurface('sidepanel')` → MEM-02 single-writer gate is a no-op between them; two differing ids make the last-loaded surface silently read-only for memory writes. Fix: give each JS context a distinct surface identity (`'preview'` for main.tsx, `'sidepanel'` for the extension, `'full-app'` for the tab) before Phase 7 wires memory writes to UI.
2. **No color/typography contract for the `<mark>` highlight** — the ONLY visual surface this phase ships (buildSnippet, src/core/notes/MiniSearchNoteIndex.ts:69-101) has no styling spec: UI-SPEC §Color declares accent/destructive tokens but nothing for highlights, and no global CSS rules `<mark>`. Default browser yellow clashes with Ant Design dark (`#141414`) surfaces. Fix: add a `--color-mark` token (e.g., blue-6 at 20% alpha) to UI-SPEC §Color for Phase 7 consumption.
3. **Snippet highlighting silently no-ops for non-Latin queries** — `buildSnippet` extracts terms with `[a-z0-9]{3,}` (line 71): any CJK/other-script query yields zero terms, so matching results render a plain excerpt with no `<mark>` highlights (and only the first 200-char window is ever highlighted). Fix: derive highlight terms from MiniSearch's `result.match` keys (already computed at line 201) instead of re-tokenizing, or add a CJK-aware tokenizer.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Contract verified against UI-SPEC §Copywriting Contract — all 19 enumerated keys exist in `src/core/i18n/strings.ts` with exact copy match:

- Empty/loading/error: `notes.empty` (l.21), `notes.loading` (l.22), `notes.error` (l.23), `notes.saved` (l.24), `notes.searchEmpty` (l.27)
- Destructive: `notes.deleteConfirm` (l.25) "Delete this note? This cannot be undone.", `notes.deleteAction` (l.26) "Delete Note"
- Wikilink: `wikilink.unresolved` (l.33), `wikilink.create` (l.34, `{title}` template exact), `wikilink.created` (l.35), `wikilink.createAction` (l.36)
- Errors: `linkparser.error` (l.37), `notegraph.error` (l.38)
- Memory: `memory.retrievalError` (l.41), `memory.writeConflict` (l.42), `memory.summaryError` (l.43)
- CTA labels: `notes.createNew` "New Note" (l.28), `notes.save` "Save Note" (l.29), `notes.search` "Search notes" (l.30)

**WARNING (documented deferral):** `notes.error` delivers "Failed to load notes." vs UI-SPEC's "Failed to load notes. Check your connection and try again." — deliberately kept per plan's "Do NOT modify existing keys" (05-01-SUMMARY §Decisions). No UI consumer renders this key in phase 05, so zero user impact; reconcile the longer copy in Phase 7 when the Notes UI consumes it.

**WARNING (visibility):** none of the 19 keys are consumed by any component yet (grep across `src/components/` finds no `notes.`/`memory.`/`wikilink.` key usage) — the contract is declared, not rendered. This matches the phase's data-layer scope; Phase 7 must consume these exact keys.

### Pillar 2: Visuals (3/4)

The only visual surface is the `<mark>`-highlighted search snippet (src/core/notes/MiniSearchNoteIndex.ts:69-101):

- **Pass — highlight integrity (WR-07):** placeholder-token wrapping (`\uE010`/`\uE011`) → `escapeHtml` → token restore guarantees `<mark>` is the ONLY markup a snippet can ever contain. Stored-XSS at the render boundary is closed before any renderer exists (b7ce116).
- **Pass — snippet shape:** 200-char excerpt with 40-char context window around the first term match; falls back to a clean content prefix when no term matches (l.83-84). `matchedFields` derived correctly from `result.match` values (l.200-205).
- **Fail — incomplete visual contract:** UI-SPEC declares the unresolved-wikilink visual pattern (§Visual Contract) but specifies nothing for the one element this phase actually ships — the `<mark>` highlight color/weight. No CSS rule for `mark` exists in `src/index.css`. Phase 7 inherits a browser-default yellow highlight that clashes with the Ant Design dark theme.
- **Fail — silent highlight degradation:** term extraction `[a-z0-9]{3,}` (l.71) means (a) queries with any non-ASCII script produce zero terms → no highlights even on exact matches, and (b) only the first matching window is highlighted, later matches in long notes are invisible. The index itself already knows the matched terms (`result.match` keys) — the re-tokenization is redundant and lossy.

### Pillar 3: Color (4/4)

- Zero color-bearing code introduced in phase 05: `MiniSearchNoteIndex.ts`, `knowledgeBaseBootstrap.ts`, and the three entrypoint diffs add no color classes, no hex/rgb literals, no Tailwind color utilities. Grep for hardcoded colors across the phase's files: 0 hits.
- The `<mark>` default-yellow is a *contract* gap (see Pillar 2 finding), not a shipped violation — no rendered pixels exist yet. UI-SPEC's own statement ("This phase introduces no new color contracts") is technically true of code shipped but leaves the one visual surface unstyled by design.

### Pillar 4: Typography (4/4)

- No typography surface introduced. `SNIPPET_MAX_LENGTH = 200` / `SNIPPET_CONTEXT_CHARS = 40` (MiniSearchNoteIndex.ts:38-39) are excerpt-length data constants, not type-scale decisions — the snippet inherits whatever type style Phase 7 applies.
- No font-size/weight classes, no font-family declarations added in any phase-05 file.

### Pillar 5: Spacing (4/4)

- No layout surface introduced. Bootstrap wiring (main.tsx:20, AppShell.tsx:12, SidePanelShell.tsx:15) adds only a module-scope `void initializeKnowledgeBase(...)` call — zero DOM, zero spacing classes.
- Spacing scale declarations in UI-SPEC §Spacing Scale are informational for Phase 7; nothing in phase 05 can violate them.

### Pillar 6: Experience Design (3/4)

**Per contract (data-layer states, UI-SPEC §UI Considerations):**
- Empty states: `NotesDB.getAll()` returns `[]`; `MemoryEngine.retrieve()` returns `{ facts: [], summary: null }` — covered.
- Error states: all writes return discriminated unions (`{ success: false, error: string }`) — covered; `notes.error`/`memory.retrievalError` keys ready for Phase 7 rendering.
- Loading: `notes.loading` key declared; index `load()` is a startup no-op-safe restore.

**Findings:**
- **WARNING — surface-election identity collision (functional, manifests in Phase 7):** `main.tsx` elects `'sidepanel'` (comment: "the sidepanel is the primary conversational surface") in the **web-preview context**, while `SidePanelShell.tsx` (the actual extension sidepanel) elects `'sidepanel'` and `AppShell.tsx` elects `'full-app'`. Two contexts claiming the same id both satisfy `isPrimarySurface('sidepanel')` → the MEM-02 single-writer gate is defeated between them; contexts with different ids (sidepanel vs full-app) become last-election-wins read-only. When Phase 7 wires memory writes to UI, a user running web preview + sidepanel together gets either dual-writer (silent) or one read-only surface (confusing `memory.writeConflict` copy) with no user-facing explanation of which surface owns the conversation.
- **Note — silent failure path:** `initializeKnowledgeBase` never throws and only `console.error`s (knowledgeBaseBootstrap.ts:41). Acceptable today (no consumers), but Phase 7 must surface journal-replay or index-load failure via the declared `notes.error` copy rather than silently degrading to an empty index.
- **Note — module-scope side effect:** the init call fires at import time in each entrypoint — fine for extension contexts, but test/SSR imports of AppShell now trigger IndexedDB access and BroadcastBus election; Phase 7 should gate on environment if this becomes an issue.

---

## Registry Safety

`components.json` absent — project uses Ant Design v6 + Tailwind v4 (locked decision, UI-SPEC §Design System, `shadcn_initialized: false`). UI-SPEC §Registry Safety table lists zero third-party blocks ("not applicable"). No registry audit required; no flags.

---

## Files Audited

- `.planning/phases/05-knowledge-base/05-UI-SPEC.md` (design contract baseline)
- `.planning/phases/05-knowledge-base/05-01-SUMMARY.md`, `05-02-SUMMARY.md`, `05-03-SUMMARY.md` (execution summaries)
- `src/core/notes/MiniSearchNoteIndex.ts` (snippet `<mark>` rendering — the phase's visual surface)
- `src/core/knowledgeBaseBootstrap.ts` (startup wiring: index restore, journal replay, primary election)
- `src/main.tsx`, `src/components/app/AppShell.tsx`, `src/components/sidepanel/SidePanelShell.tsx` (entrypoint wiring, WR-01 commit 26ab6c2)
- `src/core/i18n/strings.ts` (19-key copywriting contract, lines 21-43)
- `src/components/chat/SidepanelChat.tsx`, `src/components/common/ActionPanel.tsx` (verified: no snippet consumers yet)
- `src/index.css` (verified: no `mark` rule)
- `tests/core/notes/MiniSearchNoteIndex.test.ts` (WR-07 escape test, commit b7ce116)

**Screenshots:** not captured — no dev server running (ports 3000/5173/8080 all closed). Code-only audit; visual findings are contract-level, which is appropriate for a data-layer phase with no rendered UI.
