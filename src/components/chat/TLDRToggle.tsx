import { useState, useMemo, type ReactNode } from 'react';
import { Button } from 'antd';

const TLDR_THRESHOLD = 500;

export interface TLDRToggleProps {
  content: string;
  streaming?: boolean;
  children?: ReactNode;
}

export function TLDRToggle({ content, streaming, children }: TLDRToggleProps) {
  const [expanded, setExpanded] = useState(false);
  const charCount = content.length;
  const shouldToggle = !streaming && charCount > TLDR_THRESHOLD;

  const preview = useMemo(() => {
    if (!shouldToggle) return content;
    const sentenceEnd = content.search(/[.!?]+[\s\n]/);
    if (sentenceEnd !== -1) {
      const previewEnd = Math.min(sentenceEnd + 160, charCount);
      return content.slice(0, previewEnd).trim();
    }
    return content.slice(0, 250).trim();
  }, [content, shouldToggle, charCount]);

  if (!shouldToggle) {
    return <>{children ?? content}</>;
  }

  return (
    <div>
      {expanded ? (
        <>
          <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
          <Button type="link" size="small" onClick={() => setExpanded(false)}>
            Show Less
          </Button>
        </>
      ) : (
        <>
          <div>{preview}</div>
          <Button type="link" size="small" onClick={() => setExpanded(true)}>
            Show More
          </Button>
        </>
      )}
    </div>
  );
}
