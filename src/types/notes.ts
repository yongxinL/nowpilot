/**
 * Canonical Phase-8 note-type home — Appendix C.1 / §21.2
 * (PRODUCT_SPEC_v0_1.md:4720-4741), verbatim.
 *
 * This file is the SINGLE canonical declaration site for the `Note` type
 * (D-107). No parallel copy in src/core/storage — the alias target is
 * authoritative (spec 4833 canonical-home rule).
 *
 * Identity = immutable UUID `id` (WIKI-ID-01, ADR-NOTE-01). `type?` is an
 * additive OKF declaration (D-108) — NOT an identity anchor. Assumption-delta
 * (D-108) no-change decision recorded: Note identity stays the immutable UUID.
 *
 * Declared-now/populated-later fields (D-108):
 *   - summaryGeneratedAt? / tagsGeneratedAt? — staleness detection (LLM-WIKI-08)
 *   - type?: string — OKF v0.2, declaration-only in Phase 8 (no reader/writer)
 *   - categoryPath? — populated Phase 9
 */

import type { KnowledgeEdgeSource } from './harness';

/**
 * Canonical Note — §21.2 verbatim (spec 4721-4741).
 *
 * Timestamps (`created`, `updated`) are numbers (epoch ms). `links` holds
 * resolved note IDs with provenance source (WIKI-ID-02, KNW-01);
 * `unresolvedLinks` holds raw `[[Title]]` targets with no matching note
 * (WIKI-ID-03).
 */

export interface Note {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  tags: string[];
  /** Resolved note IDs with provenance source (WIKI-ID-02, KNW-01). */
  links: Array<{ noteId: string; source: KnowledgeEdgeSource }>;
  /** Raw [[Title]] targets with no match (WIKI-ID-03). */
  unresolvedLinks: string[];
  source: {
    kind: 'manual' | 'voice' | 'chat-export' | 'template' | 'page-export';
    conversationId?: string;
    templateId?: string;
  };
  aiMeta: {
    suggestedLinks: Array<{ targetId: string; confidence: number; reason: string }>;
    concepts: string[];
    lastWikiRunAt?: number;
  };
  summary?: string;
  /** Declared Phase 8, populated Phase 9 (D-108). */
  categoryPath?: string;
  /** LLM-WIKI-08 staleness detection — declared Phase 8, populated Phase 9. */
  summaryGeneratedAt?: number;
  /** LLM-WIKI-08 staleness detection — declared Phase 8, populated Phase 9. */
  tagsGeneratedAt?: number;
  /**
   * OKF v0.2 note type — default 'Note'. Declaration-only in Phase 8 (D-108):
   * no reader/writer consumes it, no serialization, no migration.
   */
  type?: string;
  version: number;
}

/** OKF default note type (spec 4743-4762). Declared for Phase 9. */
export const OKF_NOTE_DEFAULT_TYPE = 'Note';

/**
 * OKF note frontmatter (spec 4743-4762, SYNC-04). Declared for Phase 9 — the
 * serialization shape for .md sync (OKF-WIKI-04).
 *
 * Canonical field set per spec §27.3 SYNC-04 (spec 3830-3863):
 * type/title/description?/id/created/updated/tags?/categoryPath?/generated/status.
 */
export interface OkfNoteFrontmatter {
  type: string;
  title: string;
  description?: string;
  id: string;
  created: number;
  updated: number;
  tags?: string[];
  categoryPath?: string;
  generated: { by: string; at: string };
  status: 'draft' | 'stable';
}

/** Canonical alias (SYNC-04 / OKF-WIKI-03). */
export type OkfFrontmatter = OkfNoteFrontmatter;

/**
 * LLM-WIKI-11 suggestion-gating threshold — suggested items below this
 * confidence are silently discarded (gateSuggestions).
 */
export const NOTE_SUGGESTION_DISPLAY_THRESHOLD = 0.60;

/** LLM-WIKI-11: maximum tags surfaced per save (descending confidence). */
export const NOTE_SUGGESTION_MAX_TAGS_PER_SAVE = 5;

/** LLM-WIKI-11: maximum memory facts surfaced per save (descending confidence). */
export const NOTE_SUGGESTION_MAX_FACTS_PER_SAVE = 3;
