import MiniSearch from 'minisearch';
import type { APCLiteNode } from './apcLite.types';
import type { ExtractionMode } from './types';

/**
 * Ephemeral per-tab MiniSearch page index (D-14, D-15).
 *
 * Chunks extracted content by heading hierarchy, indexes it in an in-memory
 * MiniSearch instance with heading-aware BM25 field boosting, and provides
 * budget-bounded `selectRelevant` retrieval for downstream consumers
 * (ContextOptimizer in Phase 4, future MCP tools in Phase 8).
 *
 * The index is STRICTLY in-memory — never persisted to IndexedDB or
 * chrome.storage (D-14). Per-tab entries are destroyed on tab close via
 * `removeTab()`.
 */
export interface IndexedChunk {
  /** Unique chunk ID: `${tabId}-${chunkIndex}` */
  id: string;
  /** Tab the chunk belongs to */
  tabId: number;
  /** Breadcrumb heading path (e.g. "Introduction → Overview → Details") */
  headingPath: string;
  /** Full text content of this chunk */
  chunkText: string;
  /** Text of the nearest heading (for field boosting) */
  headingText: string;
}

/**
 * Heading hierarchy entry used during markdown chunking.
 */
interface HeadingEntry {
  /** Heading level (1-6) */
  level: number;
  /** Heading text content */
  text: string;
  /** Full breadcrumb path array */
  breadcrumb: string[];
}

/**
 * Approximate token estimate: ~4 chars per token for English text.
 * ContextOptimizer does CJK-aware estimation downstream (D-16);
 * this is a rough approximation for budget-aware retrieval only.
 */
const CHARS_PER_TOKEN = 4;

export class PageIndexBuilder {
  private readonly index: MiniSearch<IndexedChunk>;
  /**
   * Per-tab stored chunks for fast tab-scoped removal via `MiniSearch.remove()`
   * (which requires the full document, unlike `discard` which defers index cleanup).
   */
  private readonly tabChunks = new Map<number, IndexedChunk[]>();

  constructor() {
    this.index = new MiniSearch<IndexedChunk>({
      fields: ['chunkText', 'headingText', 'headingPath'],
      storeFields: ['tabId', 'headingPath', 'chunkText', 'headingText'],
      searchOptions: {
        boost: {
          headingText: 2.0,   // D-15: heading-match relevance
          headingPath: 1.5,
        },
        prefix: true,
      },
    });
  }

  /**
   * Builds the index from extracted markdown (mode='default').
   *
   * Chunks markdown by heading hierarchy using regex heading detection.
   * Leading content before the first heading gets `headingPath = "(preamble)"`.
   * Always calls `removeTab(tabId)` first — never appends to a stale index
   * (Pitfall 5: unbounded index growth).
   */
  buildFromText(tabId: number, _mode: ExtractionMode, content: string): void {
    // Clear stale entries first (Pitfall 5)
    this.removeTab(tabId);

    const chunks = this.chunkMarkdown(tabId, content);
    if (chunks.length === 0) {
      this.tabChunks.set(tabId, []);
      return;
    }

    this.index.addAll(chunks);
    this.tabChunks.set(tabId, chunks);
  }

  /**
   * Builds the index from an APCLiteNode tree (mode='actionable').
   *
   * Flattens the tree into text chunks — each node's `name`, `role`, and
   * `attributes` become searchable text. The heading path is built from the
   * node's role breadcrumb through the tree.
   */
  buildFromTree(tabId: number, tree: APCLiteNode): void {
    this.removeTab(tabId);

    const chunks: IndexedChunk[] = [];
    this.flattenTree(tabId, tree, [], chunks);

    if (chunks.length === 0) {
      this.tabChunks.set(tabId, []);
      return;
    }

    this.index.addAll(chunks);
    this.tabChunks.set(tabId, chunks);
  }

  /**
   * Retrieves top-K chunks matching `query` within the given token budget
   * (D-15). Results are ranked by BM25 score with heading-aware field
   * boosting (headingText: 2.0×, headingPath: 1.5×). Chunks are greedily
   * taken in score-descending order until the cumulative chunkText length
   * reaches `budget` tokens (estimated at ~4 chars/token).
   */
  selectRelevant(query: string, budget: number): IndexedChunk[] {
    if (!query.trim() || budget <= 0) return [];

    const results = this.index.search(query);
    const chunks: IndexedChunk[] = [];
    const budgetChars = budget * CHARS_PER_TOKEN;
    let usedChars = 0;

    for (const result of results) {
      const chunk: IndexedChunk = {
        id: result.id as string,
        tabId: result.tabId as number,
        headingPath: (result.headingPath as string) ?? '',
        chunkText: (result.chunkText as string) ?? '',
        headingText: (result.headingText as string) ?? '',
      };

      const textLen = chunk.chunkText.length;
      if (usedChars + textLen > budgetChars) {
        // If we have no results yet, include this chunk even if it exceeds budget
        // (at least one chunk is better than none)
        if (chunks.length === 0) {
          chunks.push(chunk);
        }
        break;
      }

      chunks.push(chunk);
      usedChars += textLen;
    }

    return chunks;
  }

