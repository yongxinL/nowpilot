# Research Reconciliation

**Project:** NowPilot
**Created:** 2026-08-19
**Status:** Authoritative resolution surface for the five GSD research docs
**Applies to:** `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `STACK.md`, `SUMMARY.md`

---

## 0. Purpose & precedence rules

The five research docs are high quality and spec-anchored, but they contain **stack conflicts with the spec, one internal contradiction, a set of forward-dated single-source facts, and research-derived requirements that have no spec ID.** Handed raw to a cost-effective model, those produce contradictory instructions. This document is the **single place** those are resolved.

**Precedence order (highest first):**

1. `.planning/PRODUCT_SPEC_v0_1.md` — the locked single source of truth.
2. **An ADR** that explicitly records a deviation from the spec (this doc proposes the ADRs; you sign off).
3. This `RESEARCH-RECONCILIATION.md` (authority tags + VERIFY register).
4. `SUMMARY.md` (the per-phase research pack).
5. `ARCHITECTURE.md` / `FEATURES.md` / `PITFALLS.md` / `STACK.md` (raw research; deepest detail, lowest precedence).

**Rule for GSD / REQUIREMENTS.md:** a research-derived criterion may only enter `REQUIREMENTS.md` with (a) a `REQ-*` ID from §D below and (b) its authority tag — `consistent-with §X` / `augments §X` / `conflicts-with §X → ADR`. Nothing from the raw docs is authoritative until it appears here.

---

## A. Stack conflicts (STACK.md vs spec §7)

`STACK.md` recommended **holding** three packages below the spec's §7 pins. **Verified against the current spec 2026-08-19:** the spec **already** pins `immer ^11` and `zod ^4`, so those two "holds" are stale-doc errors, not spec deviations — overruled outright. Only WXT is a genuine (accepted) deviation.

| ID | Package | Spec §7 pin (SoT) | STACK.md said | Resolution |
|---|---|---|---|---|
| **A-1** | WXT | `^0.21` (≥0.21.4) | Hold 0.20.27 | **ADOPT the hold for v0.1 → ADR-STACK-01.** Scaffold builds on 0.20.27; 0.21 flips generated tsconfig to `strict:true` mid-milestone. `^0.21` is the **post-v0.1 target**. Authoritative v0.1 version: **`wxt@^0.20.27`**. |
| **A-2** | Immer | `^11` (≥11.1.16) | Hold 10.2.0 | **OVERRULED — follow spec.** Spec §7.3 already pins `^11` (prototype-pollution hardening; `produce`/draft API unchanged). STACK.md was stale. Authoritative: **`immer@^11`**. No ADR needed. |
| **A-3** | Zod | `^4` (≥4.4) | Keep `^3.24.0` | **OVERRULED — follow spec.** Spec §7.4 already pins `^4` (MCP SDK + AI SDK 5 target zod/v4); `3.24.0` was below the spec's own `3.25+` floor. Appendix L keeps `zod-to-json-schema` regardless. Authoritative: **`zod@^4`**. No ADR needed. |

**Net stack outcome (authoritative for REQUIREMENTS.md):** `wxt@^0.20.27` (held, ADR-STACK-01) · `immer@^11` (spec) · `zod@^4` (spec) · `+unlimitedStorage` at Phase 2 (ADR-STACK-02). All other §7 pins unchanged.

---

## B. Internal contradiction — where does Defuddle run?

**The contradiction (now fixed in STACK.md):**
- `ARCHITECTURE.md` (§3.3, Pattern 6) + spec §26.4: Defuddle is **NOT** bundled in the content script; the content script serializes stripped HTML + stamps the base URL, and **Defuddle parses PANEL-SIDE** on a detached `DOMParser` doc.
- `STACK.md` (original) said Defuddle *"runs in the content-script isolated world (needs getComputedStyle)."*

**Resolution:** **Panel-side is authoritative** (spec §26.4). Bundling Defuddle in the content script would blow the <50 KB extraction bundle and fail the `no-content-script-ui` isolation grep (§24). `SUMMARY.md` was already correct.

**The real technical question → Phase 6 research spike (`SPIKE-P6-01`):**
> A **detached** `DOMParser` document has **no layout and no `getComputedStyle`**. Does `defuddle/full` `parse()` depend on computed style / live layout that only exists in the content script's live DOM?
>
> **Exit criteria:** run `defuddle/full` `parse({markdown:true, useAsync:false})` on captured ServiceNow-portal + KB-article HTML in a panel context; compare fidelity vs a live-DOM baseline. If computed-style dependence is material, the fallback is a **thin content-script measurement pass** (read only the needed layout signals, still no parsing, still <50 KB) messaged to the panel — NOT moving Defuddle into the content bundle. Record outcome as ADR-P6-01.

---

## C. Forward-dated / single-source facts → `VERIFY-AT-IMPLEMENTATION`

None may be hard-coded into a requirement as fact. Tag = `VERIFY-AT-IMPLEMENTATION` (VAI).

| VAI | Claim | Source doc | Verify how / when |
|---|---|---|---|
| **VAI-01** | `CVE-2026-30830` (Defuddle XSS fix in 0.19.x) | STACK.md, SUMMARY.md | Confirm CVE id + fixed version at Phase 6 install; DOMPurify stays defense-in-depth regardless. |
| **VAI-02** | RAG citation accuracy ~74% / mis-citation ~80% (arXiv 2601.05866) | PITFALLS.md P11 | Single-source. Directional only; calibrate the real number on the Phase 12 eval set. Don't put "≥80%" in a requirement without your own fixture. |
| **VAI-03** | 68 infinite agent loops / "$47k in 11 days" (arXiv 2607.01641) | PITFALLS.md P13 | Single-source. Justifies reserve-before-call budgeting (REQ-R08) directionally; the *mechanism* is required, the *statistic* is not a fact to cite. |
| **VAI-04** | Version numbers @ 2026-08-19: TS 7.0.2, Vitest 4.1.11, Vite 8.2.1, antd 6.6.1, minisearch 7.2.0, defuddle 0.19.2, idb 8.0.3 | STACK.md | Re-query npm at each phase's install step ("install at the phase, not now"). Latest-known, not pinned truth. |
| **VAI-05** | CWS v1 publish API shutdown 2026-10-15; use `wxt submit init` v2 flow | STACK.md, SUMMARY.md | Confirm current CWS submission flow at Phase 19; the date is a planning input, not a build constant. |
| **VAI-06** | Permission-fatigue targets ("≤15% escalation", UK AI Security Committee T10) | PITFALLS.md P14 | LOW confidence. The tiering *mechanism* is required; ≤15% is a **human-verified design target**, not a model-checkable gate. |
| **VAI-07** | HashJack URL-fragment injection technique | PITFALLS.md P7 | Fold into the Phase 19 red-team corpus as a test case; don't cite as a settled taxonomy. |
| **VAI-08** | `CONCERNS.md`-referenced codebase defects (simulated-AI `localhost:12380`, per-chunk full-store persistence, dual messaging, 5 unused permissions, vacuous isolation tests) | STACK/SUMMARY/PITFALLS | `CONCERNS.md` was **not** part of this research set — **verify each against `src/` in Phase 1** before treating as fact. |

---

## D. Research-derived requirements register (non-spec scope)

**Tags:** `CONSISTENT` (restates a spec mechanism), `AUGMENTS` (adds detail/scope the spec permits but doesn't specify), `CONFLICTS→ADR` (competes with or exceeds a spec decision — needs sign-off).

| REQ-ID | Requirement (research origin) | Target phase | Spec anchor | Tag | Notes / decision |
|---|---|---|---|---|---|
| **REQ-R01** | Single messaging layer: one typed envelope path, every handler returns `true` sync + `sendResponse` once, idempotent `ensureInitialized()` | 1 | §8.1, §20.1, App. E | **CONSISTENT** | Converge scaffold's dual paths onto `BackgroundRouter`. Cold-start test. |
| **REQ-R02** | Real isolation tests: assert no `fetch(` in content-script entrypoints; no React/AntD/Defuddle/yaml in content bundle | 1 | §5.6, §24 | **CONSISTENT** | Spec already mandates the grep; current tests are vacuous (VAI-08). |
| **REQ-R03** | Coalesce `np_workspace` persists (250–500 ms trailing debounce + flush on `beforeunload`/`visibilitychange`); assert write-rate | 1→2 | §13, App. M | **AUGMENTS** | Fills the ~120 writes/min throttle gap; Appendix M persists on every `setState`. |
| **REQ-R04** | Freeze content-script envelope **types** in Phase 1 (`PAGE_LIVE_CONTEXT` always-on; `PAGE_EXTRACTION_REQUESTED`/`PAGE_HTML_PAYLOAD` with `baseUrl`/`truncated` reserved) | 1 | §26.4, App. C/E | **AUGMENTS** | ARCHITECTURE Flag A. Type-level contract only. |
| **REQ-R05** | `isPrimaryWriter()` predicate on WorkspaceStore in Phase 1; Phase 2 gates memory/note writes on it | 1→2 | §13, §20.11 | **AUGMENTS** | ARCHITECTURE Flag B. Enforcement stays additive. |
| **REQ-R06** | `unlimitedStorage` manifest permission added when IndexedDB ships | 2 | §16.4 (absent) | **CONFLICTS→ADR** | Not in spec's permission list. New permission → **ADR-STACK-02**. |
| **REQ-R07** | Storage adapter surfaces `runtime.lastError`/quota/rate-limit as `STORAGE_QUOTA`/`STORAGE_RATE_LIMIT` codes (never swallow) | 2 | §21.6 error registry | **AUGMENTS** | Add the two codes to the canonical error set. |
| **REQ-R08** | Reserve-before-call budget enforcer (token + cost + wall-clock + step) with hard stop; circuit breaker; no-delta detection | 4→11→18 | §1.4, §1.6.1, §11 | **AUGMENTS** | Live budget authority in the transaction log. Mechanism required; VAI-03 stat is not. |
| **REQ-R09** | SSE: incremental `TextDecoder({stream:true})` line-buffer parser; per-provider conformance fixtures (OpenAI `[DONE]`, Anthropic event types, Gemini inline, Ollama NDJSON); missing-terminator = error; CI throttle-proxy gate | 3 | §Phase 3, §19.4 | **AUGMENTS** | Rebuild off real provider wire formats; current parser is proxy-coupled (VAI-08). |
| **REQ-R10** | Token budget counts the **serialized** prompt; reserve output + ~2–3% margin; two-stage compaction (~70%/~95%); never split a tool-call/result pair across compaction | 5→10 | §2.2, §2.4 | **AUGMENTS** | Spec has the budget formula; research adds serialized-count + thresholds. |
| **REQ-R11** | Six-layer injection defense incl. **dual-LLM quarantine** for high-risk ops | 6→7→(4,10) | §28.3 CTX-01/02, O.3 | **CONFLICTS→ADR** | Layers 1/2/4/5/6 map to spec mechanisms. **Layer 3 (dual-LLM quarantine) is net-new, token-expensive → DEFER to v0.2. ADR-SEC-01.** |
| **REQ-R12** | Memory-write ingest screening: flag instruction-like patterns before storing | 10 | §28.4 MEM-*, §3.4 | **AUGMENTS** | Screen on ingest, not just at query time. |
| **REQ-R13** | ServiceNow-aware MiniSearch tokenizer (`INC/CHG/KB/RITM` prefixes, case normalization, stopwords); async hydration; reconcile-by-manifest; versioned serialization + rebuild path | 8→9 | §26.5, §27, §22.1 | **AUGMENTS** | New scope; needs a sample corpus (research flag). |
| **REQ-R14** | Alias index for note rename resolution | 8→9 | §27.7a WIKI-ID-01…04 | **CONFLICTS→ADR** | **Redundant** — spec solves rename via immutable UUID + `unresolvedLinks[]`. **DROP as store; keep only a display-only `oldTitle→UUID` map. ADR-NOTE-01.** |
| **REQ-R15** | Conflict-aware filesystem writes: CAS by base hash, atomic tmp+rename, conflict copies (never auto-merge), watcher self-suppression + ~500 ms debounce, case-only rename via intermediate | 9 | §19.17 (detection only) | **AUGMENTS** | Real gap: spec covers external-change *detection*, not *conflict resolution*. |
| **REQ-R16** | Semantic-boundary chunking + provenance at ingest; claim-level citations with abstain-when-unsupported | 8→9→12 | LLM-WIKI-06, §9.8, §19.19 | **AUGMENTS** | Strengthens the citation model the spec already wants. |
| **REQ-R17** | Risk-tiered approval: read-only auto+logged, medium one-tap, high explicit-with-diff; expiring leases; batch reviews; deny-path first-class | 18 | §14.5, TOL-02 | **AUGMENTS** | Escalation-rate target is **human-verified** (VAI-06), not a model gate. |
| **REQ-R18** | Structured output: provider constrained-decoding (Zod gate for Ollama); idempotency keys on state-changing calls; one-retry-then-ask; `stop_reason`-aware; **no auto-repair** of state changes | 3→4 | §1.2, App. L, §28.2 | **AUGMENTS** | Spec has one-repair loop; research adds idempotency + `stop_reason` branching. |
| **REQ-R19** | Remove Tailwind scaffold leftover (plugin + `src/index.css`) | 1 | §0.2 (forbids tailwind) | **CONSISTENT** | Conflict is in the *scaffold*, not the research. Remove, or ADR-exempt. |
| **REQ-R20** | Remove default-on simulated-AI path + `localhost:12380` default endpoint; gate behind explicit dev flag | 3 | §0.2, §10.6 | **CONSISTENT** | Verify against `src/` (VAI-08). |
| **REQ-R21** | Least-privilege manifest: drop unused permissions; `optional_host_permissions` + `chrome.permissions.request()` for user-configured endpoints; widen `connect-src` per-provider | 1→17 | §16.4 | **CONSISTENT** | Spec already uses optional host permissions; research adds cleanup + CSP note. |

### D.1 Feature-priority / gap decisions (FEATURES.md)

| REQ-ID | Proposal | Spec anchor | Tag | Decision |
|---|---|---|---|---|
| **REQ-R22** | **G-1** structured "similar cases" result card | §9.7 (entry point only) | **CONFLICTS→ADR** | **§9.7 acceptance criterion** (cheap; stays v0.1 Phase 17). Not a new top-level feature. |
| **REQ-R23** | **G-3** handoff/transfer-targeted case summary | §9.7 CatchUpSkill | **AUGMENTS** | Cheap acceptance criterion on CatchUpSkill or Write "Draft internal note". |
| **REQ-R24** | Promote **Selection → Ask AI** P1 → P0 | §9.1 (P1) | **CONFLICTS→ADR** | **Promote to P0** + Phase 17 acceptance assertion. Spec §9.1 priority updated P1→P0. |
| **REQ-R25** | G-2 auto-suggest / G-5 PDF chat / G-6 source-derived questions / bidirectional sync | §6.5, §25, §27.9 | **CONSISTENT** | Research agrees these stay **deferred to v0.2+**. No v0.1 action. |

---

## E. Cost-effective-model consumption rules

1. **Per-phase research pack, not the full set.** A cheap model executing Phase N receives: the spec's §18 phase block + `SUMMARY.md`'s row for Phase N + this doc's relevant `REQ-R*` rows — never all five raw docs.
2. **Human-verified vs model-verified gates.** These are **human-verified** (no cheap-model check without fixtures): citation accuracy ≥80% (VAI-02), approval escalation ≤15% (VAI-06), `<50 ms` search @ 50 MB vault, `<300/500 ms` initial paint, "60 s+ stream survives forced-idle." Supply a fixture or label the gate `HUMAN-VERIFIED`.
3. **Authority tag travels with every criterion** (`CONSISTENT`/`AUGMENTS`/`CONFLICTS→ADR` + spec anchor).
4. **No forward-dated fact as a constant.** Every VAI-* item is re-verified at its phase.

---

## F. Decisions — SIGNED OFF 2026-08-19

- [x] **A-1 (WXT):** ✅ **HOLD `wxt@^0.20.27` for v0.1** → ADR-STACK-01. 0.21 is a post-v0.1 chore.
- [x] **A-2 (Immer):** ✅ **Follow spec `^11`** — STACK.md "hold 10.2.0" overruled (spec already pins ^11). No ADR.
- [x] **A-3 (Zod):** ✅ **Follow spec `^4`** — STACK.md "keep 3.24" overruled (spec already pins ^4; 3.24 was below the 3.25+ floor). No ADR.
- [x] **SPIKE-P6-01 (Defuddle):** ✅ **APPROVED** — panel-side fixed; detached-doc viability spike at Phase 6 → ADR-P6-01.
- [x] **REQ-R06 (`unlimitedStorage`):** ✅ **APPROVED** at Phase 2 → ADR-STACK-02.
- [x] **REQ-R11 (dual-LLM quarantine):** ✅ **DEFER to v0.2** (layers 1/2/4/5/6 ship in v0.1) → ADR-SEC-01.
- [x] **REQ-R14 (alias index):** ✅ **DROP as store; keep display-only over WIKI-ID** → ADR-NOTE-01.
- [x] **REQ-R22 (G-1 similar-cases):** ✅ **§9.7 acceptance criterion** (v0.1).
- [x] **REQ-R24 (Selection→Ask AI):** ✅ **PROMOTE to P0** (Phase 17 acceptance assertion; spec §9.1 updated).
- [x] **VAI-08 (CONCERNS.md defects):** ✅ **Phase 1 verification task** — confirm each against `src/` before treating as fact.

---

## G. ADRs

| ADR | Title | Decides | Status |
|---|---|---|---|
| **ADR-STACK-01** | WXT held at 0.20.27 for v0.1 | A-1 | Accepted 2026-08-19 |
| **ADR-STACK-02** | `unlimitedStorage` permission added at Phase 2 | REQ-R06 | Accepted 2026-08-19 |
| **ADR-P6-01** | Defuddle panel-side extraction on detached doc | SPIKE-P6-01 | Proposed (spike pending Phase 6) |
| **ADR-SEC-01** | Dual-LLM quarantine deferred to v0.2 | REQ-R11 | Accepted 2026-08-19 |
| **ADR-NOTE-01** | WIKI-ID UUID is sole note identity; no parallel alias store | REQ-R14 | Accepted 2026-08-19 |

**A-2 (Immer 11) and A-3 (Zod 4) need NO ADR** — both decisions *follow* the spec §7 pins; STACK.md's contrary "hold" recommendations are superseded by §F.

---

_Reconciliation for: NowPilot research pack (ARCHITECTURE/FEATURES/PITFALLS/STACK/SUMMARY), rev 2026-08-19. The spec + amended STACK.md + this doc + adr/ are a conflict-free source for GSD planning and cost-effective-model execution._
