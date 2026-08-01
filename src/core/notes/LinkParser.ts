import type { NotesDB } from './NotesDB';

/**
 * Obsidian-compatible wikilink pattern (RESEARCH §Wikilink Parsing).
 * Captures the title portion of `[[title]]`, `[[title|alias]]`,
 * `[[title#heading]]`, and `[[title#heading|alias]]` — the alias/heading
 * portion is intentionally not captured.
 */
export const WIKILINK_REGEX = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

/**
 * Result of resolving a set of wikilink titles against the notes database.
 */
export interface LinkParseResult {
  /** Resolved note IDs — one per unique title that matched a note (D-02). */
  links: string[];
  /** Raw titles with no matching note (D-03). */
  unresolvedLinks: string[];
}

/**
 * Extract all unique wikilink titles from markdown content (D-01).
 * The regex is read-only extraction — no eval, no code execution (T-05-01).
 */
export function parseWikilinks(content: string): string[] {
  const titles = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    titles.add(match[1].trim());
  }
  return Array.from(titles);
}

/**
 * Resolve wikilink titles to note IDs (RESEARCH §Tie-Break Rule):
 * - 0 matches → title is added to `unresolvedLinks[]`
 * - 1 match → resolved to that note's ID
 * - >1 matches → tie-break to the most recently updated note
 */
export async function resolveLinks(
  titles: string[],
  notesDb: Pick<NotesDB, 'findByTitle'>,
): Promise<LinkParseResult> {
  const links: string[] = [];
  const unresolvedLinks: string[] = [];

  for (const title of titles) {
    const matches = await notesDb.findByTitle(title);
    if (matches.length === 0) {
      unresolvedLinks.push(title);
    } else if (matches.length === 1) {
      links.push(matches[0].id);
    } else {
      const mostRecent = [...matches].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      links.push(mostRecent.id);
    }
  }

  return {
    links: Array.from(new Set(links)),
    unresolvedLinks: Array.from(new Set(unresolvedLinks)),
  };
}
