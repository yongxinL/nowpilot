// src/entrypoints/standalone/main.tsx — Appendix F.3 standalone mount
// (BLOCKER 2 / W4: canonical path src/entrypoints/standalone/, REPLACES the
// 01-01 stub body, does NOT regenerate). The standalone opens as an extension
// TAB via the 01-06 update-or-create dedupe (W-12) — no popup window
// dimensions apply here.
//
// 01-10 gap closure (REVIEW WR-02/WR-03): this mount also hydrates the
// addon-settings store (np_addon_settings — onboarding.done persists across
// surface loads) and fires the workspace lifecycle (hydrate np_workspace →
// activate the standalone surface → start the cross-surface sync loop from the
// module-level sync ref held for stop()). Described by concept here — no
// literal call expressions in the header so the per-file call-site greps stay
// unambiguous.
//
// 02-11 storage bootstrap: this mount ALSO runs the storage-layer init before
// the workspace lifecycle resolves — KeyVault first-run (np_install_secret,
// D-02), migrate-on-read (np_schema_version + per-key sanitizers, D-10), and
// the IDB migrator over the real stores at their current versions (D-12/D-14).
// Every step is wrapped: a failure degrades gracefully (debugLog + fall-
// through) and never rejects the mount (Golden Rule 9). R-3: this is one of
// the ONLY two surfaces (sidepanel + standalone) where vault/IDB init may run;
// the background SW never does.
//
// Mirrors the side panel mount (01-09 Task 1): exactly ONE provider per surface
// (§5.5 / Appendix F) — the XProvider from @ant-design/x EXTENDS antd's
// provider, so the getAntdConfig (01-05) config is spread into the single
// XProvider with the DEFAULT density (compact: false per RUNTIME-04). AntdApp →
// ErrorBoundary (01-04) → StandaloneRouter (01-08). Theme readiness gate
// (T-1-22) + lifted global mod+k capture (isCmdK → controlled CmdKPicker) —
// identical to the side panel entrypoint. Pitfall 4: no content-script module
// imports; entrypoints are the ONLY createRoot call sites.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { StandaloneRouter } from '@/components/standalone/StandaloneRouter';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { isCmdK } from '@/core/input/KeymapRegistry';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { WorkspaceSync } from '@/core/workspace/WorkspaceSync';
import { useAddonSettingsStore } from '@/core/registry/AddonSettingsStore';
import { getKeyVault } from '@/core/security/KeyVault';
import { openErrorStore } from '@/core/storage/ErrorStore';
import * as Migrator from '@/core/storage/IndexedDBMigrator';
import * as Setting from '@/core/storage/Setting';
import {
  DB_VERSION as CHAT_HISTORY_DB_VERSION,
  openChatHistoryDB,
} from '@/core/storage/ChatHistoryDB';
import { DB_VERSION as MEMORY_DB_VERSION, openMemoryDB } from '@/core/storage/MemoryDB';
import { DB_VERSION as NOTES_DB_VERSION, openNotesDB } from '@/core/storage/NotesDB';
import { openWriteJournalDB } from '@/core/storage/WriteJournal';
import { deserializeEnvelope, isSerializedVaultEnvelope } from '@/core/storage/EncryptedStorage';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { getProviderRouter } from '@/core/ai/ProviderRouter';
import { ProviderConfigSchema } from '@/core/ai/types';
import { privacyModeFromPrefs } from '@/core/ai/TierResolver';
import type { TierResolveInput } from '@/core/ai/TierResolver';
import { readPersonaPrefs } from '@/core/ai/persona/personaConfig';
// The single provider reference on this surface (Appendix F: XProvider EXTENDS
// antd's provider — exactly one provider per surface, grep fixture).
export type { ConfigProviderProps } from 'antd';

/** §0.2 four-ID rule — the only provider ids the wiring enumerates (R-1: matches ProviderId). */
const AI_PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'ollama'] as const;