  /**
   * Removes all indexed chunks for the given tab and releases memory.
   * Called before re-indexing (SPA navigation) and on tab close.
   */
  removeTab(tabId: number): void {
    const chunks = this.tabChunks.get(tabId);
    if (!chunks || chunks.length === 0) {
      this.tabChunks.delete(tabId);
      return;
    }

    // Use removeAll to clean inverted index immediately (unlike discard
    // which defers cleanup to the next auto-vacuum cycle).
    this.index.removeAll(chunks);
    this.tabChunks.delete(tabId);
  }

  // ── Private helpers ──────────────────────────────────────────

  /**
   * Chunks markdown content by heading hierarchy.
   *
   * Uses a regex to detect ATX headings (`# …`, `## …`, etc.) and splits
   * content between them. Maintains a breadcrumb stack so each chunk carries
   * the full heading path (e.g. "h2 text → h3 text").
   *
   * Leading content before the first heading is assigned the special
   * "(preamble)" heading path/headingText.
   */
  private chunkMarkdown(tabId: number, markdown: string): IndexedChunk[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const chunks: IndexedChunk[] = [];
    const headings: HeadingEntry[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const matchStart = match.index;

      // Content between lastIndex and the heading start is the chunk for
      // the current breadcrumb (or preamble)
      const chunkText = markdown.slice(lastIndex, matchStart).trim();
      if (chunkText) {
        const breadcrumbArr = headings.map((h) => h.text);
        chunks.push({
          id: `${tabId}-${chunks.length}`,
          tabId,
          headingPath: breadcrumbArr.length > 0 ? breadcrumbArr.join(' → ') : '(preamble)',
          chunkText,
          headingText: headings.length > 0 ? headings[headings.length - 1].text : '(preamble)',
        });
      }

      // Update breadcrumb stack: pop headings ≥ current level, then push this one
      while (headings.length > 0 && headings[headings.length - 1].level >= level) {
        headings.pop();
      }
      const breadcrumb = headings.map((h) => h.text);
      breadcrumb.push(text);
      headings.push({ level, text, breadcrumb: [...breadcrumb] });

      lastIndex = headingRegex.lastIndex;
    }

    // Remaining content after the last heading
    const trailingText = markdown.slice(lastIndex).trim();
    if (trailingText) {
      const breadcrumbArr = headings.map((h) => h.text);
      chunks.push({
        id: `${tabId}-${chunks.length}`,
        tabId,
        headingPath: breadcrumbArr.length > 0 ? breadcrumbArr.join(' → ') : '(preamble)',
        chunkText: trailingText,
        headingText: headings.length > 0 ? headings[headings.length - 1].text : '(preamble)',
      });
    }

    // Edge case: no headings found at all — the entire content is a single preamble chunk
    if (chunks.length === 0 && markdown.trim()) {
      chunks.push({
        id: `${tabId}-0`,
        tabId,
        headingPath: '(preamble)',
        chunkText: markdown.trim(),
        headingText: '(preamble)',
      });
    }

    return chunks;
  }

  /**
   * Recursively flattens an APCLiteNode tree into `IndexedChunk` entries.
   *
   * For each node, assembles searchable text from `name`, `role`, and
   * `attributes`, and builds the `headingPath` from the node role breadcrumb
   * accumulated during tree traversal.
   */
  private flattenTree(
    tabId: number,
    node: APCLiteNode,
    roleBreadcrumb: string[],
    out: IndexedChunk[],
  ): void {
    const nodeRole = node.role ?? 'unknown';

    // Build searchable text for this node
    const textParts: string[] = [];
    if (node.name) textParts.push(node.name);
    if (node.text) textParts.push(node.text);
    if (node.semanticLabel) textParts.push(node.semanticLabel);
    // Include attribute values as searchable text
    if (node.attributes) {
      for (const val of Object.values(node.attributes)) {
        if (typeof val === 'string' && val) {
          textParts.push(val);
        }
      }
    }

    const chunkText = textParts.join(' ').trim();
    if (chunkText) {
      const currentPath = [...roleBreadcrumb, nodeRole];
      out.push({
        id: `${tabId}-${out.length}`,
        tabId,
        headingPath: currentPath.join(' → '),
        chunkText,
        headingText: nodeRole,
      });
    }

    // Recurse into children
    const nextBreadcrumb = [...roleBreadcrumb, nodeRole];
    if (node.children) {
      for (const child of node.children) {
        this.flattenTree(tabId, child, nextBreadcrumb, out);
      }
    }
  }
}

/** Module-level singleton for extension-page consumers (D-14). */
export const pageIndexBuilder = new PageIndexBuilder();
