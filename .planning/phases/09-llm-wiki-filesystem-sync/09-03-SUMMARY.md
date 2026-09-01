---
phase: 09-llm-wiki-filesystem-sync
plan: 03
subsystem: notes, filesystem, sync
tags: [llm, wiki, filesystem, sync, yaml, okf, frontmatter, restore, wicg]

requires:
  - phase: 09-llm-wiki-filesystem-sync
    plan: 01
    provides: Note type, OkfFrontmatter type, notes_backup_config store, v4 migration
  - phase: 08-knowledge-base-memory-minisearch-notes
    provides: NotesDB, Note type, save.ts NOTE_SAVED_EVENT
provides:
  - NoteFileSync service (one-way app→filesystem .md backup)
  - serializeNoteToMarkdown (OKF v0.2 YAML frontmatter + body)
  - parseNoteFromMarkdown (tolerates unknown OKF fields per D-121)
  - FileSystemAdapter abstraction (testable FS layer)
  - Restore parser (walk backup tree, classify new/updated/unchanged, additive import)
  - Event subscription (NOTE_SAVED_EVENT → 50ms debounce → sync)
affects: [phase-15-workspace-ui, phase-10-memory-governance]

actuals:
  tokens: 110000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "FileSystemAdapter interface for testable FS Access API"
    - "yaml.stringify/parse for OKF v0.2 frontmatter serialization"
    - "EventBus.on subscription with debounced fire-and-forget sync"
    - "resolveUniqueFilename with (n) suffix collision handling"

key-files:
  created:
    - src/core/notes/NoteFileSync.ts
  modified:
    - src/types/notes.ts
  tests:
    - tests/core/notes/NoteFileSync.test.ts

truths-verified:
  - "showDirectoryPicker() + handle persist in notes_backup_config (Standalone view only)"
  - "Per-save .md sync with OKF v0.2-aligned YAML frontmatter (type/description/id/generated/status, SYNC-04)"
  - "Nested folders from categoryPath + collision suffixing + external-change guard (2s tolerance)"
  - "Restore parser tolerates OKF keys and ignores unknown OKF fields (SYNC-09)"
  - "Wikilinks remain the body edge syntax (not OKF markdown-link edges — OKF-WIKI-04 boundary)"
  - "Additive restore — notes not in folder are NOT deleted"

deviations:
  - "None — implementation matches plan exactly"

decisions:
  - "serializeNoteToMarkdown takes tier param for generated.by field (nowpilot/{tier})"
  - "External-change guard: 2s tolerance window (lastModified > now + 2000)"
  - "Restore reconstructs categoryPath from folder hierarchy (SYNC-09)"
  - "init() returns unsubscribe function for clean teardown"
