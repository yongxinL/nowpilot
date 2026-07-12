import { z } from 'zod';
import { debugLog } from '../utils/debugLog';

export type WriteJournalOperation =
  | 'update-workspace'
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data';

export interface WriteJournalSteps {
  name: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: WriteJournalSteps[];
}

export const writeJournalEntrySchema = z.object({
  id: z.string().min(1),
  operation: z.enum([
    'update-workspace',
    'append-memory-message',
    'evict-conversation',
    'archive-conversation',
    'compact-conversation',
    'save-note-with-links',
    'update-user-memory',
    'export-data',
  ]),
  status: z.enum(['pending', 'applying', 'completed', 'failed', 'rolled-back']),
  createdAt: z.number(),
  updatedAt: z.number(),
  attempts: z.number().int().min(0),
  targetIds: z.record(z.string(), z.string()),
  steps: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['pending', 'completed', 'failed']),
      error: z.string().optional(),
    }),
  ),
});

export function validateWriteJournalEntry(data: unknown): WriteJournalEntry {
  const result = writeJournalEntrySchema.safeParse(data);
  if (!result.success) {
    debugLog('warn', 'Invalid WriteJournalEntry', { errors: result.error.flatten() });
    throw new Error('Invalid WriteJournalEntry');
  }
  return result.data as WriteJournalEntry;
}
