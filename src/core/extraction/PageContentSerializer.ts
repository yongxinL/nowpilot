import { z } from 'zod';
import type { SerializedPage } from '../content/DomSerializer';
import { APCLiteNodeSchema } from './apcLite.types';
import type { BaseMetadata, ExtractionMode, PageContext, StrategyResult } from './types';

/**
 * Transforms a StrategyResult into a validated PageContext (D-12).
 *
 * Dispatches on mode to build the correct discriminated-union variant, then
 * validates the result against the PageContext Zod schema at the boundary
 * (PlannerService pattern) — schema violations are programming errors and
 * throw; operational extraction failures never reach this module.
 */

const baseMetadataSchema = z.strictObject({
  url: z.string(),
  title: z.string(),
  capturedAt: z.number(),
  size: z.number(),
  source: z.enum(['defuddle', 'readability', 'apc-lite']),
  extractionLevel: z.enum(['full', 'truncated']),
  truncated: z.boolean(),
  compressionApplied: z.literal('topk').optional(),
  author: z.string().optional(),
  publishDate: z.string().optional(),
  language: z.string().optional(),
  description: z.string().optional(),
  siteName: z.string().optional(),
});

const defaultPageContextSchema = z.strictObject({
  mode: z.literal('default'),
  markdown: z.string(),
  ...baseMetadataSchema.shape,
});

const actionablePageContextSchema = z.strictObject({
  mode: z.literal('actionable'),
  apcLiteTree: APCLiteNodeSchema,
  ...baseMetadataSchema.shape,
});

export const PageContextSchema = z.discriminatedUnion('mode', [
  defaultPageContextSchema,
  actionablePageContextSchema,
]);

/** Populates BaseMetadata from a serialized capture and strategy result. */
export function buildMetadata(serialized: SerializedPage, result: StrategyResult): BaseMetadata {
  const truncated = serialized.truncated || result.truncated;
  const metadata: BaseMetadata = {
    url: serialized.url,
    title: serialized.title,
    capturedAt: serialized.capturedAt,
    size: serialized.size,
    source: result.source,
    extractionLevel: truncated ? 'truncated' : 'full',
    truncated,
  };
  if (result.meta?.author) metadata.author = result.meta.author;
  if (result.meta?.publishDate) metadata.publishDate = result.meta.publishDate;
  if (result.meta?.language) metadata.language = result.meta.language;
  if (result.meta?.description) metadata.description = result.meta.description;
  if (result.meta?.siteName) metadata.siteName = result.meta.siteName;
  return metadata;
}

/**
 * Builds the correct PageContext variant for the given mode and validates it
 * against the boundary schema.
 *
 * @throws Error when the built PageContext fails schema validation or when
 *   actionable mode is requested without an apcLiteTree root.
 */
export function buildPageContext(
  mode: ExtractionMode,
  serialized: SerializedPage,
  result: StrategyResult,
): PageContext {
  const metadata = buildMetadata(serialized, result);

  let pageContext: PageContext;
  if (mode === 'default') {
    pageContext = { mode: 'default', markdown: result.markdown ?? '', ...metadata };
  } else {
    if (!result.root) {
      throw new Error('buildPageContext: actionable mode requires an apcLiteTree root');
    }
    pageContext = { mode: 'actionable', apcLiteTree: result.root, ...metadata };
  }

  const validation = PageContextSchema.safeParse(pageContext);
  if (!validation.success) {
    throw new Error(
      `buildPageContext: PageContext schema validation failed: ${JSON.stringify(
        validation.error.issues,
      )}`,
    );
  }

  return pageContext;
}
