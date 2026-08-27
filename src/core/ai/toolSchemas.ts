// D-46 — declare-now/populate-later tool contract (03-PATTERNS.md:256-264).
//
// Mirrors src/types/storage.ts's full-union-declare pattern: the full
// ToolDefinition/ToolCapabilityManifest shape (TOL-01) is declared NOW so
// owning phases populate it later — Phase 3 registers ZERO tools (real tools
// arrive with their owning phases; no fake tools, no governance surface).
//
// RegisteredToolNameSchema is the closed-enum generation contract consumed by
// ExecutorService (§1.2: "narrow toolName to a closed z.enum derived from the
// currently registered tools"). With zero tools it uses the 03-01 zero-tool
// specialization — never z.enum([]), never an unrestricted toolName string.
import { z } from 'zod';

/** TOL-01 risk classification — drives the TOL-02 permission policy. */
export type ToolRisk = 'safe' | 'read' | 'write' | 'dangerous';

/** A registered tool — the D-46 declaration shape (populated from Phase 4 on). */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  /** Input contract validated at request time (§1.2). */
  inputSchema: z.ZodType;
  /** Output contract validated on return (§1.2). */
  outputSchema?: z.ZodType;
  /** TOL-01 risk class. */
  risk: ToolRisk;
  /** TOL-01 side-effect disclosure (surfaced to the permission prompt). */
  sideEffects: string[];
  /** TOL-02: true → requires an explicit user grant before running. */
  requiresPermission: boolean;
}

/** TOL-01 ToolCapabilityManifest (P0) — category/risk/side-effect/perms/scopes/timeout/cost/idempotency/verifier/hashes. */
export interface ToolCapabilityManifest {
  toolName: string;
  category: string;
  risk: ToolRisk;
  sideEffects: string[];
  permissions: string[];
  scopes: string[];
  timeoutMs: number;
  cost: 'free' | 'low' | 'high';
  idempotent: boolean;
  /** TOL-03 postcondition verification — asserts the result before it reaches the UI. */
  verifier?: (result: unknown) => boolean;
  /** TOL-01 schema hashes — detect contract drift across versions. */
  inputSchemaHash: string;
  outputSchemaHash?: string;
}

/**
 * Closed-enum generation contract — z.enum over the registered tool names.
 *
 * Zero-tool specialization (03-01): an empty registry yields `z.never()` —
 * every toolName is rejected at the schema boundary (never z.enum([]),
 * never an unrestricted string). A non-empty registry closes the enum over
 * the registered names so a tool cannot be spoofed into existence (T-3-10).
 */
export const RegisteredToolNameSchema = (
  tools: readonly ToolDefinition[],
): z.ZodType<string> => {
  if (tools.length === 0) return z.never();
  return z.enum(tools.map((t) => t.name) as [string, ...string[]]);
};

/** Declare-now registry (Registry.ts pattern) — starts EMPTY in Phase 3 (D-46). */
const registeredTools = new Map<string, ToolDefinition>();

export const ToolRegistry = {
  register(tool: ToolDefinition): void {
    registeredTools.set(tool.id, tool);
  },
  unregister(id: string): void {
    registeredTools.delete(id);
  },
  get(id: string): ToolDefinition | undefined {
    return registeredTools.get(id);
  },
  getAll(): ToolDefinition[] {
    return Array.from(registeredTools.values());
  },
};