# ADR-SEC-01 — Dual-LLM quarantine deferred to v0.2

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** George Li (product owner / architect)
- **Decides:** RESEARCH-RECONCILIATION.md REQ-R11 / §F
- **Related:** PITFALLS.md P7, spec §28.3 (CTX-01/02), spec Appendix O.3 (trust policy), spec §28.4 (memory), §1.2/§4 executor

## Context

`PITFALLS.md` P7 recommends a **six-layer** indirect-prompt-injection defense: (1) input sanitization at extraction, (2) action screening, (3) **dual-LLM quarantine** for high-risk ops, (4) output screening, (5) containment/degraded privileges, (6) user disclosure. The research notes single-layer "from web" labels were bypassed in real 2025–2026 incidents (Perplexity Comet, Gemini Deep Research).

Mapping to the spec:
- Layers **1, 4, 5, 6** map to existing spec mechanisms (extraction hygiene §26; trust labels + `instructionAuthority:false` §28.3 / Appendix O.3; containment/disclosure in the trust model).
- Layer **2 (action screening)** maps to the Executor's tool-call validation (§1.2, §4) — page-derived text must never directly determine tool calls/parameters.
- Layer **3 (dual-LLM quarantine)** — a *second* model independently validates the first's plan on high-risk ops — is **net-new** and **token-expensive**: it roughly doubles model cost on any op that triggers it, which conflicts with the cost-effective v0.1 posture (§0.3).

## Decision

**Ship layers 1, 2, 4, 5, 6 in v0.1** (they are largely restatements/tightenings of existing spec mechanisms — see REQ-R11 authority mapping). **Defer layer 3 (dual-LLM quarantine) to v0.2.**

v0.1 high-risk operations are instead gated by:
- Executor action screening (layer 2) — allowlist-validated tool calls, no page-text-driven parameters;
- risk-tiered **human approval** for state-changing ops (REQ-R17 / §14.5 / TOL-02) — the human is the high-risk gate in v0.1;
- memory-write ingest screening (REQ-R12) so injected content does not persist.

v0.2 revisits dual-LLM quarantine once a stronger tier is routinely available and cost headroom exists.

## Consequences

- **Positive:** preserves cost-effective v0.1 economics; still ships a real 5-layer defense, not a single label; human approval covers the high-risk gap.
- **Negative:** no automated second-model plan validation in v0.1; residual risk on high-risk ops rests on action screening + human approval + memory screening.
- **Must-do in v0.1:** the Phase 19 red-team corpus (adversarial pages, HashJack URL fragments VAI-07, encoded instructions) still runs against the 5-layer stack; Phase 12 includes an injection benchmark.

## Verification

- Phase 7/6/10 implement layers 1/2/4/5/6; no `dualLLM`/quarantine module in v0.1 scope.
- Phase 12 injection benchmark passes against the 5-layer stack.
- Phase 19 red-team: no page-derived text reaches a tool parameter; no injected instruction persists to memory.
- v0.2 backlog item "dual-LLM quarantine (layer 3)" created, referencing this ADR.
