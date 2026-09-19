# NowPilot Architecture Baseline

## Canonical contexts

- `background`: routing, lifecycle, alarms, permissions, cookies, bounded proxy requests, and the narrow serialisation authority for operations that change the elected workspace writer (ADR-0001).
- `sidepanel`: Chat UI, AI runtime, IndexedDB access, context and memory clients.
- `standalone`: full workspace, options, diagnostics, notes, and AI runtime.
- `content`: read-only extraction and navigation observation.

## Canonical dependency direction

```text
UI surfaces -> core services -> platform adapters
Add-ons -> core contracts
Core -X-> add-ons
Content -X-> React / Ant Design / provider SDKs / IndexedDB
Background -X-> provider streaming / MCP streaming / IndexedDB
```

## Canonical naming

Use `standalone` for paths, runtime surface values, messages, registries, shells, and routers. Do not create a parallel `app` naming family.

## Data ownership

- Workspace metadata: Chrome local storage.
- Session tokens and election state: Chrome session storage.
- Display mode and theme pack: Chrome sync storage.
- Message bodies, notes, memory bodies, traces, and filesystem handles: IndexedDB.
- API keys: encrypted local storage.
- Filesystem: optional backup target, never primary storage in v0.1.

## Single-writer rule

One extension-owned surface is the primary writer for conversation bodies, memory, notes, and workspace mutations. Secondary surfaces mirror versioned state. Side effects use idempotency keys and, where multi-store consistency is involved, the write journal.

Side Panel and Standalone are the only eligible workspace writers. Operations that change the elected workspace writer (initial claim, handoff commit, relinquish, stale recovery, fallback claim) are serialised through one background election arbiter with a FIFO promise queue, per ADR-0001. The background is not a workspace owner, workspace writer, ordinary mutation broker, content owner, provider/MCP runtime, IndexedDB owner, or long-lived source of truth; ordinary workspace mutations never pass through the background.

## AI pipeline

```text
User input
  -> ContextOptimizer
  -> PersonaInjector
  -> PlannerService
  -> ExecutorService when a validated tool is requested
  -> outcome verification
  -> RendererService
  -> UI stream
```

The model never executes a tool directly and never owns persistent memory.

## Extraction selection

```text
registered ServiceNow record -> ServiceNow API strategy
otherwise default mode       -> Defuddle with Readability fallback
otherwise actionable mode    -> APC-lite structural extraction
```

All extracted material is untrusted data and has no instruction authority.

## Accepted architectural decisions

- WXT and Chrome MV3.
- React with Ant Design and Ant Design X presentation components.
- No Ant Design X SDK provider orchestration.
- Provider-neutral model tiers.
- Zod-validated public boundaries.
- Local-first notes and memory.
- No host-page UI or write-back in v0.1.
- No browser automation in v0.1.
- Side Panel is Chat-only.
- Standalone view owns deep-work and administration surfaces.
- Background-serialised workspace election: the background is the narrow serialisation authority for operations that change the elected workspace writer only (ADR-0001).
