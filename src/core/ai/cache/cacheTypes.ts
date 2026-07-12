import { z } from 'zod';

export const CacheSection = z.enum(['system-prompt', 'tool-schemas', 'preferences', 'memory']);
export type CacheSectionType = z.infer<typeof CacheSection>;

export interface CacheHint {
  section: CacheSectionType;
  messageIndices: number[];
  ttl: number;
}

export interface CacheKey {
  providerId: string;
  hash: string;
  createdAt: number;
}
