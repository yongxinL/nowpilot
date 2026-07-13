import React, { useMemo } from 'react';
import { Button, Typography } from 'antd';
import type { LinkParser, Note } from '../../core/notes/LinkParser';

const { Text } = Typography;

export interface NotePreviewProps {
  content: string;
  notes: Note[];
  linkParser: LinkParser;
}

/**
 * Renders note content with resolved wikilinks.
 * [[title]] → resolved link to existing note
 * [[Unresolved]] → clickable "Create note?" prompt
 */
export function NotePreview({ content, notes, linkParser }: NotePreviewProps) {
  const rendered = useMemo(() => {
    if (!content) return null;

    const parts: React.ReactNode[] = [];
    const links = linkParser.parseLinks(content);
    if (links.length === 0) {
      // No wikilinks — render plain content
      return content;
    }

    // Split content by wikilink matches and render each part
    let lastIndex = 0;
    const WIKILINK_REGEX = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g;
    let match: RegExpExecArray | null;
    let key = 0;

    // Build title lookup map
    const titleToNote = new Map<string, Note>();
    for (const note of notes) {
      titleToNote.set(note.title.toLowerCase(), note);
    }

    WIKILINK_REGEX.lastIndex = 0;
    while ((match = WIKILINK_REGEX.exec(content)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${key}`}>{content.slice(lastIndex, match.index)}</span>,
        );
      }

      const rawTitle = match[1].trim();
      const alias = (match[2]?.trim() || rawTitle).trim();
      const matchedNote = titleToNote.get(rawTitle.toLowerCase());

      if (matchedNote) {
        // Resolved wikilink — show as clickable link
        parts.push(
          <Button
            key={`link-${key}`}
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 'inherit', lineHeight: 'inherit' }}
            onClick={() => {
              // Navigate to linked note — emit event handled by parent
            }}
          >
            {alias}
          </Button>,
        );
      } else {
        // Unresolved wikilink
        parts.push(
          <Text key={`unresolved-${key}`} type="warning" style={{ cursor: 'pointer' }}>
            {alias}
            <Text type="secondary" style={{ fontSize: 11 }}> (create?)</Text>
          </Text>,
        );
      }

      key++;
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last match
    if (lastIndex < content.length) {
      parts.push(<span key={`text-${key}`}>{content.slice(lastIndex)}</span>);
    }

    return parts;
  }, [content, notes, linkParser]);

  if (!rendered) {
    return (
      <Text type="secondary">Preview will appear here</Text>
    );
  }

  return <div style={{ lineHeight: 1.8 }}>{rendered}</div>;
}
