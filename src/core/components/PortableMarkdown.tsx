// src/core/components/PortableMarkdown.tsx — the ONLY markdown renderer in this
// phase (banned third-party markdown renderer packages are never imported —
// the phase verify greps the src tree for them).
// Wraps @ant-design/x-markdown's XMarkdown renderer. Threat T-1-07 (XSS):
// sanitization is UNCONDITIONAL — the trust flag is a styling-only hint, never
// a bypass. Raw HTML in markdown is escaped to plain text (escapeRawHtml — the
// x-markdown equivalent of a skipHtml render mode) AND the content is passed
// through DOMPurify.sanitize first (defense in depth). AI/tool output is always
// trust:'retrieved' (R-7: never render AI/tool output raw).
import DOMPurify from 'dompurify';
import { XMarkdown } from '@ant-design/x-markdown';
import type { CSSProperties } from 'react';

export interface PortableMarkdownProps {
  content: string;
  /** Styling hint only — sanitization is unconditional regardless of trust. */
  trust?: 'retrieved' | 'untrusted';
  className?: string;
  style?: CSSProperties;
}

export function PortableMarkdown({
  content,
  trust = 'untrusted',
  className,
  style,
}: PortableMarkdownProps) {
  if (!content || content.trim().length === 0) return null;
  const sanitized = DOMPurify.sanitize(content);
  return (
    <div className={className} style={style} data-trust={trust}>
      <XMarkdown content={sanitized} escapeRawHtml />
    </div>
  );
}
