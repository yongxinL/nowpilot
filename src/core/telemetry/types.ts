// =========================================================================
// Import shared types
// =========================================================================
import type { ModelContextTier } from '../context/contextTypes';

// =========================================================================
// 1. Severity Enum (D-30, D-31)
// =========================================================================
export enum Severity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

// =========================================================================
// 2. Trace Verbosity (D-06)
// =========================================================================
export enum TraceVerbosity {
  NORMAL = 'NORMAL',
  DIAGNOSTIC = 'DIAGNOSTIC',
}

// =========================================================================
// 3. Transaction Status
// =========================================================================
export type TransactionStatus = 'started' | 'streaming' | 'completed' | 'failed' | 'aborted';

// =========================================================================
// 4. Transaction Type
// =========================================================================
export type TransactionType = 'chat' | 'planner' | 'tool' | 'agent' | 'renderer' | 'system';

// =========================================================================
// 5. AITransaction (product spec §4.1)
// =========================================================================
export interface AITransaction {
  id: string;
  sessionId: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'fullapp';
  userTurnId: string;
  type: TransactionType;
  status: TransactionStatus;
  providerId: string;
  model: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  errorCode?: string;
  severity?: Severity;
  parentOperationId?: string;
  verbosity: TraceVerbosity;
  privacyMode: boolean;
}

// =========================================================================
// 6. PromptTrace (product spec §4.2, TELE-02)
// =========================================================================
export interface PromptTrace {
  id: string;
  operationId: string;
  promptTemplateId?: string;
  promptHash: string;
  tokenBreakdown: {
    system: number;
    memory: number;
    tools: number;
    context: number;
    history: number;
    user: number;
    output: number;
    total: number;
  };
  contextTier: ModelContextTier;
  truncated: boolean;
  minimalMode: boolean;
  cacheStats: {
    sectionsMarked: number;
    estimatedSavings: number;
    hitRate?: number;
  };
  timestamp: number;
  source: 'planner' | 'renderer';
}

// =========================================================================
// 7. ToolTrace (product spec §4.3, TELE-03)
// =========================================================================
export interface ToolTrace {
  id: string;
  operationId: string;
  parentOperationId?: string;
  toolName: string;
  source: 'built-in' | 'mcp' | 'skill';
  dangerous: boolean;
  permissionDecision: 'allowed' | 'denied' | 'allowed_once' | 'allowed_always';
  inputSchema?: string;
  outputSchema?: string;
  status: 'success' | 'failed' | 'timeout' | 'aborted' | 'denied';
  errorMessage?: string;
  durationMs: number;
  timestamp: number;
}

// =========================================================================
// 8. ProviderAttempt (D-04, D-23)
// =========================================================================
export interface ProviderAttempt {
  attemptNumber: number;
  providerId: string;
  model: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  outcome: 'success' | 'timeout' | 'error' | 'circuit_open' | 'rate_limited';
  errorCode?: string;
  circuitBreakerTriggered: boolean;
}

// =========================================================================
// 9. ProviderTrace (product spec §4.4, TELE-04)
// =========================================================================
export interface ProviderTrace {
  id: string;
  operationId: string;
  attempts: ProviderAttempt[];
  resolvedProviderId: string;
  resolvedModel: string;
  totalDurationMs: number;
  timestamp: number;
}

// =========================================================================
// 10. CacheTrace
// =========================================================================
export interface CacheTrace {
  id: string;
  operationId: string;
  event: 'hit' | 'miss' | 'invalidation' | 'key_generated';
  section?: string;
  providerId?: string;
  cacheKey?: string;
  estimatedTokenSavings?: number;
  timestamp: number;
}

// =========================================================================
// 11. MemoryTrace
// =========================================================================
export interface MemoryTrace {
  id: string;
  operationId: string;
  phase: 'assemble' | 'extract';
  conversationId: string;
  factsRetrieved?: number;
  factsExtracted?: number;
  extractionAttempt?: number;
  summarized: boolean;
  timestamp: number;
}

// =========================================================================
// 12. WriteJournalTrace
// =========================================================================
export interface WriteJournalTrace {
  id: string;
  operationId: string;
  journalId: string;
  operation: string;
  status: 'pending' | 'completed' | 'failed' | 'rolled-back';
  stepsCount: number;
  failedSteps?: number[];
  recovered: boolean;
  timestamp: number;
}

// =========================================================================
// 13. TraceEvent Union Type
// =========================================================================
export type TraceEvent =
  | { type: 'planner_call'; data: PromptTrace }
  | { type: 'provider_attempt'; data: ProviderAttempt }
  | { type: 'tool_execution'; data: ToolTrace }
  | { type: 'renderer_call'; data: PromptTrace }
  | { type: 'cache_event'; data: CacheTrace }
  | { type: 'memory_event'; data: MemoryTrace }
  | { type: 'write_journal_event'; data: WriteJournalTrace };

