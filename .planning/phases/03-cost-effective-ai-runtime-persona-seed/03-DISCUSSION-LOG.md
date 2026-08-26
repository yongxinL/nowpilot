# Phase 3: Cost-Effective AI Runtime (+ Persona seed) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 03-cost-effective-ai-runtime-persona-seed
**Areas discussed:** Chat adoption timing, Provider config shape, Tier model defaults, Persona seed content

---

## Chat Adoption Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Chat uses pipeline now | Wire useChatStreaming → AgentOrchestrator, deprecate streamChatResponse (kept for DEMO_MODE only); pipeline exercised in production | ✓ |
| Runtime-only, switch at 15.1 | Ship runtime + unit tests; chat stays on streamChatResponse until Phase 15.1 | |
| Hybrid: fast-path passthrough | Route through pipeline but skip Planner/Executor when no relevant tools | |

**User's choice:** Chat uses pipeline now (Recommended)
**Notes:** Pipeline-first; AgentOrchestrator/Planner/Executor are production-exercised, not test-only.

| Option | Description | Selected |
|--------|-------------|----------|
| Turn-end persist, abort drops | Persist completed message pairs to ChatHistoryDB via WriteJournal; mid-stream chunks in memory only; abort drops partial | ✓ |
| Turn-end persist, abort keeps partial | Persist partial text with 'aborted' marker | |
| Checkpointed mid-stream persist | Journaled per-chunk persistence, resume affordance | |

**User's choice:** Turn-end persist, abort drops (Recommended)
**Notes:** Kills the P2 per-chunk chrome.storage write-rate risk.

| Option | Description | Selected |
|--------|-------------|----------|
| Framework only, zero tools | toolSchemas declares ToolDefinition + manifest; zero tools registered; TOOL_REJECTED proven by tests | ✓ |
| One demo tool for exercise | Tiny demo tool to exercise run_tool path in production | |
| Early built-in tools | Ship spec'd built-in tools early, capabilities later | |

**User's choice:** Framework only, zero tools (Recommended)
**Notes:** No fake tools, no governance surface to revoke; real tools land with owning phases.

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical event union | StreamAdapter normalizes to STREAM_START/DELTA/COMPLETE/ERROR/ABORTED mapped onto §20.6 ActiveStreamState | ✓ |
| Keep callback surface, fix parsing | Keep onChunk/onDone/onError; fix per-provider wire parsing inside | |

**User's choice:** Canonical event union (Recommended)
**Notes:** Single typed stream shape for diagnostics + recovery (future AITransactionLog substrate).

---

## Provider Config Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize in-memory, keep object on disk | Registry reads Phase-2 object shape, exposes normalized API; no disk migration | ✓ |
| Physical disk migration to array | Migrate np_providers object → ProviderConfig[] per §15.1 with one-time migration | |
| Lazy migration on reconfigure | Migrate disk when providers reconfigured, gated by version flag | |

**User's choice:** Normalize in-memory, keep object on disk (Recommended)
**Notes:** Supersedes D-30a's "disk migration" reading — migration becomes normalization at the API boundary.

| Option | Description | Selected |
|--------|-------------|----------|
| Implement overrides key now | np_endpoint_overrides in chrome.storage.local merged over §10.6 defaults | ✓ |
| Reuse existing proxyUrl fields | Read endpoints from ProviderConfig object only | |
| Resolved-endpoint cache | Compute once at boot, cached in memory | |

**User's choice:** Implement overrides key now (Recommended)
**Notes:** D-12 rule holds: localhost:12380 never a canonical default.

| Option | Description | Selected |
|--------|-------------|----------|
| Sync read API, boot hydration | getEnabled()/getById()/getAll(); declarative registration; hydrate once at boot | ✓ |
| Async-first, lazy hydrate | Every get() awaits lazy hydrate | |
| Reactive store subscription | subscribe()/getState() reactive store | |

**User's choice:** Sync read API, boot hydration (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Live discovery + session cache | fetchProviderModels semantics + in-memory per-provider session cache | ✓ |
| Static curated catalog | Ship static model list per provider | |
| Static baseline + live refresh | Static catalog baseline, live refresh overlays | |

**User's choice:** Live discovery + session cache (Recommended)
**Notes:** No static model catalog; TierResolver matches against cached list.

---

