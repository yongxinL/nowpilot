---
phase: 06
slug: transaction-logging-and-diagnostics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest v4 + jsdom |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run --dir tests/core/telemetry` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --dir tests/core/telemetry`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | W0 | TELE-01, TELE-02, TELE-03 | T-06-01 | TraceRedactor regex patterns match all mandatory redaction patterns from product spec §4.4; raw secrets never reach persistence | unit | `npx vitest run tests/core/telemetry/TraceRedactor.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | TELE-01, TELE-02, TELE-04 | T-06-02 | AITransactionLog orchestrates lifecycle; every trace passes through redaction before persistence | unit | `npx vitest run tests/core/telemetry/AITransactionLog.test.ts` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 1 | TELE-01, TELE-02, TELE-03, TELE-04 | T-06-03 | ProviderTrace attempts[] records retry/fallback chain; operationId links all traces | unit | `npx vitest run tests/core/telemetry/AITransactionLog.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | TELE-01, TELE-02 | — | PlannerService, ExecutorService, RendererService emit typed trace events through ExecutionContext.traceCollector | unit | `npx vitest run tests/core/` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 2 | TELE-05 | T-06-04 | Error toast "Open Diagnostics" link carries operationId query param; deep-linking resolves correctly | unit | `npx vitest run tests/core/telemetry/` | ❌ W0 | ⬜ pending |
| 06-06-01 | 06 | 3 | TELE-06, DATA-03 | — | Export produces valid ZIP with manifest.json; redaction applied before serialization | unit | `npx vitest run tests/core/telemetry/export.test.ts` | ❌ W0 | ⬜ pending |
| 06-07-01 | 07 | 3 | TELE-01, TELE-02 | T-06-05 | Pruning respects tiered retention; failure-prioritized; never runs synchronously in pipeline | unit | `npx vitest run tests/core/telemetry/pruning.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/telemetry/TraceRedactor.test.ts` — redaction pattern verification (TELE-03)
- [ ] `tests/core/telemetry/AITransactionLog.test.ts` — lifecycle + redaction + batch-write (TELE-01, TELE-02)
- [ ] `tests/core/telemetry/pruning.test.ts` — tiered retention algorithm (TELE-01)
- [ ] `tests/core/telemetry/export.test.ts` — ZIP assembly + manifest (TELE-06, DATA-03)
- [ ] `tests/core/telemetry/` directory created

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DiagnosticsPanel renders provider Timeline correctly | TELE-04 | Visual verification of AntD Timeline with status markers across providers | Open Full App → Options → Diagnostics; verify Timeline shows each provider attempt with colored status markers |
| Error toast "Open Diagnostics" deep-links correctly | TELE-05 | E2E navigation across surfaces | Trigger an error in Side Panel; click "Open Diagnostics"; verify Full App opens to diagnostics with trace selected |
| Export ZIP contains valid, redacted trace data | TELE-06 | ZIP binary format verification | Export a trace; unzip and verify manifest.json + trace JSON files contain no raw secrets |
| Filter bar correctly filters by type/status/provider/severity | TELE-04 | Interactive UI state | Apply each filter combination; verify transaction list updates correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