// =========================================================================
// 14. TraceCollector Interface (D-07)
// =========================================================================
export interface TraceCollector {
  onPlannerCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void;
  onProviderAttempt(event: Omit<ProviderAttempt, 'id'>): void;
  onToolExecution(event: Omit<ToolTrace, 'id' | 'operationId'>): void;
  onRendererCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void;
  onCacheEvent(event: Omit<CacheTrace, 'id' | 'operationId'>): void;
  onMemoryEvent(event: Omit<MemoryTrace, 'id' | 'operationId'>): void;
  onWriteJournalEvent(event: Omit<WriteJournalTrace, 'id' | 'operationId'>): void;
  getAllEvents(): TraceEvent[];
  clear(): void;
}

// =========================================================================
// 15. DefaultTraceCollector Class
// =========================================================================
export class DefaultTraceCollector implements TraceCollector {
  #events: TraceEvent[] = [];

  onPlannerCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void {
    this.#events.push({
      type: 'planner_call',
      data: {
        ...event,
        id: crypto.randomUUID(),
        operationId: '',
        tokenBreakdown: event.tokenBreakdown ?? {
          system: 0, memory: 0, tools: 0, context: 0,
          history: 0, user: 0, output: 0, total: 0,
        },
        contextTier: event.contextTier ?? 'medium',
        timestamp: event.timestamp ?? Date.now(),
      } as PromptTrace,
    });
  }

  onProviderAttempt(event: Omit<ProviderAttempt, 'id'>): void {
    this.#events.push({
      type: 'provider_attempt',
      data: { ...event, id: crypto.randomUUID() } as ProviderAttempt,
    });
  }

  onToolExecution(event: Omit<ToolTrace, 'id' | 'operationId'>): void {
    this.#events.push({
      type: 'tool_execution',
      data: {
        ...event,
        id: crypto.randomUUID(),
        operationId: '',
        timestamp: event.timestamp ?? Date.now(),
      } as ToolTrace,
    });
  }

  onRendererCall(event: Omit<PromptTrace, 'id' | 'operationId'>): void {
    this.#events.push({
      type: 'renderer_call',
      data: {
        ...event,
        id: crypto.randomUUID(),
        operationId: '',
        tokenBreakdown: event.tokenBreakdown ?? {
          system: 0, memory: 0, tools: 0, context: 0,
          history: 0, user: 0, output: 0, total: 0,
        },
        contextTier: event.contextTier ?? 'medium',
        timestamp: event.timestamp ?? Date.now(),
      } as PromptTrace,
    });
  }

  onCacheEvent(event: Omit<CacheTrace, 'id' | 'operationId'>): void {
    this.#events.push({
      type: 'cache_event',
      data: {
        ...event,
        id: crypto.randomUUID(),
        operationId: '',
        timestamp: event.timestamp ?? Date.now(),
      } as CacheTrace,
    });
  }

  onMemoryEvent(event: Omit<MemoryTrace, 'id' | 'operationId'>): void {
    this.#events.push({
      type: 'memory_event',
      data: {
        ...event,
        id: crypto.randomUUID(),
        operationId: '',
        timestamp: event.timestamp ?? Date.now(),
      } as MemoryTrace,
    });
  }

  onWriteJournalEvent(event: Omit<WriteJournalTrace, 'id' | 'operationId'>): void {
    this.#events.push({
      type: 'write_journal_event',
      data: {
        ...event,
        id: crypto.randomUUID(),
        operationId: '',
        timestamp: event.timestamp ?? Date.now(),
      } as WriteJournalTrace,
    });
  }

  getAllEvents(): TraceEvent[] {
    return [...this.#events];
  }

  clear(): void {
    this.#events = [];
  }
}

// =========================================================================
// 16. ExecutionContext Interface (D-02)
// =========================================================================
export interface ExecutionContext {
  traceCollector: TraceCollector;
  operationId: string;
  abortSignal: AbortSignal;
  verbosity: TraceVerbosity;
  privacyMode: boolean;
}

// =========================================================================
// 17. TraceTree Interface (assembled query result, D-24)
// =========================================================================
export interface TraceTree {
  transaction: AITransaction;
  promptTraces: PromptTrace[];
  toolTraces: ToolTrace[];
  providerTraces: ProviderTrace[];
  cacheTraces: CacheTrace[];
  memoryTraces: MemoryTrace[];
  writeJournalTraces: WriteJournalTrace[];
}

// =========================================================================
// 18. ExportOptions Interface (D-17)
// =========================================================================
export interface ExportOptions {
  types?: TransactionType[];
  statuses?: TransactionStatus[];
  providers?: string[];
  severities?: Severity[];
  dateRange?: { from: number; to: number };
  limit?: number;
  includedTraceTypes?: string[];
}

// =========================================================================
// 19. ExportManifest Interface (D-18)
// =========================================================================
export interface ExportManifest {
  export_version: string;
  generated_at: string;
  extension_version: string;
  transaction_count: number;
  date_range?: { from: string; to: string };
  applied_filters: {
    types?: string[];
    statuses?: string[];
    providers?: string[];
    severities?: string[];
    limit?: number;
  };
  included_trace_types: string[];
  redaction_version: string;
  trace_verbosity: string;
  privacy_mode: boolean;
}
