# Phase 4b: Trust-Aware Context and Receipts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 04b-Trust-Aware Context and Receipts
**Areas discussed:** Trust envelope & policy point, Injection defence stack, Content trust controls, Receipt & inspector scope, CTX-05/06 P1 scope, ContextItem→PromptSection boundary, Receipt reconstruction contract

---

## Trust Envelope & Policy Point

| Option | Description | Selected |
|--------|-------------|----------|
| Page-only now | PageContext (4a) → ContextItem[] is the real feed; memory/tool structural no-ops | ✓ |
| All three sources | PageContext + RetrievedMemory + tool_result all convert through ContextItem[] in 4b | |
| Full optimizer input swap | ContextItem[] becomes a required input replacing pageContext | |

**User's choice:** Page-only now — "TrustPolicy operates entirely on `ContextItem[]`; only trusted/re-written items become `PromptSection[]`. Receipts record both included and excluded items."
**Notes:** #6 (ContextItem → PromptSection boundary) flagged by the user as the most important — the Phase-4b equivalent of Phase 3a's "verifier → orchestrator → renderer" ownership decision. TrustPolicy deterministic + pure; never mutates SYSTEM; `<untrusted_data>` wrap must not affect byte-stable cached SYSTEM prompts (F-5). No event bus in 4b (D-04-02).

---

## Injection Defence Stack

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic classifier | Regex heuristic detector classifies items; no LLM/model calls; quarantine-not-drop, receipt records omitReason | ✓ |
| DOMPurify + classifier | DOMPurify sanitize on raw HTML path + heuristic classifier | |
| Drop on hit | Heuristic classifier DROPS flagged items entirely | |

**User's choice:** Deterministic classifier. XSS-risk screening + prompt-injection quarantine = deterministic, dependency-free heuristic classifier (prompt-injection patterns); on hit, item quarantined (kept as ContextItem, wrapped + flagged), never dropped silently, never converted to PromptSection.

---

## Content Trust Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Per-source-type, Options | Toggles (page/notes/memory/tool_result) in Options, np_trust pref, enforced in TrustPolicy | ✓ (elaborated) |
| Per-source-ID | Per-site/page, per-note, per-memory-fact controls — heavy UI, Phase 5+ | |
| Chat-embedded controls | Per-conversation chips in chat + Options defaults — Phase 7 RICH | |

**User's choice:** "Per-source-type controls in Options plus runtime enforcement in TrustPolicy.ts." Defer per-source-ID, per-site, per-memory-fact, chat-embedded, full Prompt Inspector UI. Ship: per-source-type toggles, persisted trust prefs, trust filtering/quarantine before ContextItem[] enters optimizer, trust-aware pageContext wiring into ContextOptimizerInput, provenance metadata for future Inspector reconstruction.

---

## Receipt & Inspector Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Receipt data, no UI | 4b extends manifest with ContextReceiptEntry[]; in-memory; PromptInspector = Phase-6 viz | ✓ |
| Receipt + minimal readout | Plus a debug JSON/descriptions view so SC #2 visibly true in 4b | |
| Shape-only, defer contract | Extend manifest shape only; full receipt contract to Phase 6 | |

**User's choice:** Receipt data, no UI. Receipts in-memory only in 4b (durable storage Phase 6); sufficient to reconstruct every packing decision without re-running ContextOptimizer; PromptInspector = Phase-6 visualization over data 4b already emits.

---

## CTX-05/06 P1 Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Structural seam only | CTX-05 progressive disclosure = metadata seam (skills are Phase 8); CTX-06 = receipt-side quality counters, no raw text | ✓ |
| Defer both | Both P1 out of 4b — but §18 4b explicitly lists progressive skill disclosure | |
| Seam + full CTX-06 | CTX-05 seam now + full CTX-06 counters with a readout | |

**User's choice:** Structural seam only. CTX-05 = structural/minimal; skill-aware behavior blocked on Phase 8. CTX-06 = quality counters via receipt/telemetry seam, no readout UI in 4b.

---

## the agent's Discretion

- Exact regex heuristic set for the injection classifier.
- Exact ContextItem[] → PromptSection[] conversion mechanics inside ContextOptimizer/ContextPack.
- Exact np_trust preference shape + storage key.
- Exact ContextReceiptEntry[] field wiring onto the manifest + Zod schema extension.
- Receipt reconstruction helper location.
- `verify:phase-4b` script shape (spec line 3684 definition vs §24 chain).

## Deferred Ideas

- Per-source-ID trust controls (Phase 5+)
- Chat-embedded trust controls (Phase 7 RICH)
- Full Prompt Inspector UI (Phase 6 telemetry)
- Durable receipt storage / AITransactionLog (Phase 6)
- Real memory + tool_result as ContextItem feeds (Phase 5/8)
- Real progressive skill disclosure (Phase 8)
- DOMPurify in core context pipeline (not needed in 4b)
