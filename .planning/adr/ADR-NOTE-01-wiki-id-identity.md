# ADR-NOTE-01 — WIKI-ID UUID is the sole note identity; no parallel alias store

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** George Li (product owner / architect)
- **Decides:** RESEARCH-RECONCILIATION.md REQ-R14 / §F
- **Related:** PITFALLS.md P10, spec §27.7a (WIKI-ID-01…04), spec §21.2 (Note), §28.4 (memory mapping)

## Context

`PITFALLS.md` P10 (wikilink breakage on rename) recommends giving each note a stable immutable ID plus an **alias index** so `[[display]]` links resolve through the ID, following Obsidian's Smart Rename alias pattern.

The spec **already solves this**: §27.7a WIKI-ID-01…04 defines an **immutable UUID** per note (`crypto.randomUUID()` at creation, never changes on rename/move/restore), **ID-based edges** for wikilinks (`links[]` stores note IDs, never titles), and an `unresolvedLinks[]` set for dangling references. Memory→note mapping (§28.4) keys on that UUID. So a separate "alias index" store would be **redundant machinery** competing with WIKI-ID — exactly the kind of invented scope the reconciliation governance rule guards against.

The one legitimate residual need P10 raises: preserving **human-readable rename history** (old title → current note) for display, without rewriting link text across the vault (which, under filesystem sync, causes conflict storms — REQ-R15 / P9).

## Decision

**WIKI-ID's immutable UUID is the single source of note identity.** There is **no parallel alias store.**

- Wikilinks resolve via the WIKI-ID UUID + ID-based edges (spec §27.7a) — unchanged.
- Rename changes **display title only**; the UUID and all edges are untouched. No bulk link-text rewrite across the vault (P10 anti-pattern; conflicts with sync REQ-R15).
- A **thin, optional `oldTitle → UUID` display map** MAY be kept purely for human-readable rename history / "formerly known as" UX. It is a display convenience, **not** an identity or resolution mechanism — link resolution never depends on it.
- Memory↔note mapping keys on UUID, never title (spec §28.4; P10 memory-detachment trap).

REQ-R14 is therefore recorded as **DROP (as a standalone store) / KEEP (as display-only lookup)**.

## Consequences

- **Positive:** no duplicate identity systems; a cost-effective model has exactly one rule ("resolve by UUID"); no vault-wide link-rewrite churn; sync-safe.
- **Negative:** none material — the display map is trivial and optional.
- **Risk if ignored:** two competing "identity" mechanisms (WIKI-ID + alias index) would let a cheap model pick the wrong one and desync the link graph.

## Verification

- Rename test: renaming a note changes its title; all `[[...]]` links and memory edges still resolve (they key on UUID); zero link-text rewrites appear in the WriteJournal.
- No `AliasIndex`/`aliasStore` module exists as an identity/resolution layer; any `oldTitle→UUID` map is display-only and not consulted during link resolution.
- Memory edges reference note UUIDs, not titles (grep memory store schema).
- Filesystem restore (§27.3) reconstructs UUIDs from YAML frontmatter, preserving every edge.
