/**
 * The stale prototype workspace key. Phase 1 deletes it on startup (D-14) so
 * Phase 2 does not inherit a zombie blob; Phase 1 never writes or restores it.
 *
 * This module deliberately imports nothing: the MV3 service worker calls the
 * helper on every wake, and importing it must not pull the workspace store —
 * and with it zustand, immer and zod — into the background bundle.
 */
export const LEGACY_WORKSPACE_STORAGE_KEY = 'np_workspace_store';

/**
 * Removal only. A missing key, an unavailable storage area or a non-extension
 * context (no `chrome`) is a no-op, never an error and never a re-creation.
 */
export async function deleteLegacyWorkspaceBlob(): Promise<void> {
  try {
    const storage = typeof chrome === 'undefined' ? undefined : chrome?.storage?.local;
    if (!storage) return;
    await storage.remove(LEGACY_WORKSPACE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; the stale blob is then simply not deleted.
  }
}
