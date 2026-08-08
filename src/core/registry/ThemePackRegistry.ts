// src/core/registry/ThemePackRegistry.ts — The first WSPC-04 registry instance.
// Generic Map-based registry shape that AddonRegistry / page registries (01-07)
// reuse: idempotent re-registration (replacing the existing entry, logged
// silent:true), synchronous Map ops (concurrency-safe by construction — no async
// races; callers may register from any context), and a per-entry `ready`
// readiness flag (D-12). The singleton is pre-registered with THEME_PACKS so
// pack readiness is known from startup. register() never throws (Golden Rule 9):
// an invalid id shape is logged with REGISTRY_INIT and skipped.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { isThemePackId, THEME_PACKS } from '@/core/theme/themePacks';
import type { ThemePack, ThemePackDef } from '@/core/theme/themePacks';

export class ThemePackRegistry {
  private packs = new Map<ThemePack, ThemePackDef>();

  /** Idempotent — re-registering an existing id replaces it (silent:true log). */
  register(pack: ThemePackDef): void {
    if (!isThemePackId(pack.id)) {
      debugLog(ERROR_CODES.REGISTRY_INIT, 'skipping theme pack with invalid id', {
        module: 'ThemePackRegistry',
        extra: { id: pack.id },
      });
      return;
    }
    if (this.packs.has(pack.id)) {
      debugLog(ERROR_CODES.REGISTRY_INIT, `re-registering theme pack ${pack.id}`, {
        silent: true,
        module: 'ThemePackRegistry',
      });
    }
    this.packs.set(pack.id, pack);
  }

  registerAll(packs: ThemePackDef[]): void {
    for (const pack of packs) this.register(pack);
  }

  get(id: ThemePack): ThemePackDef | undefined {
    return this.packs.get(id);
  }

  list(): ThemePackDef[] {
    return [...this.packs.values()];
  }

  has(id: ThemePack): boolean {
    return this.packs.has(id);
  }

  /** D-12 readiness — default true; liquid-glass/claude-warm false. */
  isReady(id: ThemePack): boolean {
    return this.packs.get(id)?.ready ?? false;
  }
}

let singleton: ThemePackRegistry | null = null;

/**
 * Singleton pre-registered with THEME_PACKS so readiness is known from startup
 * (D-12). Lazy-initialized on first access.
 */
export function getThemePackRegistry(): ThemePackRegistry {
  if (singleton === null) {
    singleton = new ThemePackRegistry();
    for (const pack of Object.values(THEME_PACKS)) singleton.register(pack);
  }
  return singleton;
}
