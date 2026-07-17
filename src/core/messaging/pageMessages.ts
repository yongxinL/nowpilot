/**
 * Message type constants and Zod schemas for page extraction communication.
 *
 * Products follow `src/core/messaging/runtimeEnvelope.ts` pattern:
 *   as-const string literal constants + Zod v4 validation schemas.
 *
 * All content-script-to-SW and panel-to-SW page-extraction messages
 * use these types for typed communication through the Background SW relay.
 *
 * ## HARD-05 Compliance
 * Zod schemas validate message payloads at the SW boundary before
 * any store writes — malformed messages are rejected with validation errors.
 */

import { z } from 'zod';

// ---- Message Type Constants ----
// Pattern: as const for type narrowing (runtimeEnvelope.ts pattern)

/** Content script → Background SW: extracted PageContext updated */
export const PAGE_CONTEXT_UPDATED = 'PAGE_CONTEXT_UPDATED' as const;

/** Panel/Agent → Background SW → Content Script: request fresh extraction */
export const GET_PAGE_CONTEXT_REQUEST = 'GET_PAGE_CONTEXT_REQUEST' as const;

// ---- Payload Schemas ----

/**
 * Zod v4 schema for PageContext payload validation at the SW boundary.
 * Matches all fields from the PageContext interface.
 */
export const pageContextPayloadSchema = z.object({
  url: z.string(),
  origin: z.string(),
  hostname: z.string(),
  title: z.string(),
  html: z.string().optional(),
  markdown: z.string().optional(),
  meta: z.record(z.string(), z.string()),
  extractedAt: z.number(),
  addonId: z.string().optional(),
  addonFields: z.record(z.string(), z.unknown()).optional(),
  selectedText: z.string().optional(),
  extractionType: z.enum(['readability', 'visible-content', 'metadata-only']),
  extractionQuality: z.enum(['article', 'generic', 'minimal']),
});

/** Type inferred from the PageContext payload schema */
export type PageContextPayload = z.infer<typeof pageContextPayloadSchema>;

/**
 * Zod v4 schema for GET_PAGE_CONTEXT_REQUEST messages.
 * Sent from the Background SW to trigger content-script re-extraction.
 */
export const getPageContextRequestSchema = z.object({
  type: z.literal(GET_PAGE_CONTEXT_REQUEST),
  timestamp: z.number().optional(),
});

/** Type inferred from the getPageContextRequest schema */
export type GetPageContextRequest = z.infer<typeof getPageContextRequestSchema>;
