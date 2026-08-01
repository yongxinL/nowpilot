import { z } from 'zod';
import type {
  ContextItem,
  ContextOptimizerInput,
  ContextProvenanceEntry,
  InstructionAuthority,
  ModelContextTier,
  OptimizedContext,
  PromptSection,
} from '../ai/types';
import { PipelineError } from '../ai/PipelineError';
import { providerRouter } from '../ai/ProviderRouter';
import { hashStableSections } from '../ai/PromptCacheAdapter';
import { classifyModelContext } from './ModelContextTier';
import { tokenBudget } from './TokenBudget';
import { contextCompressor } from './ContextCompressor';
import { ContextItemSchema, unwrapToPromptSections } from './ContextItem';
import { contextTrustPolicy } from './ContextTrustPolicy';
import {
  createProvenanceManifest,
  markCompression,
  recordSection,
  recordSectionWithReceipt,
} from './ContextProvenanceManifest';

const ToolSchemaInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  jsonSchema: z.unknown().optional(),
  dangerous: z.boolean().optional(),
  source: z.string().optional(),
});

/**
 * Input validation per T-04-02/T-04-04: modelContextWindow must be a
 * positive integer, userInput is capped at 100K chars (~25K tokens) to
 * prevent memory exhaustion, and identity fields must be non-empty.
 */
const ContextOptimizerInputSchema = z.object({
  operationId: z.string().min(1),
  model: z.string().min(1),
  modelContextWindow: z.number().int().positive(),
  userInput: z.string().max(100000),
  conversationId: z.string().min(1),
  workspaceId: z.string().min(1),
  activeSurface: z.enum(['sidepanel', 'full-app']),
  pageContext: z.unknown().optional(),
  selectedToolSchemas: z.array(ToolSchemaInfoSchema),
  memoryHints: z.array(z.unknown()),
  preferences: z
    .object({
      responseStyle: z.string().optional(),
      preferredLanguage: z.string().optional(),
      preferStructuredOutput: z.boolean().optional(),
      allowCloudFallbackFromLocal: z.boolean().optional(),
      defaultProviderId: z.string().optional(),
      toolAutonomy: z.string().optional(),
      defaultSurface: z.enum(['sidepanel', 'full-app']).optional(),
      themeMode: z.string().optional(),
      personaId: z.string().optional(),
      personaOverrides: z.unknown().optional(),
    })
    .passthrough(),
});

const SYSTEM_PROMPT_TEXT =
  'You are a helpful AI assistant. You have access to tools and context to help the user.';

/**
 * Stable-prefix contract (CTX-T04, D-04): the deterministic FNV-1a hash of
 * ALL stable sections (persona, system rules, preferences, sorted tool
 * schemas) plus one per-section diagnostic hash per stable section.
 *
 * `combinedHash` is the authoritative guard — byte-level, so any
 * whitespace, ordering, or content change in a stable section changes it.
 * `perSectionHashes` identify exactly which section drifted when the
 * combined hash changes. Volatile sections (user input, memory, page
 * content, tool results, timestamps, scores, lifecycle fields) are EXCLUDED
 * — only stable:true sections participate.
 */
export interface StablePrefixContract {
  combinedHash: string;
  perSectionHashes: Array<{ sourceId: string; hash: string }>;
  stableSectionCount: number;
}

/**
 * First-class pipeline stage (D-01): owns tier classification, budget
 * allocation, section assembly, provenance tracking, the initial budget
 * check, degradation (04-02), and prompt cache metadata (04-03). Runs
 * once per turn (D-02).
 */
