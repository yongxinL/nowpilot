# Architecture Decision Records — NowPilot

ADRs record deviations from `.planning/PRODUCT_SPEC_v0_1.md` and resolutions of research-doc conflicts. Precedence: **spec > ADR > RESEARCH-RECONCILIATION.md > SUMMARY.md > raw research docs.**

| ADR | Title | Status | Decides | Spec touchpoint |
|---|---|---|---|---|
| [ADR-STACK-01](./ADR-STACK-01-wxt-hold-0.20.md) | Hold WXT at 0.20.27 for v0.1 | Accepted | A-1 | §7.1 (deviation) |
| [ADR-STACK-02](./ADR-STACK-02-unlimitedstorage-phase2.md) | Add `unlimitedStorage` at Phase 2 | Accepted | REQ-R06 | §16.4 (addition) |
| [ADR-P6-01](./ADR-P6-01-defuddle-panel-side.md) | Defuddle runs panel-side on a detached doc | Proposed (spike @ Phase 6) | §B / SPIKE-P6-01 | §26.4 (confirms) |
| [ADR-SEC-01](./ADR-SEC-01-dual-llm-quarantine-v0.2.md) | Dual-LLM quarantine deferred to v0.2 | Accepted | REQ-R11 | §28.3 (scopes) |
| [ADR-NOTE-01](./ADR-NOTE-01-wiki-id-identity.md) | WIKI-ID UUID is sole note identity | Accepted | REQ-R14 | §27.7a (confirms) |

**No ADR needed for A-2 (Immer 11) or A-3 (Zod 4)** — both decisions *follow* the spec §7 pins (the spec already pins `immer ^11` and `zod ^4`); STACK.md's contrary "hold" recommendations are superseded by RESEARCH-RECONCILIATION.md §F.

## Authoritative v0.1 stack outcome
`wxt@^0.20.27` (held, ADR-STACK-01) · `immer@^11` (spec) · `zod@^4` (spec) · `+unlimitedStorage` at Phase 2 (ADR-STACK-02). All other §7 pins unchanged.
