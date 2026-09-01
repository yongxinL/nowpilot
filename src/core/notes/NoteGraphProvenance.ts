// NoteGraphProvenance — KNW-01 knowledge-edge provenance operations (D-130).
//
// Pure functions over Note.links[] that tag, filter, and merge edge provenance
// metadata. No storage-area imports — operates on Note[] passed in
// (grep-assertable, TokenBudget.ts style).
//
// KNW-01 provenance sources:
//   - 'explicit': user-created wikilinks (resolveLinks assigns this)
//   - 'imported': edges from filesystem restore / external import
//   - 'suggested': LLM-suggested edges (NoteTagger)
//   - 'accepted': user-confirmed suggested edge (promoted from 'suggested')

import type { Note } from '../../types/notes';
import type { KnowledgeEdgeSource } from '../../types/harness';

/**
 * KNW-01: Tag all links with a given provenance source.
 * Used by NoteTagger for 'suggested' edges and filesystem restore for 'imported'.
 *
 * @param links — the note's existing links array.
 * @param source — the provenance source to assign.
 * @returns New links array with all entries tagged with the given source.
 */
export function tagEdgeSource(links: Note['links'], source: KnowledgeEdgeSource): Note['links'] {
  return links.map((link) => ({ ...link, source }));
}

/**
 * KNW-01: Accept a suggested link — change a 'suggested' edge to 'accepted'.
 * Only modifies the entry matching noteId; other entries are preserved as-is.
 *
 * @param links — the note's existing links array.
 * @param noteId — the target note ID to accept.
 * @returns New links array with the matching entry's source set to 'accepted'.
 */
export function acceptSuggestedLink(links: Note['links'], noteId: string): Note['links'] {
  return links.map((link) =>
    link.noteId === noteId && link.source === 'suggested' ? { ...link, source: 'accepted' } : link,
  );
}

/**
 * KNW-01: Filter edges by provenance source across all notes.
 * Returns {from, to} pairs where the source matches.
 *
 * @param notes — all notes to scan.
 * @param source — the provenance source to filter by.
 * @returns Array of {from, to} edge pairs matching the source.
 */
export function getEdgesBySource(
  notes: Note[],
  source: KnowledgeEdgeSource,
): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = [];
  for (const note of notes) {
    for (const link of note.links) {
      if (link.source === source) {
        edges.push({ from: note.id, to: link.noteId });
      }
    }
  }
  return edges;
}

/**
 * KNW-01: Merge two link arrays, preferring existing source unless incoming
 * is 'explicit'. 'explicit' always wins (user-created edges are authoritative).
 *
 * Merge rules:
 *   - If a link noteId exists in both: keep existing unless incoming.source === 'explicit'
 *   - If a link noteId exists only in incoming: append it
 *   - If a link noteId exists only in existing: keep it
 *
 * @param existing — the current links array.
 * @param incoming — the new links array to merge in.
 * @returns Merged links array.
 */
export function mergeEdgeProvenance(existing: Note['links'], incoming: Note['links']): Note['links'] {
  const merged = [...existing];
  const existingIds = new Set(merged.map((l) => l.noteId));

  for (const link of incoming) {
    const existingIdx = merged.findIndex((l) => l.noteId === link.noteId);
    if (existingIdx === -1) {
      // New link — append.
      merged.push(link);
    } else if (link.source === 'explicit') {
      // Explicit always wins — overwrite.
      merged[existingIdx] = link;
    }
    // Otherwise keep existing (existing source is preferred).
  }

  return merged;
}
