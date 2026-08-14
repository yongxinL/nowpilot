# Phase 5a: LLM-Wiki & Filesystem Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 05a-LLM-Wiki & Filesystem Sync
**Areas discussed:** Auto-tagging suggestion UX, "Ask notes" RAG surface, Save-to-note entry points, Filesystem sync UX & config

---

## Auto-Tagging Suggestion UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline suggestion bar in editor | Dismissible bar/banner near top of editor, clickable chips + category + summary | ✓ |
| Separate suggestion panel/section | Dedicated panel/side drawer holding suggestions until acted on | |
| Notification-based | Notification popup after save offering suggestions | |

**User's choice:** Inline suggestion bar in editor

| Option | Description | Selected |
|--------|-------------|----------|
| Per-item toggle + Accept all | Each tag has own accept/decline + one-click Accept all | ✓ |
| Batch accept / reject whole set | Single Accept/Dismiss for the whole set | |
| Individual tap-to-keep only | Tags shown unaccepted; user taps to keep | |

**User's choice:** Per-item toggle + Accept all

| Option | Description | Selected |
|--------|-------------|----------|
| Inline path input + suggestion | Category = inline path input; LLM suggestion pre-fills as proposed value | ✓ |
| Tree/single-select picker | Dropdown/tree of existing categoryPaths | |
| Plain text field + suggestion chip | Existing text field; suggestion as separate chip | |

**User's choice:** Inline path input + suggestion

| Option | Description | Selected |
|--------|-------------|----------|
| Persist acceptance; re-suggest only on content change | Accepted persist; rejected remembered; staleness hint re-triggers | ✓ |
| Re-suggest every save | Fresh suggestions each save | |
| Suggestions are one-shot per note | Once per note; manual regenerate only | |

**User's choice:** Persist acceptance; re-suggest only on content change

---

## "Ask Notes" RAG Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Inline search box in Notes view | Search/ask input in Notes toolbar; answers render inline | ✓ |
| Dedicated 'Ask' page/section | Separate Ask view in Standalone | |
| Chat preset (/ask) | Special chat command scoped to notes | |

**User's choice:** Inline search box in Notes view

| Option | Description | Selected |
|--------|-------------|----------|
| Inline answer card w/ citation chips | Answer bubble under search input with clickable citation Tags | ✓ |
| Full RAG chat thread | Persistent threaded Q&A history | |
| Plain results list + optional AI | Plain MiniSearch results; AI only on explicit tap | |

**User's choice:** Inline answer card w/ citation chips

| Option | Description | Selected |
|--------|-------------|----------|
| One input, AI-enhanced results | Single input; AI synthesis on NL question / <3 hits / AI Search on | ✓ |
| Two separate inputs/modes | Separate plain search and Ask box | |

**User's choice:** One input, AI-enhanced results

| Option | Description | Selected |
|--------|-------------|----------|
| Helpful empty message, no LLM call | "No matching notes found" — zero wasted call | ✓ |
| Suggest alternative queries | Message + keyword suggestions from titles | |
| Run RAG anyway | Send to LLM with empty context | |

**User's choice:** Helpful empty message, no LLM call

---

## Save-to-Note Entry Points

| Option | Description | Selected |
|--------|-------------|----------|
| Hover/overflow action on assistant messages | Per-message action in overflow menu | ✓ |
| Chat toolbar button | Single 'Save conversation to note' button | |
| Both | Per-message + toolbar save-conversation | |

**User's choice:** Hover/overflow action on assistant messages

| Option | Description | Selected |
|--------|-------------|----------|
| SaveToNoteDialog modal w/ preview | Modal shows LLM draft for review, edit-in-modal then Save/Cancel | ✓ |
| Navigate to Notes editor pre-filled | Jumps to Notes view with unsaved draft | |
| Toast preview + create | Compact inline preview with quick Create | |

**User's choice:** SaveToNoteDialog modal w/ preview

| Option | Description | Selected |
|--------|-------------|----------|
| Same LLM-drafted dialog | Page capture also routes through NoteChatConverter → dialog | ✓ |
| Plain manual 'New note from page' | Keep Phase-5 manual save (no LLM) | |
| LLM draft only for chat, manual for page | Asymmetric | |

**User's choice:** Same LLM-drafted dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Draft modal in-place | SaveToNoteDialog opens in side panel; save in-place | ✓ |
| Open draft in Standalone | Side panel trigger opens Standalone editor | |

**User's choice:** Draft modal in-place

---

## Filesystem Sync UX & Config

| Option | Description | Selected |
|--------|-------------|----------|
| Both Options + Notes toolbar | Config in Options→Notes + quick indicator/button in Notes toolbar | ✓ |
| Options only | Configure solely in Options→Notes | |
| Notes toolbar only | Folder picker in Notes toolbar | |

**User's choice:** Both Options + Notes toolbar

| Option | Description | Selected |
|--------|-------------|----------|
| Status Tag + last-error tooltip | Green/gray/red Tag in toolbar; tooltip shows last error | ✓ |
| Tag + notification on change | Tag plus antd notification on state change | |
| Settings row only | Backup state shown only in Options | |

**User's choice:** Status Tag + last-error tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Banner w/ Re-select + Dismiss, sync stays off | In-Notes banner; sync disabled until re-selected | ✓ |
| Auto-reprompt on every mount | Banner reappears until fixed (no dismiss) | |
| Notification only | One-time notification; no in-page banner | |

**User's choice:** Banner w/ Re-select + Dismiss, sync stays off

| Option | Description | Selected |
|--------|-------------|----------|
| Options → Import/Export w/ count preview | 'Restore from folder' + preview modal with counts + [Import] [Cancel] | ✓ |
| Same + restore history/undo | Adds restore history/undo | |
| Notes toolbar button | Restore trigger in Notes toolbar | |

**User's choice:** Options → Import/Export w/ count preview

---

## the agent's Discretion

- Exact suggestion-bar component structure/placement + dismiss persistence.
- Exact `np_notes_llm_features` setting shape/storage key/Zod schema + `notes_backup_config` store schema.
- Exact public API surfaces for NoteTagger/NoteQA/NoteChatConverter (MemoryExtractor precedent).
- Exact NoteFileSync debounce/permission-check/write mechanics.
- Exact v4 migration mechanics (idempotent).
- Exact `verify:phase-5a` script shape (§24 chain + spec line 3686).
- Summary snippet placement in NoteList (LLM-WIKI-03).

## Deferred Ideas

- Bidirectional filesystem sync / live folder watch — v2 (SYNC-03).
- Embedding-based / vector retrieval — v2 (EMB-01).
- LLM wikilink autocomplete suggestions — not in v0.1 (D-04).
- Restore history / undo of last import — out of scope.
- Auto-create notes from chat unprompted — out of scope (§27.9).
- Image/file attachments in notes — out of scope (§27.9).
