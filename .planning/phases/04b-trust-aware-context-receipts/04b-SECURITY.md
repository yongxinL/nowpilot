---
phase: 04b
slug: trust-aware-context-receipts
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# Phase 04b — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Source adapter → ContextItem | Source adapters produce ContextItem with self-assigned relevance/freshness — trust/sensitivity/authority must be policy-enforced, not self-assigned (D-06) | context text + metadata |
| ContextItem → ContextOptimizer | Untrusted text enters via data-kind ContextItems — delimiter wrapping + ordering policy prevents injection (D-02) | data-kind context text |
| ContextOptimizer → ProviderAdapter | The final PromptSection[] must never carry sensitivity metadata in text — only PromptSection fields survive unwrapping | assembled prompt sections |
| Tool output → ContextItem | ToolResultShaper is the boundary: redaction first, size cap, provenance, policy-verdict trust (TOL-04, D-05) | tool result text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04b-01 | Spoofing | ContextItem.sourceId | medium | mitigate | assess() derives authority from kind+sourceId prefix; validate() rejects mismatched metadata | closed |
| T-04b-02 | Tampering | ContextOptimizer data-section ordering | high | mitigate | authorityRank sort system→user→data after wrapping; injection tests prove data never precedes system | closed |
| T-04b-03 | Information Disclosure | ContextReceiptEntry fields | medium | mitigate | Receipts carry sourceId/token counts only — no raw text; secret items rejected before any receipt (Zod gate) | closed |
| T-04b-04 | Elevation of Privilege | Data content posing as instructions | high | mitigate | `<data-source>` wrapping + system-first ordering; 7-test adversarial injection suite passes | closed |
| T-04b-05 | Spoofing | Source adapter self-assigning trust=1.0 | medium | mitigate | validate() hard-rejects self-assigned trust → SCHEMA_INVALID; spoof-rejection test | closed |
| T-04b-SC | Tampering | npm installs | high | mitigate | Zero package.json/package-lock changes in 04b commits; all SUMMARYs `tech-stack: added: []` | closed |
| T-04b-06 | Spoofing | ContextTrustPolicy sourceId prefix matching | low | accept | Plan-time rationale documented (04b-02-PLAN.md) | closed |
| T-04b-07 | Tampering | FreshnessPolicy TTL constant table | low | accept | Plan-time rationale documented (04b-02-PLAN.md) | closed |
| T-04b-08 | Information Disclosure | Sensitivity downgrade bypass | medium | mitigate | upgrade() most-restrictive-wins; optimizer overrides metadata with policy verdict | closed |
| T-04b-09 | Information Disclosure | ToolResultShaper redaction | critical | mitigate | redactSensitive() is FIRST processing step; 6 patterns; 12/12 shaper tests | closed |
| T-04b-10 | Tampering | ToolResultShaper truncation bypass | low | accept | Plan-time rationale documented (04b-03-PLAN.md) | closed |
| T-04b-11 | Information Disclosure | Original ToolExecutionResult mutation | low | mitigate | shape() reads only; new ContextItem returned; immutability tests | closed |
| T-04b-12 | Elevation of Privilege | Tool output self-assigning trust | medium | mitigate | Trust from contextTrustPolicy.assess() exclusively; authority hardcoded data | closed |
| T-04b-13 | Information Disclosure | Receipt sourceId revealing secret existence | medium | mitigate | Secret gate at schema level ahead of freshness gate; no receipt entry for a secret | closed |
| T-04b-14 | Tampering | Receipt totals not matching packed totals | low | accept | Plan-time rationale documented (04b-04-PLAN.md); warns, never throws | closed |
| T-04b-15 | Information Disclosure | OmissionReason = 'sensitive' revealing sensitive content existed | low | mitigate | 'sensitive' only in type union; markOmitted emits 'stale'/'policy'/'budget' only | closed |
| T-04b-16 | Tampering | Stable section text encoding drift | low | accept | Plan-time rationale documented (04b-05-PLAN.md); snapshot guard + FNV-1a | closed |
| T-04b-17 | Information Disclosure | Per-section hashes leaking section content | low | accept | Plan-time rationale documented (04b-05-PLAN.md); FNV-1a hex irreversible | closed |
| T-04b-18 | Elevation of Privilege | Injection text escaping data delimiters | high | mitigate | 7-test adversarial suite incl. literal `</data-source>` escape attempt; wrapper authoritative | closed |
| T-04b-19 | Elevation of Privilege | Skill omission removing safety instructions | medium | mitigate | Safety instructions are core system sections, never skills; unloaded skills zero-token 'policy' receipts | closed |
| T-04b-20 | Tampering | Malicious skill summary content | low | accept | Plan-time rationale documented (04b-06-PLAN.md); developer-authored SkillSummary only | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-04b-06 | Spoofing, sourceId prefix matching | Prefix matching is sufficient for provenance; D-06 validation rejects spoofed claims at use time | plan (T-04b-06 disposition) | 2026-08-01 |
| T-04b-07 | Tampering, FreshnessPolicy TTL table | Module-level constants, no runtime mutation path | plan (T-04b-07 disposition) | 2026-08-01 |
| T-04b-10 | Tampering, truncation bypass | Truncation marker appended after size check; output still bounded by MAX_TOOL_RESULT_CHARS | plan (T-04b-10 disposition) | 2026-08-01 |
| T-04b-14 | Tampering, receipt totals mismatch | validateReceiptTotals warns, never throws — diagnostic, not prompt-affecting | plan (T-04b-14 disposition) | 2026-08-01 |
| T-04b-16 | Tampering, stable section drift | Snapshot guard + byte-level FNV-1a makes drift detectable | plan (T-04b-16 disposition) | 2026-08-01 |
| T-04b-17 | Info disclosure, per-section hashes | FNV-1a hex hashes are irreversible by construction | plan (T-04b-17 disposition) | 2026-08-01 |
| T-04b-20 | Tampering, malicious skill summary | createSkillContextItem takes developer-authored SkillSummary only — no user text | plan (T-04b-20 disposition) | 2026-08-01 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-01 | 21 | 21 | 0 | gsd-security-auditor (ASVS L1) |
