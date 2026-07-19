import { describe, it, expect } from 'vitest';
import { attachmentSchema } from '../../../src/core/attachments/AttachmentModel';

describe('AttachmentModel', () => {
  it('validates an ImageAttachment', () => {
    const result = attachmentSchema.safeParse({
      kind: 'image',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,abc',
      fileName: 'screenshot.png',
      sizeBytes: 50000,
    });
    expect(result.success).toBe(true);
  });

  it('validates a FileAttachment', () => {
    const result = attachmentSchema.safeParse({
      kind: 'file',
      mimeType: 'application/pdf',
      name: 'doc.pdf',
      sizeBytes: 100000,
    });
    expect(result.success).toBe(true);
  });

  it('validates a VoiceTranscriptAttachment', () => {
    const result = attachmentSchema.safeParse({
      kind: 'voice_transcript',
      transcript: 'Hello world',
      durationSeconds: 3.5,
    });
    expect(result.success).toBe(true);
  });

  it('validates a ClipboardTextAttachment', () => {
    const result = attachmentSchema.safeParse({
      kind: 'clipboard_text',
      text: 'some pasted text',
      sourceUrl: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('validates a SuggestedFieldAction', () => {
    const result = attachmentSchema.safeParse({
      kind: 'suggested_field',
      selector: '#short_description',
      suggestedValue: 'Test incident',
      label: 'Short Description',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown kind', () => {
    const result = attachmentSchema.safeParse({
      kind: 'unknown_type',
      text: 'test',
    });
    expect(result.success).toBe(false);
  });
});
