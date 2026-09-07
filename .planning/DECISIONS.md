# NowPilot Decisions

## Purpose

This file records concise, ratified implementation decisions needed across agent sessions. The detailed rationale remains in §23 and other decision sections of `.planning/PRODUCT_SPEC_v0_1.md`.

## Decision Status

- `Ratified`: binding unless superseded by a later ratified decision.
- `Proposed`: not binding and must not be implemented as canonical.
- `Superseded`: retained for history but no longer active.

## Ratified Decisions

### DEC-001: Development harness neutrality

- **Status:** Ratified
- **Decision:** Codex, OpenCode, other repository-aware agents and human developers may implement the project. GSD is optional and is not a product dependency.
- **Execution record:** Git, tests, verification scripts and `.project/` artefacts are authoritative.

### DEC-002: Cost-effective implementation-agent strategy

- **Status:** Ratified
- **Decision:** Cost-effective models may discuss, plan, execute and verify normal phase work when given bounded context and deterministic tasks.
- **Guardrail:** Modules marked `@implementation-tier: advanced` must be stubbed exactly as specified or explicitly routed to a stronger model.
- **Guardrail:** Use separate contexts for discussion, planning, execution and verification. Do not ask a small model to process the entire product specification for every task.

### DEC-003: v0.1 UI system

- **Status:** Ratified
- **Decision:** Use Ant Design v6 on extension-owned surfaces and Ant Design X 2.x presentation components for conversational UI.
- **Excluded:** `@ant-design/x-sdk`, `@ant-design/x-card`, Tailwind CSS, shadcn/ui and Radix UI in v0.1 extension-owned surfaces.

### DEC-004: Surface ownership

- **Status:** Ratified
- **Decision:** Side Panel is Chat only. Standalone owns Chat, Agent, Notes, Write, TeamGQM and Options.
- **Handoff:** Side Panel Chat may invoke registered skills or hand off to the applicable Standalone page.

### DEC-005: Canonical Standalone paths

- **Status:** Ratified
- **Decision:** Use `src/entrypoints/standalone/` and `src/components/standalone/`.
- **Excluded:** Do not create parallel `src/entrypoints/app/` or `src/components/app/` trees.

### DEC-006: Host-page isolation

- **Status:** Ratified
- **Decision:** Content scripts are extraction-only in v0.1. No host-page UI, Shadow DOM UI, trusted-event automation or field write-back.
- **Deferred:** Future injected UI requires a separately ratified addendum.

### DEC-007: AI runtime

- **Status:** Ratified
- **Decision:** Use the bounded Planner → Executor → Renderer runtime with ContextOptimizer and operator-configured `fast` and `balanced` runtime tiers.
- **Guardrail:** The runtime tier names are product contracts and must not be renamed to vendor model families.

### DEC-008: Agent platform

- **Status:** Ratified
- **Decision:** Single-agent execution is the default one-role CollaborationPlan. Multi-role collaboration is bounded, explicitly activated and uses the same coordinator, tool, memory, evaluation and security model.

### DEC-009: Knowledge architecture

- **Status:** Ratified
- **Decision:** Use atomic notes, UUID identity, wikilinks, tags, path-based categories, MiniSearch and one-way app-to-filesystem backup with additive restore.
- **Boundary:** Notes may feed memory through governed extraction. Memory does not automatically write notes.

### DEC-010: Verification and completion

- **Status:** Ratified
- **Decision:** A phase is complete only when required artefacts exist, tests and `verify:phase-N` pass, acceptance evidence is recorded and the verified commit SHA is recorded.
- **Guardrail:** Any subsequent code change invalidates the prior verification.

### DEC-011: Canonical planning directory

- **Status:** Ratified
- **Decision:** All NowPilot product specifications, planning artefacts, operator prompts, phase records, ADRs and verification attachments live under `.planning/`.
- **Exception:** `AGENTS.md` remains at the repository root so repository-aware coding agents can discover the project instructions.
- **Canonical paths:**
  - `.planning/PRODUCT_SPEC_v0_1.md`
  - `.planning/STATUS.md`
  - `.planning/ROADMAP.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/DECISIONS.md`
  - `.planning/prompts/`
  - `.planning/phases/`
  - `.planning/adr/`
  - `.planning/evidence/`
- **Guardrail:** Do not create parallel copies under `.project/`, `docs/`, `prompts/`, or the repository root.
- **Migration rule:** Every path move must update all inbound references in the same commit.

## Open Decisions

None recorded. A phase discussion may add a proposed decision only when the product specification and repository evidence do not already determine the answer.

## Decision Template

```markdown
### DEC-XXX: Title

- **Status:** Proposed | Ratified | Superseded
- **Phase:** Phase N
- **Context:** Exact ambiguity or conflict.
- **Decision:** Exact binding contract.
- **Consequences:** Files, tests and behaviours affected.
- **Supersedes:** DEC-XXX, if applicable.
```
