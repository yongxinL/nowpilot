import React from 'react';
import { XMarkdown } from '@ant-design/x-markdown';

interface PortableMarkdownProps {
  content: string;
  className?: string;
}

export const PortableMarkdown: React.FC<PortableMarkdownProps> = ({ content, className }) => {
  return (
    <div className={className}>
      <XMarkdown content={content} />
    </div>
  );
};
