# Feature Research

**Domain:** Privacy-first Chrome MV3 AI assistant + personal knowledge platform for ServiceNow Support Engineers (Copilot + Obsidian + NotebookLM in one extension)
**Researched:** 2026-08-19
**Confidence:** MEDIUM (competitive landscape; spec-grounded statements are HIGH)

> **Scope note:** The feature set is LOCKED by `.planning/PRODUCT_SPEC_v0_1.md` (§9, §17.7 RICH, §27 LLM-Wiki, §28-30 agent harness). This document does not re-invent features — it maps the competitive ecosystem onto the locked spec, flags where the spec **exceeds** market norms (differentiators) and where market norms are **weak or absent** in v0.1 (flagged GAPs for requirements definition / v0.2), and catalogs anti-features the market pushes that NowPilot must deliberately refuse.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any AI-assistant extension, local-first notes app, RAG tool, or support copilot. Missing these = product feels incomplete. **Spec coverage column** anchors each to the authoritative spec.

| Feature | Why Expected | Complexity | Spec Coverage & Notes |
|---------|--------------|------------|-----------------------|
| Chat with streaming + abort | Universal across Gemini in Chrome, Edge Copilot, Sider/Monica/MaxAI, Ollama Client | LOW | §9.1 P0 (Chat) + Phase 3. Already scaffolded (`useChatStreaming`, SSE). ✓ |
| Provider/model selector | Gemini/Edge/Sider all expose model switching; local-first tools (Jan, LM Studio) are model-agnostic by definition | LOW | §9.1 P0 (provider/model selector, read-only in side panel) + Options → Providers/Models (§9.3). ✓ |
| Selection → Ask AI (context menu) | The core interaction of ~20 commodity extensions (dassi 2026: "select text, send to AI, read response" is what half the market does) | LOW | §9.1 P1 (right-click → side panel prefilled) + `SelectionContextMenu` global add-on (§9.5). **P1, not P0 — acceptable, but it is the #1 habit-forming entry point in this category; consider promoting to P0 or at minimum asserting it in Phase 17 acceptance.** |
| Page summarization / chat-with-page | Gemini in Chrome (current-tab context by default), Edge Copilot, Sider, Monica all ship this | MEDIUM | §9.1 P0 via pinned-tab context + PageContentService (§26, Phase 6) + RICH-I-05 quick actions. Layered extraction (Defuddle → APC-lite) exceeds market (most use naive text extraction). ✓ |
| Write / rewrite / summarize actions | Sider, Monica, MaxAI, Grammarly all ship writing tools; support copilots ship draft actions | MEDIUM | §9.5 Write add-on (Rewrite professionally, Summarize, Draft customer update, Draft internal note, Explain technical issue, Create action plan, Status update) — P0. ✓ |
| Model-agnostic local + cloud providers | Privacy-first category norm: Jan, LoLLaMA, Ollama Client all support local (Ollama/LM Studio) + BYO-key cloud | MEDIUM | §10.1-10.3: 4 adapters (OpenAI, Anthropic, Gemini, Ollama) + CSP-bounded `connect-src`. Exceeds norm: **cost tiers (fast/balanced) with tier→model resolution (Appendix D)** — no competitor tiers by cost. ✓ |
| Conversation history + search | Gemini ("Find your recent chats"), Ollama Client (session search), Monica; NotebookLM added chat history after user demand | MEDIUM | §17.1b chat-history bottom sheet with **Search field**, day-grouped, star/rename/delete; Flow 17. ✓ (history search confirmed in spec) |
| Regenerate / retry / edit message | Ollama Client (regenerate/fork), SearchUnify (regenerate), Pluno (regenerate); user muscle memory from ChatGPT | LOW | §17.1 per-message action toolbar: Copy · **Expand · Regenerate** · Quote/save-note · Share · Read-aloud. ✓ |
| Per-message actions: copy, save to note | NotebookLM "Save to note" (pinned responses) was a top user-requested feature; SearchUnify/There There copy/insert buttons | MEDIUM | §17.1 toolbar (Copy, Quote/save-note) + RICH-H-06 "Save to note" first-class button + LLM-WIKI-07 structured note drafts. **Exceeds NotebookLM: drafts title/content/tags/wikilinks instead of pinning a raw response.** ✓ |
| Suggested prompts / quick actions | Gemini (starter suggestions), NotebookLM (auto-generated questions from sources), Monica (`/` prompt library), RICH welcome cards | MEDIUM | RICH-I-01 welcome cards + I-05/06 context-aware chips + IntentClassifier (I-08, no-LLM URL→action mapping, Appendix N.3). NotebookLM generates questions **from source content**; NowPilot's are capability/context cards — closest market analog, acceptable v0.1. ✓ |
| Slash commands / prompt templates | Monica (`/` library), ServiceNow (`/summarize`), There There quick prompts; Ollama Client templates | LOW | §9.1 P1 (slash commands) + §9.3 (Prompt Templates with `{{variable}}` editor, Slash Commands mapping) + §14.2-14.3. ✓ |
| Wikilinks + backlinks | Obsidian/Logseq table stakes; the entire Zettelkasten/PKM genre expects `[[wikilinks]]` | MEDIUM | Phase 8 core: `[[Title]]` authoring, ID-based edges (WIKI-ID-01…04 — **immutable-ID edges exceed Obsidian**, where rename breaks title-based links), backlinks panel, graph view (d3-force). ✓ |
| Full-text search over notes | Obsidian, Logseq, every PKM tool | LOW | MiniSearch ^7 (Phase 8) + Notes search (§17.2). ✓ |
| Tags + folders/hierarchy | Obsidian (folders + tags), Logseq (tags + namespaces); PKM table stakes | MEDIUM | CAT-01…05 categoryPath (folder-mapped hierarchy) + tags (many-to-many) + NoteList tree view. ✓ |
| Markdown files on disk / portability | Obsidian's core promise: "a vault is a folder... a note stays readable if the company disappears" | MEDIUM | SYNC-01…11 one-way filesystem backup, OKF v0.2-compatible frontmatter (SYNC-04), restore with preview (SYNC-09/10). **Portability claim is honestly weaker than Obsidian v1 (backup is one-way, not vault-as-source-of-truth) — §27.9 explicitly defers bidirectional sync.** ✓ for v0.1 scope |
| RAG "ask your notes" with citations | NotebookLM's defining loop; support copilots (Intercom, Pluno, Groove) all link top sources | MEDIUM | LLM-WIKI-06 Ask-notes RAG: MiniSearch top-5 + memory facts → balanced-tier synthesis → **per-statement citation Tags** (Flow 13). ✓ |
| Grounded answers: "not in sources" honesty | NotebookLM refuses out-of-source answers and says so; ResearchSkill "graceful failure otherwise — never silently fall back to model-only answers" (§9.8) | LOW | §9.8 (ResearchSkill) + §19.19 (RAG no-results edge case). ✓ — and the evidence/receipt model (AGT-02, CTX-03) goes **further than any competitor** (see Differentiators) |
| Case/chat summarization | Now Assist for CSM/ITSM, Sprinklr, Groove, Kore.ai all ship it; the #1 support-copilot feature | MEDIUM | §9.7 CaseAnalyzerSkill (P0) + CatchUpSkill (P0, 24 h digest) + Write "Summarize". ✓ |
| Suggested replies grounded in KB + history, agent reviews before send | Universal across all support copilots (Intercom, Pluno, Text, Groove, SearchUnify); "agent always reviews/edits before sending" is non-negotiable | MEDIUM | Write add-on "Draft customer update" (P0) + case context (P0) + **user-is-gatekeeper** everywhere (LLM-WIKI-07, tool permission prompts). ⚠️ **GAP: on-demand drafting only — no real-time auto-suggest while reading a case** (market norm). Defensible: auto-suggest needs host-page/workspace integration beyond v0.1 surfaces; flag for v0.2 with page injection (§25). |
| Knowledge/similar-case lookup | SearchUnify Top Related Cases (with resolution previews), Groove similar-ticket search, Pluno past-resolved-tickets, Now Assist GAF Suggested Steps | MEDIUM | ⚠️ **PARTIAL GAP: entry point exists** — `sn-similar-cases` "Check similar cases" quick action (Appendix N.3 IntentClassifier) maps to a prompt template; SNowTableClient (P0) can query the case table. **No structured "similar cases" results surface (card list with resolution previews) is specified** — market norm. Recommend: acceptance criterion on §9.7 ServiceNow add-on requirements (a similar-cases result card driven by Table API query + LLM/ranked list) or explicit v0.2 scope. |
| Sentiment analysis | Now Assist (with visible reasoning + suggested actions), Sprinklr (sentiment-triggered escalations), Kore.ai | MEDIUM | §9.7 SentimentSkill (P1). ⚠️ **GAP vs Now Assist: no "visible reasoning" for sentiment classification and no sentiment-triggered actions** (those need ServiceNow-side workflow integration — correctly out of scope; persona-based empathetic framing RICH-R-06 partially covers the intent). |
| First-run onboarding | Gemini opt-in flow, Now Assist admin setup; a user who can't configure a provider in 2 minutes churns | LOW | §9.2 P0 (first-run onboarding) + RICH-R-03 "Meet NowPilot" persona card + Flow 9. ✓ |
| Diagnostics / error surfacing | Ollama Client (privacy screen, diagnostics), all serious tools | MEDIUM | §9.3 Diagnostics + §4 (AITransactionLog, TraceRedactor) + §12 error states per page. **Exceeds norm: transaction traces + debug bundle export.** ✓ |
| Translation | Monica/Sider treat it as core; spec keeps it | LOW | Options → Translate tab (existing scaffold) + Write/chat flows. ✓ |
| Export / import of data | Ollama Client, AnythingLLM (backup/reset), Obsidian (files are the export) | MEDIUM | §9.3 Import/Export (sanitised JSON/ZIP) + Flow 6 + §27.3 restore-from-folder. ✓ |
| Chat history persistence across sessions | NotebookLM initially shipped WITHOUT chat history — user demand forced it; persistence is now expected | LOW | Flow 17 + session store (§21.1) + §17.1b. ✓ (spec's "no cross-session resumption w/ full replay" §17.7.7 refers to replay/continuation, not history visibility) |
| Attach/screenshot input | Gemini (screenshot), Monica (image), Ollama Client (files+images) | MEDIUM | §17.1 composer: Screenshot/snip + Attach (P0 UI) + Phase 16 multimodal foundation (MM-01…06). ✓ |

**GAP summary vs market norms (v0.1 scope):**

| # | Gap | Market Evidence | Spec Status | Recommendation |
|---|-----|-----------------|-------------|----------------|
| G-1 | Structured "similar cases" results surface | SearchUnify, Groove, Pluno, Now Assist GAF | Entry point only (`sn-similar-cases` quick action, App. N.3) | Acceptance criterion on §9.7 or v0.2 |
| G-2 | Real-time auto-suggested replies in case context | All support copilots | On-demand only (Write add-on) | v0.2 with page injection (§25); keep on-demand in v0.1 |
| G-3 | Handoff/transfer-specific case summary | Sprinklr, Now Assist (transfer summaries) | CatchUpSkill (24 h digest) is close but not transfer-targeted | Cheap: acceptance criterion on CatchUpSkill or Write "Draft internal note" |
| G-4 | Confidence % surfaced on suggestions | Kore.ai (95% shown), SearchUnify | LLM-WIKI-11 gates at 0.60 **internally**, never displayed | Observation: receipt model (CTX-03) is stronger internally; optional v0.2 display |
| G-5 | PDF chat | Sider/Monica ChatPDF; NotebookLM PDFs | Explicitly deferred (§6.5) | Correct deferral for support engineers (case data lives in ServiceNow, not PDFs); revisit v0.2 |
| G-6 | Source-content-derived suggested questions | NotebookLM generates questions from your material | Static capability cards (RICH-I-01/02 sort by usage) | v0.2 enhancement to welcome cards |

### Differentiators (Competitive Advantage)

Features where NowPilot exceeds market norms. These align with the Core Value (privacy-first, local-first, capture-once-retrieve-with-citations) and should be **lead with in marketing/onboarding copy**.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| No-telemetry, no-account, local-first by default | Jan/LoLLaMA/Ollama Client match this, but **AnythingLLM ships PostHog telemetry default-on** and NotebookLM/Now Assist/Sider/Monica are cloud-locked accounts. NowPilot has no server at all | LOW (it's a constraint, not a feature) | §0.2, §6.1, §16.5; CSP-bounded `connect-src`. Brand-defining. |
| Trust-aware context receipts (CTX-03) | ContextProvenanceManifest shows inclusion, omission, original/final tokens, compression, cache eligibility — **transparency no competitor offers** (NotebookLM shows citations but not what was omitted/compressed) | HIGH | Phase 7; pairs with AGT-02 CompletionEvidence ("Renderer must not claim execution without matching evidence") |
| AI-native notes with accept/reject enrichment (LLM-WIKI-01/11) | Obsidian's AI is bolt-on plugins (Smart Connections, Copilot) that "aren't aware of your graph structure"; NotebookLM doesn't enrich your own notes on save. NowPilot: one fast call → ≤5 tags + category + summary + memory facts, **user accepts/rejects, confidence-gated at 0.60** | MEDIUM | Phase 9; D-01 single-call design |
| Staleness detection (LLM-WIKI-08) | Scribelet 2026: "notes go stale in every system... the step every PKM system skips" — **Obsidian and Logseq have no concept of staleness**. NowPilot flags "Content has changed — Regenerate tags/summary" | LOW | Phase 9; passive timestamp comparison (D-06, MV3-friendly) |
| Orphan detection + "Find context" (LLM-WIKI-09) | Obsidian graph "rewards consistent effort, punishes neglect" (fabric.so); orphan pruning is a manual ritual. NowPilot badges orphans algorithmically and offers RAG-based recontextualization | LOW | Phase 9; no LLM for detection |
| Chat/page → structured note drafts with wikilink suggestions (LLM-WIKI-07) | NotebookLM pins raw responses; Monica Memo saves raw; NowPilot drafts title/content/tags/wikilinks/categoryPath for user review (user is gatekeeper) | MEDIUM | Phase 9; NoteChatConverter with memory context (NMEM-03) |
| Memory-aware RAG (NMEM-01) | NotebookLM has no user memory; support copilots know the customer, not the agent's own accumulated facts. NowPilot blends personal facts + notes in one query | MEDIUM | Phase 8/9; MemoryEngine conflict resolution (MEM-03) |
| OKF-compatible filesystem backup + restore preview (SYNC-04/09/10) | Obsidian-grade portability (plain .md, any tool can read it — OKF v0.2 frontmatter) + NotebookLM-grade grounding, **without lock-in**; restore preview ("24 notes: 12 new, 3 updated, 9 unchanged") exceeds Obsidian import UX | MEDIUM | Phase 9; one-way by design (§27.9) |
| Per-case ServiceNow context without admin rights (JSESSIONID/sysparmCK extraction, Table API client) | Now Assist is an enterprise SKU needing admin configuration, 2k-3k-case clusters (GAF), and platform licensing. NowPilot works **for a single engineer, BYO, read-only** — a personal copilot Now Assist structurally cannot be | HIGH | §9.7 P0; CookieSessionStore + SNowTableClient + RateLimiter; PROXY_FETCH (Phase 17/18) |
| Cost-tiered model routing (fast/balanced → provider/model) | Gemini in Chrome locks you into Gemini; Edge Copilot into Microsoft models; Sider/Monica aggregate models but don't tier by cost. NowPilot routes analysis to fast tier, synthesis to balanced tier (D-07) | MEDIUM | §1.5, Appendix D; Phase 3 |
| Bounded multi-role collaboration (COLLAB-01…13) | No competitor at this scale ships verified multi-role plans with a reviewer role (COLLAB-07) and single-agent default that never pays overhead | HIGH | Phase 14/§30; closed role registry, handoff artifacts |
| Verified continual evolution (EVO-01…06, PROP-01…06) | "Self-learning" in competitors = silent prompt tweaks or model updates. NowPilot: evaluation failure → typed candidate → sandbox eval → **human approval**, deterministic proposer, cost-capped (50k token eval budget) | HIGH | Phase 13/§28.7a; brand-safe "human-verified evolution" |
| Persona + RICH conversational UX (R, I, C, H) | Gemini has no persona; support copilots have no personality layer; Edge Copilot's "tone" is thin. NowPilot: persona profile injected across pipeline stages, clarification with option chips (max 2 rounds then best-effort), follow-up chips, stage indicators | MEDIUM | Phase 15 (§17.7, 60 requirements); persona runtime Phase 3 |
| Layered page extraction with privacy-safe parsing (Defuddle `useAsync:false`, CSP) | Gemini/Edge send page HTML to their clouds; commodity extensions send raw text. NowPilot extracts clean Markdown **locally** (Defuddle → APC-lite) with XSS hardening (CVE-2026-30830 fix line) | MEDIUM | §26 + §16.1; Phase 6 |
| Onboarding as "Meet NowPilot" (RICH-R-03) + progressive education (I-12…14) | Gemini: bare opt-in dialog. Monica: paywall immediately. NowPilot: persona card + capability cards + staged tips | LOW | Phase 15 |
| ResearchSkill with graceful failure + permission gate (§9.8) | Monica/Sider auto-inject web results; Harpa monitors continuously. NowPilot: explicit `/research`, source-annotated output, **never silently falls back to model-only answers**, subject to PermissionGate + RateLimiter | MEDIUM | Phase 17/18; user-connected MCP web-search server first |

### Anti-Features (Commonly Requested, Often Problematic)

Features the market pushes that would damage NowPilot's privacy-first positioning, burn v0.1 budget, or duplicate commoditized surface area.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Browser automation / page control ("see the page, navigate, act") | The 2026 extension race (Sider Claw, Harpa RPA, dassi "AI works on the page alongside you"); review sites call it the "single biggest functional difference" | Needs `chrome.debugger` + trusted input events; violates the privacy posture; enterprise ServiceNow instances prohibit automation; compliance risk on customer data; huge attack surface | Keep read-only (MM-07 P0 boundary, §26.7 defers automation to v2). **The privacy-first niche is the opposite of the automation race — that's the positioning.** |
| Telemetry / usage analytics (even "anonymous") | Every SaaS wants product metrics; AnythingLLM ships PostHog default-on | "Anonymous" telemetry is a lie users of privacy tools detect; one beacon destroys the brand; adds GDPR/DPA surface | Zero telemetry; in-product feedback (RICH-C-09/10, logged anonymously, no user-identifiable data) as the only signal |
| Cloud account + cloud sync | Multi-device continuity; competitors monetize it (Obsidian Sync $4-8/mo) | Requires a NowPilot server → data-leave-machine violation → "no data leaves unless you opt into a cloud provider" becomes marketing fiction | Local-first + filesystem backup (SYNC) + import/export; restore-from-folder IS the multi-device story |
| Host-page UI injection (email-in-Gmail, floating widgets, CaseInsightBox) | Monica/Sider's email replies and page widgets are visible value | Content-script UI breaks on DOM changes, needs per-site maintenance, and §25 defers it; the spec already fences (R1 reconciliation: clipboard-only) | Extension-owned surfaces (side panel + Standalone); v0.2 page injection per §25 reintroduction plan |
| Auto-create notes from chat, unprompted | "Save everything automatically" sounds like the ultimate capture tool | Note sprawl; destroys the user-as-gatekeeper trust model; LLM-WIKI-07 explicitly requires review | Save-to-note with drafted content + review (LLM-WIKI-07); memory facts auto-extracted but user-controlled (MEM-04) |
| GAF-style case clustering / org-wide suggested steps | Now Assist's Suggested Steps win metrics (time-to-resolution) | Requires 2k-3k case clusters + admin ML infra — structurally impossible and wrong for a personal tool | Personal "how did I solve this before" via Ask-notes RAG + memory (NMEM-01) |
| Deep-Research agent crawling hundreds of pages | NotebookLM Deep Research, Monica Deep Research produce impressive reports | Token/latency cost explosion; research breadth ≠ support engineer need; spec's cost-effective mandate (§0.3) | Bounded `/research` (maxSources, permission-gated, graceful failure) |
| Audio/Video Overviews (podcast-style summaries) | NotebookLM's viral feature | Needs hosted TTS or heavy local TTS; TTS output explicitly deferred; support engineers don't listen to case notes | Voice **input** (RICH-H-17, MM-04) is in scope; read-aloud per-message action exists (§17.1) |
| Embedding/vector search infrastructure | "Semantic search" is the fashionable RAG answer | IndexedDB vector stores + embedding calls add cost/complexity; MiniSearch + LLM rerank (LLM-WIKI-05) covers v0.1 semantic intent; spec defers embeddings (§6.5, §27.9) | "AI-enhanced" rerank indicator; revisit only if retrieval quality demonstrably fails |
| RPA-style continuous monitoring (price/page-change alerts) | Harpa's differentiator; "always-on assistant" | Background alarms + polling violate MV3 sleep + privacy; Scheduler is already scoped to internal needs (§10.6) | None in v0.1; explicit no |
| Side-by-side multi-model comparison chats | Sider/Monica's "chat with all AIs at once" | Cost multiplication; context duplication; confuses trust model; NowPilot's value is one coherent verified pipeline, not a model zoo | Model selector per chat + provider priority + tier routing (§1.5) |
| Real-time collaborative editing / team sharing | Notion/Google-Docs norm; Obsidian Publish exists | Needs a server (anti-feature #3); out of scope §27.9; violates local-first | Filesystem backup as the sharing vehicle (drop the folder in Git/Drive) |

## Feature Dependencies

```
[Save to note (LLM-WIKI-07)]
    └──requires──> [Notes CRUD + MiniSearch (Phase 8)]
                       └──requires──> [PageContentService (Phase 6)]
    └──enhanced──> [Memory-aware drafts (NMEM-03, Phase 9)]

[Ask notes RAG (LLM-WIKI-06)]
    └──requires──> [MiniSearch index + MemoryEngine (Phase 8)]
    └──requires──> [Evidence/receipt model (Phase 7)]  ── per-statement citations

[LLM auto-tag/categorize/summarize (LLM-WIKI-01)]
    └──requires──> [Fast-tier AI runtime + tiers (Phase 3)]
    └──enhanced──> [Staleness detection (LLM-WIKI-08)]  ── timestamp comparison on same fields

[Filesystem sync (SYNC-01…11)]
    └──requires──> [Notes store (Phase 8)] + [Standalone view surface (Phase 1)]
    └──conflicts──> [Bidirectional sync]  ── explicitly out (§27.9); one-way only

[Context-aware quick actions (RICH-I-05/06)]
    └──requires──> [PageContentService (Phase 6)] + [add-on context extractors (Phase 17)]
    └──enhanced──> [IntentClassifier (I-08)]  ── no-LLM URL→action mapping

[Selection → Ask AI]
    └──requires──> [Content-script runtime + SelectionContextMenu (Phase 17)]
    └──enhanced──> [Tab pinning + PageContextBridge]  ── prefilled context

[ServiceNow skills (CaseAnalyzer/CatchUp/Sentiment/CodeSearch)]
    └──requires──> [SNowTableClient + CookieSessionStore + case extraction (Phase 17)]
    └──requires──> [Tool governance + PROXY_FETCH + RateLimiter (Phase 18)]
    └──requires──> [AI runtime (Phase 3)]

[RICH conversation UX (§17.7)]
    └──requires──> [Persona runtime (Phase 3, RICH-R-01/02/10)]
    └──requires──> [Phase 15 UI sub-waves 15.3/15.4/15.5]

[Multimodal input (Phase 16)]
    └──requires──> [Sender/attach UI (§17.1, Phase 15)]
    └──requires──> [Vision-capable model configured (MM-03)]  ── else MULTIMODAL_MODEL_UNAVAILABLE

[Verified evolution (Phase 13)]
    └──requires──> [Evaluation golden suites (Phase 12)]
    └──requires──> [Transaction logs (Phase 11)]

[Multi-role collaboration (Phase 14)]
    └──requires──> [Agent harness (Phases 4/7/10)]
    └──requires──> [Single-agent baseline gate (COLLAB-11)]  ── ship only if it beats one-role
```

### Dependency Notes

- **Ask-notes RAG requires the evidence model (Phase 7), not just retrieval (Phase 8):** the market's citation expectation (NotebookLM/Intercom-style) is satisfied by LLM-WIKI-06's per-statement citation Tags, which depend on receipts/evidence infra — ordering Phase 7 before Phase 8/9 is deliberate.
- **Filesystem sync conflicts with bidirectional sync:** one-way backup keeps MV3 constraints (no background jobs, D-06) and avoids external-file conflict resolution (SYNC-06 handles only overwrite prompts). Bidirectional is the #1 Obsidian-user expectation — document it loudly as v0.2.
- **ServiceNow skills cluster at Phase 17/18, not earlier:** they need the content-script runtime + tool governance + CORSProxy. The add-on shell exists from Phase 1 (TeamGQM scaffold), but skills must not precede their runtime dependencies.
- **RICH depends on Phase 3 persona runtime:** persona injection (R-02) shapes every downstream prompt; building UI before the persona contract risks rework — spec ordering (Phase 15) is correct.

## MVP Definition

> The v0.1 feature set is LOCKED by the spec's 19-phase plan (§18). This section maps market-informed priorities onto that plan; it does not change it.

### Launch With (v0.1 — spec P0, phases 1-19)

- [x] Chat streaming + abort + provider/model selection (Phases 1-3)
- [x] Side panel + Standalone two-surface workspace with handoff (Phase 1)
- [x] Notes + wikilinks + backlinks + graph + MiniSearch (Phase 8)
- [x] Save-to-note with structured drafts (Phase 9)
- [x] Ask-notes RAG with per-statement citations + memory-aware retrieval (Phases 8-9)
- [x] LLM auto-tag/categorize/summarize with accept/reject + confidence gating (Phase 9)
- [x] One-way filesystem backup + restore-from-folder (Phase 9)
- [x] PageContentService layered extraction for pinned tabs (Phase 6)
- [x] ServiceNow case context + CaseAnalyzer + CatchUp skills (Phases 17-18)
- [x] Write add-on (draft/rewrite/summarize/customer-update) (Phases 17-18)
- [x] Agent with tool permission prompts + evidence-backed completion (Phases 3-4, 18)
- [x] RICH P0: persona, welcome cards, context-aware quick actions, clarification chips, follow-up chips, stage indicators (Phases 3, 15)
- [x] /research with sources + graceful failure (Phases 17-18)
- [x] Export/import, diagnostics, first-run onboarding (Phases 2, 11, 15)
- [x] No telemetry, local-first, CSP-bounded (all phases — architectural constraint)

### Add After Validation (v0.1 P1 / early v0.2)

- [ ] Selection → Ask AI (context menu) — **promote to P0 if onboarding data shows users discover chat via selection** (Phase 17)
- [ ] Tab pinning (cap 10, market norm is 6-10 — Gemini 10) (Phase 17)
- [ ] Sentiment skill + CodeSearch skill (Phase 17)
- [ ] Multimodal input: image paste, voice input (Phase 16)
- [ ] Chat history search is P0-adjacent already; star/rename/delete polish (Phase 15)
- [ ] RICH P1: suggestion templates catalog, closure zone ("Did this help?"), split-pane context panel, image attach (Phase 15)
- [ ] Similar-cases result card (G-1) — acceptance criterion on §9.7
- [ ] Handoff-targeted case summary (G-3) — acceptance criterion on CatchUpSkill

### Future Consideration (v0.2+ / P2)

- [ ] Page injection: CaseInsightBox, host-page quick actions, write-back (clipboard-only in v0.1; R1 reconciliation; §25 plan) (G-2 unlocks here)
- [ ] PDF chat (G-5) — revisit once page-content pipeline is proven
- [ ] TTS output; webhooks/insights feature flags (§9.3)
- [ ] Bidirectional filesystem sync (§27.9) — the Obsidian-parity ask; requires external-change watch design
- [ ] Embedding/vector search if rerank quality fails
- [ ] Browser automation (v2, §26.7 — needs ratified addendum spec)
- [ ] Source-derived suggested questions on welcome cards (G-6)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority (spec) |
|---------|------------|---------------------|-----------------|
| Chat streaming + abort | HIGH | LOW | P0 |
| Page summarization / chat-with-page | HIGH | MEDIUM | P0 |
| Notes + wikilinks + backlinks + graph | HIGH | MEDIUM | P0 |
| Save-to-note (structured drafts) | HIGH | MEDIUM | P0 |
| Ask-notes RAG with citations | HIGH | MEDIUM | P0 |
| Filesystem backup + restore | HIGH | MEDIUM | P0 |
| ServiceNow case context + CaseAnalyzer/CatchUp | HIGH | HIGH | P0 |
| Write add-on (customer-update drafting) | HIGH | MEDIUM | P0 |
| Agent + tool permission prompts + evidence | HIGH | HIGH | P0 |
| No-telemetry / local-first posture | HIGH (brand) | LOW | P0 (constraint) |
| Onboarding + persona card | MEDIUM | LOW | P0 |
| Selection → Ask AI | HIGH (habit-forming) | LOW | **P1 — market says P0; flag** |
| Tab pinning | MEDIUM | MEDIUM | P1 |
| Slash commands / prompt templates | MEDIUM | LOW | P1 |
| Chat history search | MEDIUM | MEDIUM | P1 (in §17.1b spec) |
| Sentiment skill | MEDIUM | MEDIUM | P1 |
| CodeSearch skill | MEDIUM | HIGH (needs ≥16K ctx) | P1 |
| Multimodal input (image/voice) | MEDIUM | MEDIUM | P1 |
| RICH conversation layer (chips, persona, welcome) | MEDIUM | MEDIUM | P0/P1 mix (§17.7.6) |
| Similar-cases result card (G-1) | HIGH for support engineers | MEDIUM | **Not specified — flag for §9.7 acceptance / v0.2** |
| Auto-suggest replies in case context (G-2) | HIGH | HIGH (host-page) | v0.2 (§25) |
| Handoff summary (G-3) | MEDIUM | LOW | Acceptance criterion |
| Confidence display (G-4) | LOW-MEDIUM | LOW | v0.2 observation |
| PDF chat (G-5) | MEDIUM | MEDIUM | Deferred (§6.5) |
| Multi-role collaboration | MEDIUM (differentiator) | HIGH | P1 (Phase 14) |
| Verified evolution | MEDIUM (differentiator) | HIGH | P1 (Phase 13) |
| Browser automation | HIGH (market pressure) | HIGH + risky | **Anti-feature — v2 only, §26.7** |
| Telemetry | — | — | **Anti-feature — never** |

**Priority key:** P0 = must have for launch · P1 = should have · P2 = nice to have · GAP = market norm missing from spec — flag for requirements definition.

## Competitor Feature Analysis

| Feature | Obsidian | NotebookLM (Gemini Notebook) | Gemini in Chrome / Edge Copilot | Now Assist (ServiceNow) | Sider/Monica/MaxAI | **NowPilot v0.1** |
|---------|----------|-------------------------------|-------------------------------|--------------------------|--------------------|-------------------|
| Chat w/ page context | — | sources only | ✓ current tab by default | ✓ case context | ✓ | ✓ pinned tabs (Phase 6) |
| Selection → ask | — | — | partial (tab sharing) | — | ✓ (the commodity) | ✓ P1 (Phase 17) |
| Wikilinks/backlinks/graph | ✓ core | — | — | — | — | ✓ (Phase 8, ID-based edges — stronger than Obsidian) |
| Full-text search | ✓ | ✓ | — | ✓ AI Search (semantic) | ✓ | ✓ MiniSearch + LLM rerank |
| RAG with citations | plugin (Smart Connections) | ✓ defining feature | — | ✓ AI Search RAG | partial (Memo) | ✓ LLM-WIKI-06 + receipts (CTX-03) |
| Auto-tag/summarize own notes | plugins, bolt-on | — (doesn't enrich your notes) | — | KB generation (org-level) | — | ✓ accept/reject + confidence gating |
| Staleness detection | ✗ (known gap) | ✗ | ✗ | ✗ | ✗ | ✓ LLM-WIKI-08 |
| Save response → note | manual | ✓ pin (raw) | ✗ | — | ✓ Memo (raw) | ✓ structured draft + wikilinks |
| Files on disk | ✓ (vault = source of truth) | ✗ cloud | ✗ | ✗ | ✗ | ✓ one-way backup, OKF-compatible |
| User memory | ✗ | ✗ | ✗ (account data, not memory) | ✗ (case data only) | partial (Memorize) | ✓ MemoryEngine + memory-aware RAG |
| Case summarization | — | — | — | ✓ core skill | — | ✓ CaseAnalyzerSkill |
| Catch-up digest | — | — | — | ✓ (transfer summaries) | — | ✓ CatchUpSkill (24 h) |
| Similar-case lookup | — | — | — | ✓ GAF (needs 2k-3k cases) | — | ⚠️ quick action only (G-1) |
| Sentiment | — | — | — | ✓ w/ reasoning + actions | — | ✓ P1 (no reasoning display, G-4) |
| Suggested replies | — | — | — | ✓ email/chat recs | ✓ Gmail replies | ✓ on-demand (Write), no auto-suggest (G-2) |
| Telemetry | none (local app) | Google-scale (cloud) | Google/Microsoft (cloud) | enterprise (cloud) | yes (cloud accounts) | **none — zero** |
| Model choice | n/a (no native AI) | Gemini only | locked ecosystems | enterprise LLM SKU | multi-model zoo | 4 providers + cost tiers |
| Privacy posture | local-first ✓ | cloud, "never trains on your data" | cloud, opt-in sharing | enterprise SaaS | cloud | **local-first, no server at all** |
| Works without admin rights | ✓ | ✓ (consumer) | ✓ (consumer) | ✗ (enterprise SKU) | ✓ (consumer) | **✓ — the Now Assist gap for individual engineers** |
| Agentic/verified execution | ✗ | partial (agentic chat) | partial (multi-step) | ✓ agentic orchestration | ✓ (Claw/agents) | ✓ bounded + evidence + evolution gates |

**Competitive positioning summary (opinionated):**
1. **Against commodity extensions (Sider/Monica/MaxAI):** NowPilot must NOT fight on surface features (they win on model zoo + page automation) — it wins on **depth**: verified agent, knowledge compounding (notes+RAG+memory), zero telemetry, and a domain (ServiceNow) where commodity extensions are useless.
2. **Against Obsidian:** NowPilot wins on **native AI** (Obsidian's is bolt-on) and staleness/orphan maintenance (Obsidian's known gaps); Obsidian wins on file-as-source-of-truth and plugin ecosystem. One-way backup keeps the portability promise honest; bidirectional sync is the v0.2 parity item.
3. **Against NotebookLM:** NowPilot wins on **memory + personal notes lifecycle + local-first**; NotebookLM wins on source breadth (multimodal sources, Deep Research) and citation-to-exact-passage UX. NowPilot's citations navigate to notes, not passages — acceptable, but the receipts model adds omission transparency NotebookLM lacks.
4. **Against Now Assist:** NowPilot is not a competitor to Now Assist — it is the **individual-engineer complement**: zero admin config, works on any instance the engineer can log into, personal knowledge that survives job/tenant changes, no org data requirements (GAF's 2k-3k cases are the anti-pattern for NowPilot). Market the "personal copilot Now Assist structurally cannot be."

## Sources

**Competitive landscape (MEDIUM confidence — websearch, cross-checked across independent sources):**
- dassi.ai — "Best AI Chrome Extensions (2026): I Tested 20, Only 3 Are Worth It" (2026-02) — commoditization verdict on selection→ask extensions
- analyticsinsight.net — "Best AI Browser Assistants for Daily Work in 2026" (2026-08) — Gemini in Chrome, Edge Copilot, Comet, Dia positioning
- support.google.com/chrome (Gemini in Chrome docs), gemini.google/overview — tab sharing (10 tabs), `@` mention, Live mode
- sider.ai, chromewebstore (Monica, Sider, MaxAI listings) — feature surfaces of commodity extensions
- seodatapulse.com — Sider vs Monica vs Harpa comparison (2026-04)
- itsfoss.com, scribelet.app (2026-08), notes.so, toolchase.com, toolchew.com, fabric.so, atlasworkspace.ai — Obsidian vs Logseq 2026 comparisons; Scribelet staleness insight
- notebooklm.google, support.google.com/notebooklm, blog.google (NotebookLM dev story 2025-07), felloai.com (2026-05 guide) — NotebookLM/Gemini Notebook features + citation habit
- servicenow.com community docs — Now Assist for CSM (summarization, email/chat recommendations, sentiment, GAF suggested steps, AI Search), Now Assist skills walkthroughs (2025-2026)
- intercom.com/helpdesk/copilot, pluno.ai, help.groovehq.com, docs.searchunify.com, docs.kore.ai, sprinklr.com, text.com, there-there.app — support copilot feature sets
- janhq/jan GitHub, anythingllm.com + Mintplex-Labs/anything-llm GitHub (telemetry disclosure), docs.anythingllm.com (browser extension), Shishir435/ollama-client GitHub + Chrome Web Store, anugotta/lollama-ai-assistant — privacy-first local AI landscape

**Authoritative spec (HIGH confidence — primary source):**
- `.planning/PRODUCT_SPEC_v0_1.md` rev 2026-08-12 — §9, §17.1/17.7, §26, §27, §28-30, Appendix N.3
- `.planning/PROJECT.md` — scope fences, out-of-scope list
- `.planning/codebase/ARCHITECTURE.md` — existing scaffold capabilities

---
*Feature research for: NowPilot (privacy-first Chrome MV3 AI assistant + personal knowledge platform for ServiceNow Support Engineers)*
*Researched: 2026-08-19*