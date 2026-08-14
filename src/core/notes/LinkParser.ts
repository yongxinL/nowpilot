// src/core/notes/LinkParser.ts — 05-05 Task 2 (WIKI-ID-02/03, KNW-01): the
// pure wikilink parser. parseLinks() extracts raw [[Title]] targets from the
// markdown body (inline semantics per §27.7a WIKI-ID-02); resolveLinks() maps
// each target to a note ID via the VERBATIM resolution order (exact title
// match → updated desc → id asc, §26/§27.7a); promoteUnresolvedLinks() is the
// save-time reconciliation helper (WIKI-ID-03, D-05-14) that promotes matching
// unresolvedLinks[] → links[] when a new note's title matches.
//
// Determinism rule (contextFeed.ts L13 precedent): pure + deterministic — no
// wall-clock reads, no random number generation, no native RNG/entropy
// primitives. resolveLinks must stay < 20 ms over a 1,000-note list (§22.1).
// Links resolve AT SAVE TIME, never at render (Pattern 4 anti-pattern —
// links[]/unresolvedLinks[] are stored fields, WIKI-ID-02).
import type { Note } from '@/core/storage/NotesDB';

/** Inline [[Title]] capture — innermost text between the first [[ and the next ]]. */
export const WIKILINK_PATTERN = /\[\[([^\]]+)\]\]/g;

/**
 * WIKI-ID-02: extract raw [[Title]] targets from the markdown body.
 * Inline semantics — each capture group is trimmed. Empty input → [].
 * Nested/double brackets are not a Phase-5 concern (the regex captures the
 * text between the first [[ and the next ]]).
 */
export function parseLinks(markdown: string): string[] {
  return [...markdown.matchAll(WIKILINK_PATTERN)].map((m) => m[1].trim());
}

/**
 * WIKI-ID-02 VERBATIM resolution order: exact title match → updated desc →
 * id asc. Resolved targets → note IDs in links[] (preserving target order);
 * targets with no matching title → raw strings in unresolvedLinks[].
 * Must stay < 20 ms over a 1,000-note list (§22.1).
 */
export function resolveLinks(
  targets: readonly string[],
  notes: readonly Pick<Note, 'id' | 'title' | 'updated'>[],
): { links: string[]; unresolvedLinks: string[] } {
  const links: string[] = [];
  const unresolvedLinks: string[] = [];
  for (const title of targets) {
    const match = notes
      .filter((n) => n.title === title)
      .sort((a, b) => b.updated - a.updated || (a.id < b.id ? -1 : 1))[0];
    if (match) links.push(match.id);
    else unresolvedLinks.push(title);
  }
  return { links, unresolvedLinks };
}

/**
 * WIKI-ID-03 / D-05-14: save-time reconciliation — promote matching
 * unresolvedLinks[] entries on referencing notes to the new note's id.
 * Returns, per referencing note, the promoted target strings (caller maps them
 * to the new note id in links[]) and the remaining unresolved strings.
 * Pure helper — the bounded title lookup is the caller's job (05-07 save
 * pipeline); this never blocks the save.
 */
export function promoteUnresolvedLinks(
  referencingNotes: readonly Pick<Note, 'id' | 'unresolvedLinks'>[],
  newNote: { id: string; title: string },
): Array<{ noteId: string; promoted: string[]; remaining: string[] }> {
  const results: Array<{ noteId: string; promoted: string[]; remaining: string[] }> = [];
  for (const note of referencingNotes) {
    const promoted = note.unresolvedLinks.filter((t) => t === newNote.title);
    if (promoted.length === 0) continue; // untouched — not in the result set
    const remaining = note.unresolvedLinks.filter((t) => t !== newNote.title);
    results.push({ noteId: note.id, promoted, remaining });
  }
  return results;
}
