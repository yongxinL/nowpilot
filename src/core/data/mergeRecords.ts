/**
 * Deterministic timestamp-based merge (latest-wins) for data import.
 *
 * Each record has a single source of truth — the latest updatedAt.
 * Conflict-free by design: newer records overwrite older ones;
 * records with no match are inserted; equal timestamps keep the existing.
 */

export interface MergeableRecord {
  id: string;
  updatedAt: number;
  [key: string]: unknown;
}

export interface MergeSummary {
  updated: number;
  inserted: number;
  unchanged: number;
}

/**
 * Merge incoming records into existing records using updatedAt comparison.
 *
 * - incoming.updatedAt > existing.updatedAt → existing is overwritten (updated)
 * - incoming.updatedAt <= existing.updatedAt → existing is kept (unchanged)
 * - incoming.id not in existing → added as new (inserted)
 *
 * @param existing - Current records in storage
 * @param incoming - Records from import file
 * @returns Merged array and summary counts
 */
export function mergeRecords<T extends MergeableRecord>(
  existing: T[],
  incoming: T[],
): { merged: T[]; summary: MergeSummary } {
  const existingMap = new Map(existing.map((r) => [r.id, r]));
  const matchedExistingIds = new Set<string>();
  let updated = 0;
  let inserted = 0;
  let unchanged = 0;

  for (const record of incoming) {
    const current = existingMap.get(record.id);
    if (!current) {
      // New record — insert
      existingMap.set(record.id, record);
      inserted++;
    } else if (record.updatedAt > current.updatedAt) {
      // Incoming is newer — overwrite
      existingMap.set(record.id, record);
      updated++;
      matchedExistingIds.add(record.id);
    } else {
      // Existing is same age or newer — keep
      unchanged++;
      matchedExistingIds.add(record.id);
    }
  }

  // Existing records that were never matched by any incoming record are unchanged
  unchanged += existing.length - matchedExistingIds.size;

  return {
    merged: Array.from(existingMap.values()),
    summary: { updated, inserted, unchanged },
  };
}