export class ContextOptimizer {
  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
    const validation = ContextOptimizerInputSchema.safeParse(input);
    if (!validation.success) {
      throw new PipelineError('SCHEMA_INVALID', 'ContextOptimizer input validation failed.', {
        issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const signal = input.abortSignal;
    if (signal?.aborted) {
      throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
        stage: 'optimize-entry',
      });
    }

    const tier = classifyModelContext(input.modelContextWindow);
    const budget = tokenBudget.allocateBudget(tier, input.modelContextWindow);
    const { inputBudget, outputBudget } = budget;

    const assembledSections: PromptSection[] = [
      this.buildSystemSection(),
      this.buildToolSchemasSection(input.selectedToolSchemas),
      this.buildPreferencesSection(input.preferences),
      this.buildMemorySection(input.memoryHints),
      this.buildPageContextSection(input.pageContext),
      this.buildTaskSection(),
      this.buildUserInputSection(input.userInput),
    ];

    // Step 3.5: degradation pipeline (D-06, D-07) — when the assembled
    // context exceeds the input budget, ContextCompressor applies the 7
    // ordered degradation steps (plus AI summarization overflow via
    // ProviderRouter.getCompressionModel per D-08), then the budget is
    // re-checked. This replaces the Plan 04-01 placeholder user-input
    // trim: degradation is the canonical over-budget path.
    const { sections, stepsApplied } = await this.runDegradation(
      assembledSections,
      inputBudget,
      tier,
      signal,
    );

    // Minimal mode is mandatory for tiny models (§2.5) and also activates
    // when the 'minimal-mode' degradation step runs on any tier.
    const minimalMode = tier === 'tiny' || stepsApplied.includes('minimal-mode');

    const manifest = createProvenanceManifest(input.workspaceId, input.activeSurface);
    for (const section of sections) {
      recordSection(manifest, section);
    }
    manifest.minimalMode = minimalMode;

    // Record degradation decisions in provenance (D-07): each section that
    // changed during compression carries a compressionApplied value derived
    // from the steps that ran. Sections dropped entirely (e.g. debug or
    // page context) are simply absent from the manifest.
    if (stepsApplied.length > 0) {
      for (const section of sections) {
        const method = this.deriveCompressionMethod(section, stepsApplied, assembledSections);
        if (method) markCompression(manifest, section.sourceId, method);
      }
    }

    // Step 6: prepare prompt cache metadata (final stage, D-13). The
    // provider is not known here (selection happens later in
    // AgentOrchestrator), so optimize() computes the provider-agnostic
    // cache metadata: the FNV-1a cache key hash of the stable sections
    // (D-16) and the stable section count. The per-provider cache hint
    // transformation runs via PromptCacheManager.prepareCacheHints() after
    // provider selection; cacheKeyHash is stable across providers so
    // cross-turn cache-hit detection is preserved (D-16).
    const stablePrefix = this.computeStablePrefix(sections);
    const cacheMetadata = {
      cacheKeyHash: stablePrefix.combinedHash,
      stableSectionCount: stablePrefix.stableSectionCount,
      perSectionHashes: stablePrefix.perSectionHashes,
    };

    return {
      tier,
      inputBudget,
      outputBudget,
      sections,
      provenance: manifest,
      minimalMode,
      cacheMetadata,
    };
  }

