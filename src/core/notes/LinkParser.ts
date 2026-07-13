import MiniSearch from 'minisearch';
import { debugLog } from '../utils/debugLog';

// ── Types ──

export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
}

export interface ParsedLink {
  title: string;
  alias: string;
  raw: string;
}

export interface ResolutionResult {
  found: boolean;
  noteId?: string;
  ambiguous?: boolean;
  candidates?: Array<{ id: string; title: string }>;
}

export interface BacklinkEntry {
  noteId: string;
  title: string;
  snippet: string;
}

export interface SearchResult {
  id: string;
  title: string;
  score: number;
  snippet?: string;
}

// ── Constants ──

const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g;

// ── LinkParser class ──

export class LinkParser {
  private index: MiniSearch;

  constructor() {
    this.index = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['id', 'title', 'updatedAt'],
      searchOptions: {
        boost: { title: 3 },
        prefix: true,
        fuzzy: 0.2,
      },
      idField: 'id',
      tokenize: (text, fieldName) => {
        if (fieldName === 'title') {
          return text.split(/[\s]+/).filter(Boolean);
        }
        return text.split(/[\s.,;:!?()[\]{}]+/).filter(Boolean);
      },
    });
  }

  /**
   * Parse wikilinks from content string.
   * Matches [[title]] and [[title|alias]] patterns.
   */
  parseLinks(content: string): ParsedLink[] {
    const links: ParsedLink[] = [];
    let match: RegExpExecArray | null;
    // Reset lastIndex for fresh regex execution
    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(content)) !== null) {
      const title = match[1].trim();
      if (!title) continue;
      links.push({
        title,
        alias: match[2]?.trim() || title,
        raw: match[0],
      });
    }
    return links;
  }

  /**
   * Resolve a wikilink title to a note.
   * Pipeline: exact match → case-insensitive → MiniSearch fuzzy → ambiguous → not found
   */
  async resolve(title: string, allNotes: Note[]): Promise<ResolutionResult> {
    // 1. Exact match
    const exact = allNotes.find((n) => n.title === title);
    if (exact) return { found: true, noteId: exact.id };

    // 2. Case-insensitive match
    const lowerTitle = title.toLowerCase();
    const caseInsensitive = allNotes.find((n) => n.title.toLowerCase() === lowerTitle);
    if (caseInsensitive) return { found: true, noteId: caseInsensitive.id };

    // 3. MiniSearch fuzzy match
    const results = this.index.search(title, { fuzzy: 0.2, prefix: true });
    if (results.length === 1 && (results[0].score as number) > 0.5) {
      return { found: true, noteId: results[0].id as string };
    }
    if (results.length > 1) {
      return {
        found: false,
        ambiguous: true,
        candidates: results.map((r) => ({
          id: r.id as string,
          title: r.title as string,
        })),
      };
    }

    // 4. Not found
    return { found: false, ambiguous: false };
  }

  /**
   * Build backlinks map from all notes.
   * For each note, scan all other notes' content for wikilinks targeting this note's title.
   */
  buildBacklinks(allNotes: Note[]): Map<string, BacklinkEntry[]> {
    const backlinks = new Map<string, BacklinkEntry[]>();

    // For each note, check if any other note's content links to it
    for (const note of allNotes) {
      for (const other of allNotes) {
        if (other.id === note.id) continue;
        if (!other.content) continue;

        const links = this.parseLinks(other.content);
        for (const link of links) {
          // Try to resolve the link title to this note
          if (
            link.title.toLowerCase() === note.title.toLowerCase() ||
            link.alias.toLowerCase() === note.title.toLowerCase()
          ) {
            // Build snippet: 60 chars around the wikilink match
            const linkIndex = other.content.indexOf(link.raw);
            const start = Math.max(0, linkIndex - 30);
            const end = Math.min(other.content.length, linkIndex + link.raw.length + 30);
            let snippet = other.content.slice(start, end);
            if (start > 0) snippet = '...' + snippet;
            if (end < other.content.length) snippet = snippet + '...';

            if (!backlinks.has(note.id)) {
              backlinks.set(note.id, []);
            }
            backlinks.get(note.id)!.push({
              noteId: other.id,
              title: other.title,
              snippet,
            });
          }
        }
      }
    }

    return backlinks;
  }

  /**
   * Full rebuild of the MiniSearch index from all notes.
   */
  rebuildIndex(notes: Note[]): void {
    try {
      this.index.removeAll();
      this.index.addAll(
        notes.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          updatedAt: n.updated,
        })),
      );
    } catch (err) {
      debugLog('error', '[LinkParser] rebuildIndex failed', { error: err });
    }
  }

  /**
   * Search the MiniSearch index with prefix and fuzzy matching.
   */
  search(query: string): SearchResult[] {
    try {
      const results = this.index.search(query, {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 3 },
      });
      return results.map((r) => ({
        id: r.id as string,
        title: (r.title as string) || '',
        score: r.score as number,
        snippet: this.buildSnippet(query, (r as Record<string, unknown>).content as string | undefined),
      }));
    } catch (err) {
      debugLog('error', '[LinkParser] search failed', { error: err });
      return [];
    }
  }

  /**
   * Add a single note to the index.
   */
  addToIndex(note: Note): void {
    try {
      this.index.add({
        id: note.id,
        title: note.title,
        content: note.content,
        updatedAt: note.updated,
      });
    } catch (err) {
      debugLog('error', '[LinkParser] addToIndex failed', { error: err });
    }
  }

  /**
   * Remove a single note from the index.
   */
  removeFromIndex(id: string): void {
    try {
      this.index.discard(id);
    } catch (err) {
      debugLog('error', '[LinkParser] removeFromIndex failed', { error: err });
    }
  }

  /**
   * Build a text snippet around the first match of the query.
   */
  private buildSnippet(query: string, content?: string): string | undefined {
    if (!content) return undefined;
    const lower = content.toLowerCase();
    const q = query.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) return undefined;
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + q.length + 40);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < content.length) snippet = snippet + '…';
    return snippet;
  }
}

export const linkParser = new LinkParser();
