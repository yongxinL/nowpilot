// src/core/context/ContextProvenanceManifest.ts — Source: PRODUCT_SPEC §2.6
// "Context Provenance Manifest" (lines 516-534, verbatim) / §18 Phase-4
// create-list (line 2673). P-3b: canonical home for ContextProvenanceManifest.
// R-1: single declaration — src/core/ai/types.ts imports (never re-declares) it;
// CTX-03 (Phase 4b) extends this shape into a context receipt.

export interface ContextProvenanceManifest {
  sections: Array<{
    // 03a-01: mirrors PromptSection['kind'] (src/core/ai/types.ts) — gained
    // 'tool_result' with the F-4 replan-feedback section kind (D-3a-11) so the
    // manifest stays a faithful provenance record of every emitted section.
    kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input' | 'tool_result';
    sourceId: string;
    tokens: number;
    truncated: boolean;
    compressionApplied?: 'summarise' | 'structural' | 'topk';
  }>;
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string; // NEW in v0.1
  activeSurface: 'sidepanel' | 'standalone'; // NEW in v0.1
}
