// LinkParser — D-110 wikilink parse/resolve (WIKI-ID-02/03/04).
//
// Pure-function module (PageIndexBuilder.ts:59-61 constant pattern): extracts
// [[Title]] targets from a note body and resolves each to a note ID via the
// WIKI-ID-02 resolution order. No storage-area imports — the db handle is
// caller-supplied (grep-assertable).
//
// Resolution tie-break (WIKI-ID-02, spec 3902 verbatim): exact title match →
// updated desc → id asc. Pitfall 4: the NotesDB first-hit title helper
// returns an arbitrary hit — resolveLinks does its OWN getAllFromIndex +
// explicit sort instead.

import type { IDBPDatabase } from 'idb';

import type { NotesDBV1 } from '../storage/NotesDB';

/** [[Title]] syntax (WIKI-ID-02). Captures the bracketed target. */
export const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Extract every [[...]] target from `content` in document order,
 * deduplicated (first occurrence wins), trimmed. Flat syntax only — no
 * nested-bracket support (the spec syntax is plain [[Title]]).
 */
export function parseLinks(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of content.matchAll(WIKILINK_RE)) {
    const target = match[1].trim();
    if (target === '' || seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }
  return out;
}

/** Resolved (IDs) + unresolved (raw title strings) targets (WIKI-ID-03). */
export interface LinkResolution {
  links: string[];
  unresolvedLinks: string[];
}

/**
 * Resolve each wikilink target to a note ID via the WIKI-ID-02 order:
 *   1. exact title match (case-sensitive — 'Same' does not match 'SAME')
 *   2. updated DESC → id ASC tie-break
 * Pitfall 4: uses getAllFromIndex + explicit sort, NEVER the first-hit
 * NotesDB title helper (which returns an arbitrary hit).
 *
 * Targets with no matching note land in `unresolvedLinks` (raw title string,
 * WIKI-ID-03) — never executed or rendered as markup.
 */
export async function resolveLinks(
  db: IDBPDatabase<NotesDBV1>,
  targets: string[],
): Promise<LinkResolution> {
  const links: string[] = [];
  const unresolvedLinks: string[] = [];
  for (const target of targets) {
    const hits = await db.getAllFromIndex('notes', 'byTitle', target);
    const exact = hits
      .filter((n) => n.title === target)
      .sort((a, b) => b.updated - a.updated || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (exact.length > 0) {
      links.push(exact[0].id);
    } else {
      unresolvedLinks.push(target);
    }
  }
  return { links, unresolvedLinks };
}

/**
 * WIKI-ID-04 demotion — recompute links[] membership against the live note
 * set. A save/rebuild moves dangling IDs (no longer in `liveIds`) back to
// `unresolvedLinks` (raw title string), WITHOUT rewriting any source body.
 *
 * `idToTitle` is the ID → raw title mapping captured at resolve time so a
// demoted edge recovers its original title string.
 *
 * Pure function — no db.put call. Returns { links, unresolvedLinks }.
 */
export function demoteDangling(
  links: string[],
  liveIds: Set<string>,
  unresolvedLinks: string[],
  idToTitle: Map<string, string>,
): { links: string[]; unresolvedLinks: string[] } {
  const kept: string[] = [];
  const demoted = [...unresolvedLinks];
  for (const id of links) {
    if (liveIds.has(id)) {
      kept.push(id);
    } else {
      const title = idToTitle.get(id);
      if (title !== undefined && !demoted.includes(title)) demoted.push(title);
    }
  }
  return { links: kept, unresolvedLinks: demoted };
}