  /**
   * Phase 4b trust-aware entry point (D-01/D-02/D-06, CTX-T01/CTX-T02):
   * accepts ContextItem[] produced by source adapters instead of raw
   * ContextOptimizerInput fields. Every item passes the ContextItemSchema
   * gate (D-09 secret rejection), is validated against the
   * ContextTrustPolicy verdict (D-06 — trust is never self-assigned), data
   * sections are wrapped in <data-source> structural delimiters (D-02),
   * sections are re-sorted system → user → data, and the final prompt is
   * unwrapped to plain PromptSection[] before the unchanged degradation
   * pipeline. Provenance entries carry full receipt metadata (D-03,
   * CTX-T03) via recordSectionWithReceipt().
   *
   * The existing optimize() is untouched — raw ContextOptimizerInput
   * continues to work until all source adapters migrate to ContextItem[]
   * (Phase 5 and beyond).
   */
  async optimizeFromItems(
    items: ContextItem[],
    input: ContextOptimizerInput,
  ): Promise<OptimizedContext> {
    const validation = ContextOptimizerInputSchema.safeParse(input);
    if (!validation.success) {
      throw new PipelineError('SCHEMA_INVALID', 'ContextOptimizer input validation failed.', {
        issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const signal = input.abortSignal;
    if (signal?.aborted) {
      throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
        stage: 'optimizeFromItems-entry',
      });
    }

    const tier = classifyModelContext(input.modelContextWindow);
    const budget = tokenBudget.allocateBudget(tier, input.modelContextWindow);
    const { inputBudget, outputBudget } = budget;

    // 1. Schema gate + trust validation per item (D-06/D-09). The policy
    //    verdict is the authority: self-assigned trust/sensitivity/authority
    //    is rejected, and the verdict overrides the item's metadata.
    //    Data-authority items are wrapped in structural delimiters BEFORE
    //    token estimation (D-02) with a deterministic per-source index.
    const dataIndexBySource = new Map<string, number>();
    const processedItems: ContextItem[] = items.map((item) => {
      const schemaCheck = ContextItemSchema.safeParse(item);
      if (!schemaCheck.success) {
        throw new PipelineError('SCHEMA_INVALID', 'ContextItem validation failed.', {
          sourceId: item.sourceId,
          issues: schemaCheck.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const policy = contextTrustPolicy.assess(item.sourceId, item.kind);
      if (!contextTrustPolicy.validate(item, policy)) {
        throw new PipelineError(
          'SCHEMA_INVALID',
          'ContextItem trust metadata does not match ContextTrustPolicy.',
          { sourceId: item.sourceId, itemTrust: item.trust, policyTrust: policy.trust },
        );
      }

      const base: ContextItem = {
        ...item,
        trust: policy.trust,
        sensitivity: policy.sensitivity,
        instructionAuthority: policy.instructionAuthority,
      };

      if (policy.instructionAuthority === 'data') {
        const index = dataIndexBySource.get(base.sourceId) ?? 0;
        dataIndexBySource.set(base.sourceId, index + 1);
        const wrappedText = `<data-source id="${base.sourceId}.${index}" kind="${base.kind}">\n${base.text}\n</data-source>`;
        // Delimiter wrapping invalidates cache stability regardless of the
        // original flag (D-02).
        return {
          ...base,
          text: wrappedText,
          tokens: tokenBudget.estimateTokens(wrappedText),
          stable: false,
        };
      }
      return base;
    });

    // 2. Product ordering policy (D-02, RESEARCH Pitfall 3): system sections
    //    first, then user, then data — data is never interleaved between
    //    instructions. Within a group the order is deterministic: kind
    //    order, then sourceId alphabetically (cache-stability contract).
    const authorityRank: Record<InstructionAuthority, number> = { system: 0, user: 1, data: 2 };
    const sectionKindOrder: readonly PromptSection['kind'][] = [
      'system',
      'tool_schemas',
      'preferences',
      'memory',
      'context',
      'task',
      'user_input',
    ];
    processedItems.sort((a, b) => {
      const authorityDiff = authorityRank[a.instructionAuthority] - authorityRank[b.instructionAuthority];
      if (authorityDiff !== 0) return authorityDiff;
      const kindDiff =
        sectionKindOrder.indexOf(a.kind) - sectionKindOrder.indexOf(b.kind);
      if (kindDiff !== 0) return kindDiff;
      return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
    });

    // 3. Strip metadata — the assembly contract (D-01). Metadata never
    //    reaches the provider-facing PromptSection[].
    const assembledSections = unwrapToPromptSections(processedItems);

    // 4. Unchanged degradation pipeline on the post-wrap sections (D-07).
    const { sections, stepsApplied } = await this.runDegradation(
      assembledSections,
      inputBudget,
      tier,
      signal,
    );

    const minimalMode = tier === 'tiny' || stepsApplied.includes('minimal-mode');

    // 5. Receipts (D-03, CTX-T03): one receipt per ORIGINAL ContextItem.
    //    originalTokens come from the source item, finalTokens from the
    //    post-compression section. Items dropped by degradation are still
    //    recorded — included: false with an omission reason — so the
    //    existence and size of omitted sources is visible to the user.
    const manifest = createProvenanceManifest(input.workspaceId, input.activeSurface);
    const claimed = new Set<number>();
    for (const original of items) {
      let match: PromptSection | undefined;
      for (let i = 0; i < sections.length; i++) {
        if (
          !claimed.has(i) &&
          sections[i].sourceId === original.sourceId &&
          sections[i].kind === original.kind
        ) {
          match = sections[i];
          claimed.add(i);
          break;
        }
      }
      if (match) {
        recordSectionWithReceipt(manifest, match, original.tokens, match.stable);
      } else {
        manifest.sections.push({
          kind: original.kind,
          sourceId: original.sourceId,
          tokens: 0,
          truncated: false,
          originalTokens: original.tokens,
          finalTokens: 0,
          included: false,
          omissionReason: 'budget',
          cacheEligible: false,
        });
      }
    }
    manifest.minimalMode = minimalMode;

    if (stepsApplied.length > 0) {
      for (const section of sections) {
        const method = this.deriveCompressionMethod(section, stepsApplied, assembledSections);
        if (method) markCompression(manifest, section.sourceId, method);
      }
    }

    // 6. Stable-prefix contract (CTX-T04, D-04): the final step computes
    //    the combined FNV-1a hash of all stable sections plus per-section
    //    diagnostic hashes. combinedHash === cacheKeyHash (same FNV-1a over
    //    the same stable text); perSectionHashes identify which section
    //    drifted when the combined hash changes. Volatile sections are
    //    excluded by computeStablePrefix().
    const stablePrefix = this.computeStablePrefix(sections);
    const cacheMetadata = {
      cacheKeyHash: stablePrefix.combinedHash,
      stableSectionCount: stablePrefix.stableSectionCount,
      perSectionHashes: stablePrefix.perSectionHashes,
    };

    return {
      tier,
      inputBudget,
      outputBudget,
      sections,
      provenance: manifest,
      minimalMode,
      cacheMetadata,
    };
  }

  /**
   * Stable-prefix contract (CTX-T04, D-04): computes the combined FNV-1a
   * hash of ALL stable sections (concatenated with '\u0000' separators) and
   * one per-section FNV-1a hash per stable section for drift diagnostics.
   * Volatile sections (user_input, memory, context, task, timestamps,
   * scores, lifecycle fields) are EXCLUDED — only stable:true sections
   * participate.
   *
   * Reuses `hashStableSections()` from PromptCacheAdapter — FNV-1a is never
   * reimplemented. The hash input is the exact final bytes of each stable
   * section's text (canonical separators, whitespace, and sorted tool
   * schemas included), so any byte-level drift changes the hash and is
   * caught by the snapshot tests guarding this contract.
   */
  computeStablePrefix(sections: PromptSection[]): StablePrefixContract {
    const stableSections = sections.filter((s) => s.stable);
    return {
      combinedHash: hashStableSections(stableSections),
      perSectionHashes: stableSections.map((s) => ({
        sourceId: s.sourceId,
        hash: hashStableSections([s]),
      })),
      stableSectionCount: stableSections.length,
    };
  }

  /**
   * Shared degradation path (D-06/D-07): when the assembled sections exceed
   * the input budget, ContextCompressor applies the 7 ordered steps (plus
   * AI summarization overflow via ProviderRouter.getCompressionModel per
   * D-08), then the budget is re-checked. CONTEXT_TOO_LARGE is thrown only
   * after ALL steps fail to satisfy the budget. Abort signals are honored
   * before and after compression.
   */
  private async runDegradation(
    sections: PromptSection[],
    inputBudget: number,
    tier: ModelContextTier,
    signal?: AbortSignal,
  ): Promise<{ sections: PromptSection[]; stepsApplied: string[] }> {
    const totalBeforeDegradation = sections.reduce((sum, s) => sum + s.tokens, 0);
    if (totalBeforeDegradation > inputBudget) {
      if (signal?.aborted) {
        throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
          stage: 'before-compression',
        });
      }
      const result = await contextCompressor.compress(
        sections,
        inputBudget,
        tier,
        () => providerRouter.getCompressionModel(),
        signal,
      );
      if (signal?.aborted) {
        throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
          stage: 'after-compression',
        });
      }
      const totalAfterDegradation = result.sections.reduce((sum, s) => sum + s.tokens, 0);
      if (totalAfterDegradation > inputBudget) {
        throw new PipelineError(
          'CONTEXT_TOO_LARGE',
          `Context exceeds the available token budget (${inputBudget} tokens) after all degradation steps. ` +
            `Current context: ${totalAfterDegradation} tokens. Try simplifying your request or reducing context.`,
          { tier, inputBudget, totalTokens: totalAfterDegradation, stepsApplied: result.stepsApplied },
        );
      }
      return result;
    }
    return { sections, stepsApplied: [] };
  }