## Tier Model Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Mini/haiku/flash fast | Concrete slugs: gpt-4o-mini/haiku/flash fast; gpt-4o/sonnet/pro balanced | |
| Both tiers budget | Both tiers lean cheap | |
| Both tiers flagship | Both tiers lean strong | |
| **Capability tiers only** | **Do NOT ship concrete slugs. TIER_TO_MODEL_CANDIDATES = capability tiers (fast/balanced) only; slugs from live discovery + operator assignment, persisted in UserPreferences.fastModel/balancedModel** | ✓ |

**User's choice:** (free-text) Appendix D – Ship Only Capability Tiers, Not Hard-Coded Provider Model Slugs
**Notes:** Explicit user override of Appendix D placeholders. Selection rule: discover → validate → assign FAST → assign BALANCED → persist operator choice. Benefits cited: no stale names, no vendor churn, no broken defaults, works with OpenAI-compatible + custom Ollama.

| Option | Description | Selected |
|--------|-------------|----------|
| Class-pattern matching | Match ids against /mini|flash|haiku/ etc. class patterns | |
| Manual-only assignment | Operator picks fast/balanced explicitly in Options; write-through to UserPreferences | ✓ |
| Auto-assign + auto-persist on first setup | Auto-pattern + auto-persist discovered models | |

**User's choice:** Manual-only assignment
**Notes:** TierResolver returns null until configured (caller falls back/errors by design, Appendix D).

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill suggestion, manual confirm | First-setup pre-fills fast/balanced with first-discovered per class; user confirms before persist | ✓ |
| Empty until explicitly assigned | Tier fields start empty | |
| Auto-persist on discovery | Auto-persist first-discovered without confirmation | |

**User's choice:** Pre-fill suggestion, manual confirm (Recommended)
**Notes:** Guided default never auto-persisted unconfirmed.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-stage explicit tier | useTierForStage(): Planner fast where available, Renderer fast, Executor turn tier | ✓ |
| One tier per turn | Tier chosen once per turn, all stages share | |
| User-facing tier selector | Visible fast/balanced selector in composer | |

**User's choice:** Per-stage explicit tier (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Registered, tier-mapped only when assigned | OpenAICompat registered; no default tier entry until operator assigns | ✓ |
| First-class tier candidate | OpenAICompat in both tiers by default | |
| Type-only, wire later | Declared in type surface only | |

**User's choice:** Registered, tier-mapped only when assigned (Recommended)

---

## Persona Seed Content

| Option | Description | Selected |
|--------|-------------|----------|
| Spec-verbatim default persona | NowPilot / privacy-first / professional-warm / concise-by-default; matches RICH-R-01 fields exactly | ✓ |
| Neutral minimal persona | 'Assistant', bare tone; character lands Phase 15.3 | |
| Distinctive custom character | Invent a named personality now | |

**User's choice:** Spec-verbatim default persona (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Data-merge in PersonaInjector | inject(profile, overrides) merges at render time; name→identity.name, tone→languageStyle.tone, brevity→languageStyle.brevity | ✓ |
| Bake overrides at hydrate | Merge once into profile object | |
| Separate override block | Overrides as separate cached JSON block | |

**User's choice:** Data-merge in PersonaInjector (Recommended)
**Notes:** Pure data merge; adding a future override is a UserPreferences field, no code change. Confirmed against spec §21.6 enum values.

| Option | Description | Selected |
|--------|-------------|----------|
| Single choke-point injector | One assembly function (PromptCacheManager system-prompt builder) calls PersonaInjector; persona prepended in cached [SYSTEM], byte-stable | ✓ |
| Per-service explicit inject | Each service calls inject() itself | |
| Inject at provider boundary | Wrap raw system string at ILLMProvider/StreamAdapter boundary | |

**User's choice:** Single choke-point injector (Recommended)
**Notes:** No caller can forget the persona; prompt caching preserved.

---

## the agent's Discretion

- ILLMProvider interface method surface (stream vs requestJson, timeout threading)
- PromptCacheManager section segmentation + 5-miss → 60 s disable rule wiring
- RendererService output-cap declaration/override mechanism (512 default)
- Per-provider JSON-mode request shape for StructuredOutput
- Prompt-cache invalidation when persona overrides change
- ChatHistoryDB schema fit for turn-end pair writes

## Deferred Ideas

- Persona persistence (`np_persona`) → Phase 8 (RICH-R-05)
- Persona editor → Phase 15 (RICH-R-04)
- "Meet NowPilot" card → Phase 15.3 (RICH-R-03)
- AITransactionLog/TraceRedactor → Phase 11
- Real tools → owning phases
- Multi-role collaboration → Phase 14
- Diagnostics panel → Phase 11