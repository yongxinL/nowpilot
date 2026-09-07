# NowPilot Visual References

## Purpose

This directory contains visual references for NowPilot implementation and
manual acceptance.

Visual references are not independent product requirements.

## Authority Order

When sources conflict, use this order:

1. `.planning/PRODUCT_SPEC_v0_1.md`
2. `.planning/DECISIONS.md`
3. Active phase `PLAN.md`
4. Applicable ADRs
5. Visual references in this directory

A mock-up must never override a canonical path, type, identifier, security
rule, phase boundary or accepted decision.

## Status Values

Each mock-up must be assigned one status:

- `binding-layout`: major regions, proportions and responsive layout are
  Phase acceptance inputs.
- `reference-only`: provides visual direction but does not create acceptance
  requirements.
- `future-reference`: belongs primarily to a later phase.
- `superseded`: retained for history and must not drive implementation.

## Phase Scope Rule

An implementation agent may inspect only the mock-ups explicitly referenced
by the active phase plan.

Visible functionality in a mock-up does not authorise the implementation of:

- future-phase behaviour;
- new data models;
- new public APIs;
- new component paths;
- new commands;
- new storage keys;
- new provider or model contracts;
- host-page integration.

## Phase 1 References

### `phase-01/shell-layout-reference.png`

- Status: `reference-only`
- Use for: outer surface proportions and broad region placement.
- Ignore: Side Panel navigation, provider controls, model controls and
  functional feature actions.

### `phase-01/sidepanel-shell-reference.png`

- Status: `binding-layout`
- Use for: 400 px layout, header, content region, composer and status region.
- Phase 1 implements placeholders only.

### `phase-01/sidepanel-empty-state-reference.png`

- Status: `binding-layout`
- Use for: empty-state composition and composer placement.
- Suggestion actions remain non-functional placeholders in Phase 1.

### `phase-01/standalone-shell-reference.png`

- Status: `reference-only`
- Use for: navigation, header, main workspace and drawer regions.
- Chat, model, provider, history and message actions are not Phase 1
  functionality.

## Future References

Files under `future/` must not be used by the Phase 1 executor unless the
Phase 1 plan explicitly permits a narrowly defined shell-layout detail.

## Evidence Separation

Mock-ups are implementation inputs.

Implementation screenshots and verification evidence must be stored under:

`.planning/evidence/phase-<NN>/`

Do not place implementation screenshots in this mock-up directory.