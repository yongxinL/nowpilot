import { z } from 'zod';

export const imageAttachmentSchema = z.object({
  kind: z.literal('image'),
  mimeType: z.string(),
  dataUrl: z.string(),
  fileName: z.string(),
  sizeBytes: z.number(),
});
export type ImageAttachment = z.infer<typeof imageAttachmentSchema>;

export const fileAttachmentSchema = z.object({
  kind: z.literal('file'),
  mimeType: z.string(),
  name: z.string(),
  sizeBytes: z.number(),
  content: z.string().optional(),
});
export type FileAttachment = z.infer<typeof fileAttachmentSchema>;

export const voiceTranscriptAttachmentSchema = z.object({
  kind: z.literal('voice_transcript'),
  transcript: z.string(),
  durationSeconds: z.number().optional(),
});
export type VoiceTranscriptAttachment = z.infer<typeof voiceTranscriptAttachmentSchema>;

export const clipboardTextAttachmentSchema = z.object({
  kind: z.literal('clipboard_text'),
  text: z.string(),
  sourceUrl: z.string().optional(),
});
export type ClipboardTextAttachment = z.infer<typeof clipboardTextAttachmentSchema>;

export const suggestedFieldActionSchema = z.object({
  kind: z.literal('suggested_field'),
  selector: z.string(),
  suggestedValue: z.string(),
  label: z.string(),
});
export type SuggestedFieldAction = z.infer<typeof suggestedFieldActionSchema>;

export const attachmentSchema = z.discriminatedUnion('kind', [
  imageAttachmentSchema,
  fileAttachmentSchema,
  voiceTranscriptAttachmentSchema,
  clipboardTextAttachmentSchema,
  suggestedFieldActionSchema,
]);
export type Attachment =
  | ImageAttachment
  | FileAttachment
  | VoiceTranscriptAttachment
  | ClipboardTextAttachment
  | SuggestedFieldAction;