/**
 * Storage-layer bootstrap (02-11): KeyVault first-run → migrate-on-read →
 * IDB migrator + ErrorStore, fired at mount BEFORE the workspace init chain
 * completes. Every step is wrapped — a broken vault/IDB degrades gracefully
 * (debugLog with canonical §C.2 codes + fall-through) and never rejects the
 * mount (Golden Rule 9). R-3: this function only ever runs on the
 * sidepanel/standalone surfaces, never in the background SW.
 */
async function runStorageBootstrap(): Promise<void> {
  // 1. KeyVault first-run (D-02): generate np_install_secret once via
  // read-then-write-if-absent (immutable once set — never regenerated).
  try {
    await getKeyVault().getInstallSecret();
  } catch (err) {
    debugLog(ERROR_CODES.PROVIDER_KEY_UNREADABLE, 'KeyVault first-run failed at mount', {
      error: err instanceof Error ? err : undefined,
      module: 'storage-bootstrap',
    });
  }

  // 2. Migrate-on-read (D-10): normalize old KV shapes (np_workspace /
  // np_providers / np_addon_settings) before consumers read them.
  try {
    await Setting.runMigrateOnRead(Setting.DEFAULT_MIGRATE_SANITIZERS);
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'migrate-on-read failed at mount', {
      error: err instanceof Error ? err : undefined,
      module: 'storage-bootstrap',
    });
  }

  // 3. IDB migrator + ErrorStore (D-12/D-14): open the ErrorStore sink, then
  // warm-open each real store through its canonical happy-path opener (the
  // first run creates the v1 schema — never let the migrator create an EMPTY
  // version-1 DB) and run the migrator over the registered spec at the store's
  // current version. All specs are migration-free today; future phases (e.g.
  // Phase 5a NotesDB v4) extend the registry and the runner executes their
  // migrations at mount. A migration failure records IDB_MIGRATION_FAILED and
  // the DB degrades to read-only — the state getDegradedDbs exposes for the
  // Phase-7 banner (D-12) ships here.
  try {
    await openErrorStore();
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'ErrorStore open failed at mount', {
      error: err instanceof Error ? err : undefined,
      module: 'storage-bootstrap',
    });
  }
  const idbSpecs: Migrator.DBVersionMigration[] = [
    { dbName: 'ChatHistoryDB', dbVersion: CHAT_HISTORY_DB_VERSION, migrations: [] },
    { dbName: 'NotesDB', dbVersion: NOTES_DB_VERSION, migrations: [] },
    { dbName: 'MemoryDB', dbVersion: MEMORY_DB_VERSION, migrations: [] },
    // WriteJournalDB v1 (02-04) — WRITE_JOURNAL_DB_VERSION is module-private.
    { dbName: 'WriteJournalDB', dbVersion: 1, migrations: [] },
  ];
  for (const spec of idbSpecs) {
    try {
      await warmOpenIdbStore(spec.dbName);
      await Migrator.runMigrations(spec);
    } catch (err) {
      debugLog(ERROR_CODES.IDB_MIGRATION_FAILED, 'IDB migrator failed at mount', {
        error: err instanceof Error ? err : undefined,
        module: 'storage-bootstrap',
        extra: { dbName: spec.dbName },
      });
    }
  }
}

/** Warm-open a real store via its canonical opener (creates the v1 schema on first run). */
async function warmOpenIdbStore(dbName: string): Promise<void> {
  switch (dbName) {
    case 'ChatHistoryDB':
      (await openChatHistoryDB()).close();
      break;
    case 'NotesDB':
      (await openNotesDB()).close();
      break;
    case 'MemoryDB':
      (await openMemoryDB()).close();
      break;
    case 'WriteJournalDB':
      (await openWriteJournalDB()).close();
      break;
    default:
      break;
  }
}