  /**
   * Map a degraded section to its provenance compression method. The
   * method is derived from the steps that ran (D-07): 'summarise-history'
   * → 'summarise', 'compress-page' → 'structural', 'reduce-memory' →
   * 'topk'. Minimal mode applies the §2.5 caps across kinds.
   */
  private deriveCompressionMethod(
    section: PromptSection,
    stepsApplied: string[],
    assembledSections: PromptSection[],
  ): ContextProvenanceEntry['compressionApplied'] | undefined {
    const original = assembledSections.find((s) => s.sourceId === section.sourceId);
    const unchanged =
      original !== undefined && original.text === section.text && original.tokens === section.tokens;
    if (unchanged) return undefined;

    const minimal = stepsApplied.includes('minimal-mode');
    if (section.kind === 'system') return minimal ? 'summarise' : undefined;
    if (section.kind === 'tool_schemas') {
      return stepsApplied.includes('trim-tools') || minimal ? 'structural' : undefined;
    }
    if (section.kind === 'memory') {
      return stepsApplied.includes('reduce-memory') || minimal ? 'topk' : undefined;
    }
    if (section.kind === 'context') {
      if (
        section.sourceId.startsWith('history.') &&
        (stepsApplied.includes('summarise-history') || minimal)
      ) {
        return 'summarise';
      }
      if (stepsApplied.includes('compress-page') || minimal) return 'structural';
    }
    return undefined;
  }

