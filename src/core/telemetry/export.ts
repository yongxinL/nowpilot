// =========================================================================
// Debug bundle export — single-operation JSON and filtered multi-operation
// ZIP export with manifest.json.  All data passes through TraceRedactor
// before serialization per D-08.
// =========================================================================

import JSZip from 'jszip';
import { aiTransactionLogDB } from '../storage/stores/AITransactionLogDB';
import { traceRedactor } from './TraceRedactor';
import type { ExportOptions, ExportManifest, TraceTree } from './types';

// =========================================================================
// Helper: strip content fields for Privacy Mode  (D-38)
// Privacy Mode forces metadata-only — removes prompt content, tool I/O,
// and memory content fields entirely (not just redacted).
// =========================================================================
function stripContentFields(tree: TraceTree): TraceTree {
  return {
    ...tree,
    toolTraces: tree.toolTraces.map((tt) => ({
      ...tt,
      inputSchema: undefined,
      outputSchema: undefined,
    })),
    // PromptTrace and MemoryTrace in the current shape are metadata-only
    // (hashes, token counts, sizes) — no raw content fields to strip.
    // If content-bearing fields are added later, extend this function.
  };
}

// =========================================================================
// 1. exportSingleTrace  (D-19)
// Returns a JSON Blob with the complete TraceTree for one operation.
// =========================================================================
export async function exportSingleTrace(
  operationId: string,
  privacyMode?: boolean,
): Promise<Blob | undefined> {
  const tree = await aiTransactionLogDB.getTraceTree(operationId);
  if (!tree) return undefined;

  let exportData = tree;
  if (privacyMode) {
    exportData = stripContentFields(tree);
  }

  const redacted = traceRedactor.redactObject(
    exportData as unknown as Record<string, unknown>,
  );

  return new Blob([JSON.stringify(redacted, null, 2)], {
    type: 'application/json',
  });
}

// =========================================================================
// 2. exportTraces  (D-17)
// Returns a ZIP Blob containing per-transaction JSON files and a
// manifest.json with all required metadata fields.
// =========================================================================
export async function exportTraces(
  options: ExportOptions,
  privacyMode?: boolean,
): Promise<Blob> {
  const transactions = await aiTransactionLogDB.queryTransactions({
    types: options.types as string[],
    statuses: options.statuses as string[],
    providers: options.providers as string[],
    severities: options.severities as string[],
    dateRange: options.dateRange
      ? ([options.dateRange.from, options.dateRange.to] as [number, number])
      : undefined,
    limit: options.limit,
  });

  const zip = new JSZip();
  const trees: TraceTree[] = [];

  for (const tx of transactions) {
    const tree = await aiTransactionLogDB.getTraceTree(tx.id);
    if (tree) {
      trees.push(tree);
    }
  }

  for (const tree of trees) {
    let exportData: TraceTree = tree;
    if (privacyMode) {
      exportData = stripContentFields(tree);
    }
    const redacted = traceRedactor.redactObject(
      exportData as unknown as Record<string, unknown>,
    );
    zip.file(
      `transaction_${tree.transaction.id}.json`,
      JSON.stringify(redacted, null, 2),
    );
  }

  const manifest = buildManifest(options, trees.length, !!privacyMode);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// =========================================================================
// 3. buildManifest  (D-18)
// Constructs the metadata manifest object per the D-18 format spec.
// =========================================================================
export function buildManifest(
  options: ExportOptions,
  count: number,
  privacyMode: boolean,
): ExportManifest {
  let extensionVersion = '0.0.0';
  try {
    extensionVersion = chrome.runtime.getManifest().version;
  } catch {
    // chrome.runtime unavailable in test environments
  }

  return {
    export_version: '1.0',
    generated_at: new Date().toISOString(),
    extension_version: extensionVersion,
    transaction_count: count,
    date_range: options.dateRange
      ? {
          from: new Date(options.dateRange.from).toISOString(),
          to: new Date(options.dateRange.to).toISOString(),
        }
      : undefined,
    applied_filters: {
      types: options.types,
      statuses: options.statuses,
      providers: options.providers,
      severities: options.severities,
      limit: options.limit,
    },
    included_trace_types: options.includedTraceTypes ?? [
      'AITransactions',
      'PromptTraces',
      'ToolTraces',
      'ProviderTraces',
      'CacheTraces',
      'MemoryTraces',
      'WriteJournalTraces',
    ],
    redaction_version: '1.0',
    trace_verbosity: 'NORMAL',
    privacy_mode: privacyMode,
  };
}

// =========================================================================
// 4. downloadBlob
// Triggers a browser file download using URL.createObjectURL.
// =========================================================================
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
