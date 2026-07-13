import { debugLog } from '../utils/debugLog';

// ── Types ──

export interface NoteGraphNode {
  id: string;
  title: string;
}

export interface NoteGraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: NoteGraphNode[];
  links: NoteGraphLink[];
}

// ── Wikilink regex (same as LinkParser) ──

const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g;

// ── NoteGraph class ──

export class NoteGraph {
  /**
   * Build d3-force compatible graph data from notes.
   * Parses each note's content for wikilinks, resolves targets by title match,
   * and creates edges from source note to resolved target note.
   * Filters out self-links (source === target) and unresolved links.
   */
  buildGraphData(notes: Array<{ id: string; title: string; content?: string }>): GraphData {
    try {
      const nodes: NoteGraphNode[] = notes.map((n) => ({ id: n.id, title: n.title }));
      const links: NoteGraphLink[] = [];
      const titleToId = new Map<string, string>();
      for (const n of notes) {
        titleToId.set(n.title.toLowerCase(), n.id);
      }

      for (const note of notes) {
        if (!note.content) continue;
        const parsed = this.parseLinks(note.content);
        for (const link of parsed) {
          const targetId = titleToId.get(link.title.toLowerCase());
          if (!targetId) continue; // unresolved
          if (note.id === targetId) continue; // self-link
          // Avoid duplicate links
          const exists = links.some(
            (l) => l.source === note.id && l.target === targetId,
          );
          if (!exists) {
            links.push({ source: note.id, target: targetId });
          }
        }
      }

      return { nodes, links };
    } catch (err) {
      debugLog('error', '[NoteGraph] buildGraphData failed', { error: err });
      return { nodes: [], links: [] };
    }
  }

  /**
   * Parse wikilinks from content (local copy to avoid cross-dependency).
   */
  private parseLinks(content: string): Array<{ title: string }> {
    const links: Array<{ title: string }> = [];
    let match: RegExpExecArray | null;
    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(content)) !== null) {
      const title = match[1].trim();
      if (title) {
        links.push({ title });
      }
    }
    return links;
  }
}

export const noteGraph = new NoteGraph();