  private buildSystemSection(): PromptSection {
    return {
      kind: 'system',
      text: SYSTEM_PROMPT_TEXT,
      tokens: tokenBudget.estimateTokens(SYSTEM_PROMPT_TEXT),
      stable: true,
      sourceId: 'core.instructions.system',
    };
  }

  private buildToolSchemasSection(
    selectedToolSchemas: ContextOptimizerInput['selectedToolSchemas'],
  ): PromptSection {
    const text = JSON.stringify(
      selectedToolSchemas.map(({ name, description }) => ({ name, description })),
    );
    return {
      kind: 'tool_schemas',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: true,
      sourceId: 'tools.builtin.selected',
    };
  }

  private buildPreferencesSection(
    preferences: ContextOptimizerInput['preferences'],
  ): PromptSection {
    const text = JSON.stringify(preferences);
    return {
      kind: 'preferences',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: true,
      sourceId: 'core.preferences.user',
    };
  }

  private buildMemorySection(memoryHints: ContextOptimizerInput['memoryHints']): PromptSection {
    const text = memoryHints.length > 0 ? JSON.stringify(memoryHints) : '';
    return {
      kind: 'memory',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: false,
      sourceId: 'memory.user.facts',
    };
  }

  private buildPageContextSection(pageContext: ContextOptimizerInput['pageContext']): PromptSection {
    const text = pageContext !== undefined ? JSON.stringify(pageContext) : '';
    return {
      kind: 'context',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: false,
      sourceId: 'context.page.current',
    };
  }

  private buildTaskSection(): PromptSection {
    return {
      kind: 'task',
      text: '',
      tokens: 0,
      stable: false,
      sourceId: 'core.task.placeholder',
    };
  }

  private buildUserInputSection(userInput: string): PromptSection {
    return {
      kind: 'user_input',
      text: userInput,
      tokens: tokenBudget.estimateTokens(userInput),
      stable: false,
      sourceId: 'interaction.user.current-turn',
    };
  }
}

export const contextOptimizer = new ContextOptimizer();
