# API Coverage — Storage / Security / Persistence Surface (Phase 2)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 2 ships the durable, crash-safe, encrypted persistence core: an AES-GCM vault
> (KeyVault + EncryptedStorage) in chrome.storage.local, a WriteJournal for crash-recoverable
> workspace-state writes, four IndexedDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore)
> via idb with the IndexedDBMigrator, serialized per-key Setting writes, migrate-on-read KV
> versioning, sync-quota fallback for cosmetic keys, redaction at every write boundary, and the
> core import/export module (JSON + ZIP via fflate). The "external surface" is the browser API
> surface and platform primitives consumed by the shipped code — Phase 2 integrates **no**
> third-party network API or service.

| capability | decision | reason |
|---|---|---|
| chrome.storage.local (get/set/remove, onChanged) | INTEGRATE | Canonical KV store: installSecret (D-02), np_providers ciphertext (D-01), journaled np_workspace, theme shadows (D-15), migrate-on-read np_schema_version (D-10), Setting.ts wrapper (STORAGE-02/D-09) |
| chrome.storage.session (get/set/remove) | INTEGRATE | D-11 session tokens (np_jsessionid, np_sysparm_ck, np_token_ttl, np_active_stream, np_workspace_primary) in key registry; cleared on browser close, never encrypted/exported |
| chrome.storage.sync (get/set, quota/rate) | INTEGRATE | D-15 preferred store for cosmetic keys (np_theme/np_theme_pack/np_language) with local-shadow fallback + reconcile; sync-quota caught as SYNC_QUOTA_EXCEEDED, never surfaced to UI |
| IndexedDB (idb ^1) | INTEGRATE | Four stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) + WriteJournalDB; IndexedDBMigrator (D-14) raw open + sync dispatch + idb wrap(); degraded read-only + IDB_MIGRATION_FAILED sink (D-12) |
| Web Crypto (crypto.subtle / crypto.getRandomValues) | INTEGRATE | AES-GCM-256 at-rest obfuscation + PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) key derivation (§15.2, D-02); random 32-byte installSecret generation — browser-native, no network |
| fflate ^0.8 (ZIP) | INTEGRATE | ZIP export/import full-vault bundles (zipSync/unzipSync) behind ImportExport core (D-17); approved stack §7, local-only byte manipulation, no network |
| chrome.runtime (onMessage/sendMessage) | INTEGRATE | Reuses Phase 1 MessageBus transport for workspace persistence + cross-surface handoff (np_workspace mirror/primary coordination) |
| External AI provider SDKs (openai/anthropic/gemini/ollama) | OPT-OUT | D-06 defers the provider flow to Phase 3; Phase 2 only encrypts provider API keys at rest — no SDK is installed or called |
| content-extraction libraries (defuddle, @mozilla/readability, turndown) | OPT-OUT | D-16 extraction begins Phase 4a; Phase 2 content bundle excludes vault/IDB/network stack (FORBIDDEN_TOKENS extended with idb/fflate/KeyVault/EncryptedStorage/fake-indexeddb) |
| chrome.identity / OAuth / any network fetch | OPT-OUT | No network egress in Phase 2 — vault is at-rest obfuscation only, secrets never leave the machine (D-01/D-17 export contract: "no API keys") |
| chrome.alarms / chrome.contextMenus | OPT-OUT | Phase 1 integrated these for keepalive/context-menu skeleton; Phase 2 adds no new alarm/menu capabilities |

## Detection note

The `verify:pre` api-coverage detector fired on prose false positives ("Provider API keys
must never sit in plaintext", "Uint8Array API", a "wire rest" phrase in 02-RESEARCH.md) —
all describe **encrypting** provider keys or browser-native APIs, not integrating an external
service. This matrix records the actual Phase 2 surface above for the record.
