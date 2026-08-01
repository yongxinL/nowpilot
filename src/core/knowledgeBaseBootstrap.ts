import { noteSearchIndex } from './notes/MiniSearchNoteIndex';
import { setPrimarySurfaceId } from './runtime/BroadcastBus';

let initPromise: Promise<void> | null = null;

/**
 * Phase-5 startup wiring (WR-01 / WR-04 / WR-05): called once per JS
 * context from every surface entrypoint (web preview, SidePanel, Full App
 * Tab). The idempotency guard is per-context — each extension surface runs
 * its own module instance; cross-context state (the MEM-02 election)
 * converges via BroadcastBus PRIMARY_SURFACE_ELECTED sync.
 *
 * - WR-04 (MEM-02): set the surface identity and elect this surface as
 *   primary so the single-writer gate is effective in production. Every
 *   context converges on the elected primary via the broadcast (last
 *   election wins; secondary contexts become read-only).
 * - WR-01: restore the persistent BM25 index before any search so search
 *   results survive extension reloads.
 *
 * Never throws — startup wiring failures log and degrade to an empty (but
 * usable) index rather than crashing the surface.
 */
export function initializeKnowledgeBase(surfaceId: string): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        (globalThis as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ = surfaceId;
        setPrimarySurfaceId(surfaceId);
        await noteSearchIndex.load();
      } catch (err) {
        console.error('[knowledge-base] startup wiring failed:', err);
      }
    })();
  }
  return initPromise;
}