/**
 * AI runtime bootstrap (03-09): the ONLY place the AI runtime/vault decrypt
 * runs on this surface (R-3 — the background SW never imports the AI layer).
 * At mount: resolve each configured provider's np_providers.<id> vault envelope
 * (Setting.read → deserialize → KeyVault.decryptSecret) → register the provider
 * or, on decrypt failure, mark it PROVIDER_KEY_UNREADABLE (enabled:false,
 * treated as unconfigured — D-21, NO auto-wipe, NO auto-regenerate, 02-CONTEXT
 * D-04); load np_persona via the D-09 accessor; then configure the Router
 * baseline BEFORE any send (configuredProviders + D-13 privacyMode from prefs).
 * Every step is wrapped (debugLog with canonical §C.2 codes + fall-through,
 * Golden Rule 9) — a vault/router/persona failure degrades gracefully and never
 * blocks the mount (T-03-09-03). API keys exist only inside this function scope
 * (T-03-09-01); the registry stores apiKey-stripped snapshots (R-10).
 */
async function runAIRuntimeInit(): Promise<void> {
  const registry = getProviderRegistry();
  const vault = getKeyVault();
  const configuredProviders: TierResolveInput['configuredProviders'] = [];

  for (const providerId of AI_PROVIDER_IDS) {
    const key = `np_providers.${providerId}`;
    try {
      // D-09 Setting.read — per-provider envelope key (WR-10 model: local,
      // encrypted: true via resolveKeyPermission). Missing key = not configured.
      const stored = await Setting.settingRead<unknown>(key, (v) => v, undefined);
      if (stored === undefined) continue;
      // T-03-09-04 (V5 Input Validation): the stored value MUST be a serialized
      // §15.2 envelope; anything else (raw JSON, array) is refused here.
      if (!isSerializedVaultEnvelope(stored)) {
        registry.markProviderKeyUnreadable(providerId);
        debugLog(ERROR_CODES.STORE_READ, 'provider envelope malformed — marked unreadable', {
          module: 'ai-runtime-init',
          extra: { providerId },
        });
        continue;
      }
      const plaintext = await vault.decryptSecret(deserializeEnvelope(stored));
      const config = ProviderConfigSchema.safeParse(JSON.parse(plaintext));
      if (!config.success) {
        // Zod boundary gate — a non-ProviderConfig payload never registers.
        registry.markProviderKeyUnreadable(providerId);
        debugLog(ERROR_CODES.STORE_READ, 'provider config failed schema validation', {
          module: 'ai-runtime-init',
          extra: { providerId },
        });
        continue;
      }
      registry.registerProvider(config.data);
      configuredProviders.push({
        id: config.data.id,
        models: config.data.models,
        enabled: config.data.enabled,
        priority: config.data.priority,
      });
    } catch (err) {
      // Decrypt failure → the single PROVIDER_KEY_UNREADABLE state (D-04):
      // mark disabled + typed emission; decryptSecret already debugLogged the
      // VAULT_DECRYPT_FAILED/install-secret-cleared road. No wipe (D-04).
      registry.markProviderKeyUnreadable(providerId);
      debugLog(ERROR_CODES.PROVIDER_KEY_UNREADABLE, 'provider wiring failed at mount', {
        error: err instanceof Error ? err : undefined,
        module: 'ai-runtime-init',
        extra: { providerId },
      });
    }
  }

  // Router baseline BEFORE any send (D-13): configuredProviders from the
  // registry snapshot + privacyMode from prefs (false → 'prefer-local', true →
  // 'cloud-ok'; 'local-only' reserved). A failure degrades gracefully — the
  // per-call values in the hook (03-08) still win when supplied.
  try {
    const prefs = await readPersonaPrefs();
    getProviderRouter().configure({
      configuredProviders,
      privacyMode: privacyModeFromPrefs(prefs),
    });
  } catch (err) {
    debugLog(ERROR_CODES.STORE_READ, 'router configure failed at mount', {
      error: err instanceof Error ? err : undefined,
      module: 'ai-runtime-init',
    });
  }
}

