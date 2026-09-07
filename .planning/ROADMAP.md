# NowPilot v0.1 Roadmap

## Purpose

This file is the concise Git-tracked view of the canonical implementation order in §18 of `.planning/PRODUCT_SPEC_v0_1.md`. The product specification remains authoritative for detailed scope, paths, contracts and acceptance criteria.

## Delivery Strategy

- Implement one phase or approved sub-phase at a time.
- Use a fresh, bounded coding-agent context for each discuss, plan, execute and verify step.
- Prefer deterministic tasks and focused tests suitable for cost-effective models.
- Route a module marked `@implementation-tier: advanced` to a stronger model or stub it exactly as specified.
- Do not advance while the current phase has unresolved verification blockers.

## Canonical Sequence

### Foundation

1. **MV3/WXT Runtime + AntD Shells + Workspace**  
   Establish the extension entry points, Chat-only Side Panel, Standalone shell, theme, workspace handoff and runtime messaging.

2. **Storage, Security, WriteJournal, Workspace Persistence**  
   Add encrypted settings, IndexedDB stores, migration and crash-safe persistence.

3. **Cost-Effective AI Runtime + Persona Seed**  
   Implement providers, routing, tiers, structured output, Planner → Executor → Renderer, streaming and persona injection.

4. **Agent Reliability and Evidence**  
   Add trajectory states, postcondition evidence and structured outcomes.

### Context and Knowledge

5. **Context-Adaptive Execution**  
   Add context tiers, budgets, compression, provenance and minimal mode.

6. **PageContentService**  
   Implement layered, cached, extraction-only page acquisition.

7. **Trust-Aware Context and Receipts**  
   Prevent retrieved data from gaining instruction authority and produce context receipts.

8. **Knowledge Base**  
   Add memory, MiniSearch, atomic notes, wikilinks and the working-memory block.

9. **LLM-Wiki and Filesystem Sync**  
   Add enrichment, note Q&A, note conversion, Markdown backup and restore.

10. **Memory Governance and Experience Candidates**  
    Add memory taxonomy, conflict resolution, lifecycle controls and knowledge-edge provenance.

### Observability, Evaluation and Orchestration

11. **Transaction Logging and Diagnostics**  
    Add redacted AI, provider and tool traces with diagnostic views.

12. **Agent Evaluation**  
    Add versioned golden suites, deterministic validators and trajectory scoring.

13. **Verified Continual Evolution**  
    Add proposed, sandboxed and human-approved evolution candidates.

14. **Bounded Multi-Role Collaboration**  
    Add closed roles, typed handoffs, shared budgets and independent review.

### Product Experience and Integration

15. **Workspace Experience + RICH**  
    Complete Chat, Agent, Notes, Write, TeamGQM and Options in the Standalone view, plus the Chat-only Side Panel and RICH interactions.

16. **Multimodal Input Foundation**  
    Add bounded image and voice inputs through the existing context pipeline.

17. **Add-ons and Extraction-Only Content Runtime**  
    Complete global, Write, TeamGQM and ServiceNow add-ons without host-page UI injection.

18. **Tool Governance and Active Discovery**  
    Add capability manifests, risk-based approval, replay safety, verification and tool discovery.

19. **Hardening and Release**  
    Run the complete functional, security, isolation, performance and release gates.

## Phase State Values

- `Not started`
- `Discussing`
- `Planning`
- `Ready to execute`
- `In progress`
- `Ready to verify`
- `Blocked`
- `Verified, uncommitted`
- `Complete`

## Change Control

A roadmap change requires:

1. a ratified decision in `.planning/DECISIONS.md`;
2. an ADR when architecture or phase ordering changes;
3. an update to the corresponding product-spec section;
4. updated requirement and verification traceability.
