/**
 * MemoryRecord governance — deterministic conflict resolution (D-127, MEM-03).
 *
 * Pure functions over MemoryRecord: conflict detection by content+tag key,
 * deterministic precedence resolution (correction > verified > prior > inference),
 * and revision-chain audit trail. No LLM — the precedence chain is pure logic.
 */

import type { MemoryRecord } from '../../types/harness';

/**
 * MEM-03: deterministic conflict-precedence chain (D-127).
 * Lower index = higher precedence.
 */
export const CONFLICT_PRECEDENCE: readonly string[] = [
  'correction',
  'verified',
  'prior',
  'inference',
] as const;

/** Map a record's source.kind to a precedence category (D-127 step 1). */
export function sourceKindToPrecedence(record: MemoryRecord): string {
  switch (record.source.kind) {
    case 'manual':
      // manual + has prior revisions = correction; otherwise verified
      return record.revisionChain && record.revisionChain.length > 0
        ? 'correction'
        : 'verified';
    case 'extracted':
      return 'prior';
    case 'imported':
      return 'inference';
    default:
      return 'inference';
  }
}

/** Look up the precedence rank (lower = wins). */
function precedenceRank(record: MemoryRecord): number {
  const cat = sourceKindToPrecedence(record);
  const idx = CONFLICT_PRECEDENCE.indexOf(cat);
  return idx === -1 ? CONFLICT_PRECEDENCE.length : idx;
}

/**
 * MEM-03: resolve a conflict between two records claiming the same fact.
 * Pure function — deterministic precedence, no LLM (D-127).
 *
 * Precedence: correction > verified > prior > inference.
 * Tie-break: higher confidence → more recent verifiedAt → id asc.
 * Winner absorbs loser into revisionChain.
 */
export function resolveConflict(a: MemoryRecord, b: MemoryRecord): MemoryRecord {
  const rankA = precedenceRank(a);
  const rankB = precedenceRank(b);

  let winner: MemoryRecord;
  let loser: MemoryRecord;

  if (rankA < rankB) {
    winner = a;
    loser = b;
  } else if (rankB < rankA) {
    winner = b;
    loser = a;
  } else {
    // Same precedence — tie-break.
    if (a.confidence !== b.confidence) {
      winner = a.confidence > b.confidence ? a : b;
    } else if (a.lifecycle.verifiedAt !== b.lifecycle.verifiedAt) {
      const aVerified = a.lifecycle.verifiedAt ?? 0;
      const bVerified = b.lifecycle.verifiedAt ?? 0;
      winner = aVerified > bVerified ? a : b;
    } else {
      // Final tie-break: id ascending (deterministic).
      winner = a.id <= b.id ? a : b;
    }
    loser = winner === a ? b : a;
  }

  // Winner absorbs loser into revisionChain (audit trail).
  const absorbed = {
    id: loser.id,
    replacedAt: Date.now(),
  };
  const existingChain = winner.revisionChain ?? [];
  return {
    ...winner,
    revisionChain: [...existingChain, absorbed],
  };
}

/**
 * Compute a normalized conflict-detection key (D-127).
 * Lowercase + trimmed content + sorted tags joined. Records with the same
 * key are candidates for conflict resolution.
 */
export function computeConflictKey(record: MemoryRecord): string {
  const normalizedContent = record.content.toLowerCase().trim();
  const sortedTags = [...record.tags].sort();
  return `${normalizedContent}|${sortedTags.join(',')}`;
}

/**
 * Detect conflict pairs in a list of records (D-127).
 * Returns pairs of records that share the same conflict key.
 */
export function detectConflicts(records: MemoryRecord[]): Array<[MemoryRecord, MemoryRecord]> {
  const keyMap = new Map<string, MemoryRecord[]>();
  for (const record of records) {
    const key = computeConflictKey(record);
    const group = keyMap.get(key) ?? [];
    group.push(record);
    keyMap.set(key, group);
  }

  const pairs: Array<[MemoryRecord, MemoryRecord]> = [];
  for (const group of keyMap.values()) {
    if (group.length < 2) continue;
    // Emit all unique pairs within the group.
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push([group[i], group[j]]);
      }
    }
  }
  return pairs;
}