function StandaloneRoot() {
  const isReady = useThemeStore((s) => s.isReady);
  const mode = useThemeStore((s) => s.mode);
  const pack = useThemeStore((s) => s.pack);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // Fire-and-forget hydrate (idempotent): re-fires only if the mount raced
    // the module-scope init.
    if (!useThemeStore.getState().isReady) {
      void useThemeStore.getState().init();
    }
  }, []);

  // Global mod+k capture lifted at the entrypoint → controlled CmdKPicker.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isCmdK(event)) {
        event.preventDefault();
        setPickerOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // T-1-22 readiness gate: render null until the theme store resolved — a
  // blank frame, never a wrong-theme flash.
  if (!isReady) return null;

  const cfg = getAntdConfig({ mode, pack, compact: false });
  return (
    <XProvider {...cfg}>
      <AntdApp>
        <ErrorBoundary>
          <StandaloneRouter pickerOpen={pickerOpen} onPickerOpenChange={setPickerOpen} />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
}

/** Testable app root (mount smoke tests render this; no hooks run here). */
export function createStandaloneApp() {
  return <StandaloneRoot />;
}

// WR-12: module-scope ref so the teardown hook (pagehide) can reach stop() —
// an HMR re-evaluation must not leak a second live WorkspaceSync instance.
let workspaceSync: WorkspaceSync | null = null;

// Fire the theme hydrate before first render (plan truth). Module-scope guard:
// only mount when a #root element exists (jsdom tests have none).
if (typeof document !== 'undefined') {
  void useThemeStore.getState().init();
  // WR-02: hydrate np_addon_settings so onboarding.done persists across loads.
  void useAddonSettingsStore.getState().init();
  // 02-11: storage-layer bootstrap — KeyVault first-run + migrate-on-read +
  // IDB migrator fire BEFORE the workspace init chain; non-blocking and never
  // rejecting (a storage failure degrades gracefully, Golden Rule 9).
  // 03-09 (R-3): the AI runtime bootstrap — vault provider envelopes →
  // registry → Router.configure (baseline + D-13 privacyMode) — chains AFTER
  // the vault first-run so decrypt has an installSecret; fire-and-forget, never
  // blocking the mount (T-03-09-03).
  void runStorageBootstrap().then(() => {
    void runAIRuntimeInit();
  });
  // WR-03: module-level sync ref (held for stop()); the constructor is
  // side-effect-free — only start() activates subscriptions/timers.
  workspaceSync = new WorkspaceSync('standalone');
  // WR-03: activate the workspace lifecycle AFTER hydration completes — start()
  // must never run before np_workspace is merged (VERIFICATION gaps[0] fix).
  const workspaceInit = useWorkspaceStore.getState().init();
  // WR-11: every link of the mount chain is rejection-observable (Golden Rule
  // 9) — start() is awaited-with-catch and init() failures are logged, so a
  // broken workspace never activates silently.
  void workspaceInit
    .then(() => {
      void useWorkspaceStore
        .getState()
        .start('standalone')
        .catch((err: unknown) => {
          debugLog(ERROR_CODES.WORKSPACE_START, 'workspace start failed at mount', {
            error: err instanceof Error ? err : undefined,
            module: 'WorkspaceStore',
          });
        });
      workspaceSync?.start();
    })
    .catch((err: unknown) => {
      debugLog(ERROR_CODES.WORKSPACE_INIT, 'workspace init failed at mount', {
        error: err instanceof Error ? err : undefined,
        module: 'WorkspaceStore',
      });
    });
  // WR-12: teardown — stop the sync instance (heartbeat, bus/store/bridge
  // subscriptions) and detach the store's storage listener when the surface is
  // unloaded (page close / HMR re-evaluation), so no second instance leaks.
  window.addEventListener('pagehide', () => {
    workspaceSync?.stop();
    workspaceSync = null;
    useWorkspaceStore.getState().stop();
  });
  const rootElement = document.getElementById('root');
  if (rootElement !== null) {
    createRoot(rootElement).render(<StandaloneRoot />);
  }
}
