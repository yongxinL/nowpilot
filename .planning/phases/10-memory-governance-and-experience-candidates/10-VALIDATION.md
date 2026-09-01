---
phase: 10
phase_slug: memory-governance-and-experience-candidates
date: 2026-09-01
---

# Phase 10 — Validation Strategy

## Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | vitest.config.ts (via vite) |
| Quick run command | `pnpm test -- tests/core/memory/governance` |
| Full suite command | `pnpm run verify:phase-10` |

## Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEM-01 | Memory taxonomy (working/episodic/semantic/preference/procedural) | unit | `pnpm test -- tests/core/memory/governance/MemoryRecord.test.ts` | ❌ Wave 0 |
| MEM-02 | source+confidence+lifecycle+sensitivity+verified-at fields | unit | `pnpm test -- tests/core/memory/governance/MemoryRecord.test.ts` | ❌ Wave 0 |
| MEM-03 | Conflict precedence: correction > verified > prior > inference | unit | `pnpm test -- tests/core/memory/governance/MemoryRecord.test.ts` | ❌ Wave 0 |
| MEM-04 | 9 user controls (view/source/confidence/edit/pin/forget/disable/export/cloud-exclude) | unit | `pnpm test -- tests/core/memory/governance/MemoryGovernance.test.ts` | ❌ Wave 0 |
| MEM-05 | Procedural experience activates only after verification + approval | unit | `pnpm test -- tests/core/memory/governance/ProceduralExperience.test.ts` | ❌ Wave 0 |
| KNW-01 | Edge provenance (explicit/imported/suggested/accepted) | unit | `pnpm test -- tests/core/knowledge/provenance/NoteGraphProvenance.test.ts` | ❌ Wave 0 |

## Sampling Rate
- **Per task commit:** `pnpm test -- tests/core/memory/governance tests/core/knowledge/provenance`
- **Per wave merge:** `pnpm run verify:phase-10`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Wave 0 Gaps
- [ ] `tests/core/memory/governance/MemoryRecord.test.ts` — covers MEM-01/02/03
- [ ] `tests/core/memory/governance/MemoryGovernance.test.ts` — covers MEM-04
- [ ] `tests/core/memory/governance/ProceduralExperience.test.ts` — covers MEM-05
- [ ] `tests/core/knowledge/provenance/NoteGraphProvenance.test.ts` — covers KNW-01
- [ ] `tests/core/storage/migrations/v5-memory-governance.test.ts` — covers v5 migration idempotency
- [ ] `tests/core/knowledge/` directory — needs creation
- [ ] `package.json` verify:phase-10 script — needs addition

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | isPrimaryWriter() gate on all governance mutations |
| V5 Input Validation | yes | zod schemas for MemoryRecord/ProceduralExperience |
| V6 Cryptography | no | — |

### Known Threat Patterns for Chrome MV3 Extension
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized memory modification | Tampering | isPrimaryWriter() + WriteJournal (single-writer gate) |
| Sensitive memory leakage in export | Information Disclosure | TraceRedactor before export serialization |
| Procedural experience injection | Tampering | Verification + approval gating (MEM-05) |
| Cloud sync of excluded data | Information Disclosure | cloudExclude flag prevents sync of sensitive records |
