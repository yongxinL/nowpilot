import type { UserMemoryFact } from './memoryTypes';

export interface ResolvedFact {
  fact: UserMemoryFact | Partial<UserMemoryFact>;
  status: 'active' | 'superseded' | 'dropped';
}

/**
 * Resolve a new fact against existing facts using D-16/D-17 conflict resolution.
 *
 * @param newFact - A newly extracted fact (partial, with fact/category/confidence/tags)
 * @param existingFacts - Array of existing facts from MemoryDB
 * @param observationCount - Number of independent observations supporting the new fact
 * @param observationConfidences - Confidence values for each observation (used to compute cumulative confidence)
 * @returns Array of resolved facts with their statuses
 */
export function resolve(
  newFact: Partial<UserMemoryFact>,
  existingFacts: UserMemoryFact[],
  observationCount: number,
  observationConfidences: number[] = [],
): ResolvedFact[] {
  // Check against active facts only (superseded facts are ignored)
  const activeFacts = existingFacts.filter((f) => f.status === 'active');

  // Find a conflicting fact: same category AND similar content
  const conflictingFact = activeFacts.find((existing) => {
    if (existing.category !== newFact.category) return false;
    const matchScore = factMatchScore(existing, newFact);
    return matchScore > 0.7;
  });

  if (!conflictingFact) {
    // No conflict — new fact becomes active
    return [{ fact: newFact, status: 'active' }];
  }

  // Check if the new fact is essentially the same as the existing one (high match)
  const isSameFact = factMatchScore(conflictingFact, newFact) > 0.95;

  if (isSameFact) {
    // Same fact with additional observation — accumulate confidence
    const existingConfidence = conflictingFact.confidence;
    const newConfidence = newFact.confidence ?? 0;
    const cumulative = computeCumulativeConfidence([existingConfidence, newConfidence]);
    const updatedFact: UserMemoryFact = {
      ...conflictingFact,
      confidence: cumulative,
      updated: Date.now(),
    };
    return [{ fact: updatedFact, status: 'active' }];
  }

  // Contradictory fact — check evidence threshold (D-16)
  const effectiveConfidences =
    observationConfidences.length > 0
      ? observationConfidences
      : [newFact.confidence ?? 0];

  const cumulativeConfidence = computeCumulativeConfidence(effectiveConfidences);

  if (observationCount >= 2 && cumulativeConfidence > conflictingFact.confidence) {
    // Supersede: old fact → superseded, new fact → active
    const supersededFact: UserMemoryFact = {
      ...conflictingFact,
      status: 'superseded',
    };
    const newActiveFact: Partial<UserMemoryFact> = {
      ...newFact,
      confidence: cumulativeConfidence,
      status: 'active',
    };
    return [
      { fact: supersededFact, status: 'superseded' },
      { fact: newActiveFact, status: 'active' },
    ];
  }

  // Evidence threshold not met — keep existing, drop new
  return [{ fact: conflictingFact, status: 'active' }];
}

/**
 * Compute cumulative confidence using D-17 formula:
 * 1 - product(1 - c_i for each confidence c_i)
 */
export function computeCumulativeConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  return 1 - confidences.reduce((product, c) => product * (1 - c), 1);
}

/**
 * Compute Jaccard-like similarity score between two facts.
 * Tokenizes text by splitting on whitespace, lowercasing, filtering words > 3 chars.
 */
export function factMatchScore(
  a: UserMemoryFact | Partial<UserMemoryFact>,
  b: Partial<UserMemoryFact>,
): number {
  const tokensA = tokenize(a.fact ?? '');
  const tokensB = tokenize(b.fact ?? '');

  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const intersection = tokensA.filter((t) => setB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  return intersection / union;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);
}
