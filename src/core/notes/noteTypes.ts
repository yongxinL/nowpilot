import { z } from 'zod';

export interface Citation {
  noteId: string;
  title: string;
  snippet: string;
}

export const citationSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  snippet: z.string(),
});
export type CitationSchema = z.infer<typeof citationSchema>;

export interface LlmFeatureToggles {
  autoTag: boolean;
  autoCategorize: boolean;
  autoSummary: boolean;
  aiSearch: boolean;
}

export const llmFeatureTogglesSchema = z.object({
  autoTag: z.boolean().default(true),
  autoCategorize: z.boolean().default(true),
  autoSummary: z.boolean().default(true),
  aiSearch: z.boolean().default(false),
});
export type LlmFeatureTogglesSchema = z.infer<typeof llmFeatureTogglesSchema>;

export interface TaggerResult {
  tags: string[];
  categoryPath: string | null;
  summary: string;
  memoryFacts?: Array<{
    fact: string;
    category: 'preference' | 'pattern' | 'knowledge' | 'goal' | 'identity';
    confidence: number;
    tags: string[];
  }>;
}

export const taggerResultSchema = z.object({
  tags: z.array(z.string()).max(5),
  categoryPath: z.string().nullable(),
  summary: z.string(),
  memoryFacts: z
    .array(
      z.object({
        fact: z.string(),
        category: z.enum(['preference', 'pattern', 'knowledge', 'goal', 'identity']),
        confidence: z.number().min(0).max(1),
        tags: z.array(z.string()),
      }),
    )
    .optional(),
});
export type TaggerResultSchema = z.infer<typeof taggerResultSchema>;

export interface QAResult {
  answer: string;
  citations: Citation[];
}

export const qaResultSchema = z.object({
  answer: z.string(),
  citations: z.array(citationSchema),
});
export type QAResultSchema = z.infer<typeof qaResultSchema>;

export interface ConverterResult {
  title: string;
  content: string;
  tags: string[];
  suggestedWikilinks: string[];
  categoryPath: string | null;
}

export const converterResultSchema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  suggestedWikilinks: z.array(z.string()),
  categoryPath: z.string().nullable(),
});
export type ConverterResultSchema = z.infer<typeof converterResultSchema>;

export interface BackupConfig {
  id: 'primary';
  folderHandle: FileSystemDirectoryHandle;
  folderName: string;
  lastSyncTimestamp?: number;
  totalNotesBackedUp?: number;
}

export const backupConfigSchema = z.object({
  id: z.literal('primary'),
  folderHandle: z.custom<FileSystemDirectoryHandle>(),
  folderName: z.string(),
  lastSyncTimestamp: z.number().optional(),
  totalNotesBackedUp: z.number().optional(),
});
export type BackupConfigSchema = z.infer<typeof backupConfigSchema>;

export type SyncStatus = 'on' | 'off' | 'error';
