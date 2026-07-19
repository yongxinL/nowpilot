import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Typography, theme } from 'antd';
import {
  FileTextOutlined,
  PushpinOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { referenceResolver } from '../../core/references/referenceResolverRegistry';
import type { ReferenceToken } from '../../core/references/ReferenceToken';
import type { AutocompleteResult } from '../../core/references/ReferenceResolver';

const { Text } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  FileTextOutlined: <FileTextOutlined style={{ fontSize: 14 }} />,
  PushpinOutlined: <PushpinOutlined style={{ fontSize: 14 }} />,
  MessageOutlined: <MessageOutlined style={{ fontSize: 14 }} />,
};

export interface MentionAutocompleteProps {
  value: string;
  onSelect: (token: ReferenceToken, replacement: string) => void;
  cursorPosition?: number;
}

export function MentionAutocomplete({ value, onSelect, cursorPosition }: MentionAutocompleteProps) {
  const { token: antdToken } = theme.useToken();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract @mention query from text value
  const triggerInfo = useMemo(() => {
    const pos = cursorPosition ?? value.length;
    const beforeCursor = value.slice(0, pos);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex === -1) return null;
    const afterAt = beforeCursor.slice(atIndex + 1);
    const match = afterAt.match(/^([\w]*)$/);
    if (!match) return null;
    return { atIndex, query: match[1] };
  }, [value, cursorPosition]);

  useEffect(() => {
    if (!triggerInfo) {
      setIsOpen(false);
      return;
    }
    const q = triggerInfo.query;
    setQuery(q);
    setIsOpen(true);
    setSelectedIndex(0);

    if (q.length > 0) {
      referenceResolver.search(q).then((r) => {
        setResults(r);
      });
    } else {
      referenceResolver.search('').then((r) => {
        setResults(r);
      });
    }
  }, [triggerInfo?.query, triggerInfo?.atIndex]);

  const handleSelect = useCallback(async (result: AutocompleteResult) => {
    const replacement = `@${result.token.type}:${result.token.title}`;
    onSelect(result.token, replacement);
    setIsOpen(false);
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  }, [isOpen, results, selectedIndex, handleSelect]);

  // Click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        maxHeight: 300,
        overflowY: 'auto',
        zIndex: 1050,
        background: antdToken.colorBgElevated,
        border: `1px solid ${antdToken.colorBorder}`,
        borderRadius: antdToken.borderRadiusLG,
        boxShadow: antdToken.boxShadowSecondary,
        minWidth: 250,
      }}
    >
      {results.length === 0 ? (
        <div style={{ padding: '8px 12px' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>No results</Text>
        </div>
      ) : (
        results.map((result, index) => {
          const isSelected = index === selectedIndex;
          const chipColor = result.color === 'colorPrimary' ? antdToken.colorPrimary
            : result.color === 'colorInfo' ? antdToken.colorInfo
            : result.color === 'colorSuccess' ? antdToken.colorSuccess
            : antdToken.colorPrimary;

          return (
            <div
              key={`${result.token.type}-${result.token.id}`}
              onClick={() => handleSelect(result)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                background: isSelected ? antdToken.colorPrimaryBg : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span style={{ color: chipColor, fontSize: 16 }}>
                {ICON_MAP[result.icon] ?? null}
              </span>
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 13 }}>{result.token.title}</Text>
                {result.subtitle && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                      {result.subtitle}
                    </Text>
                  </div>
                )}
              </div>
              <Tag
                style={{
                  fontSize: 10,
                  lineHeight: '16px',
                  padding: '0 4px',
                  background: `${chipColor}15`,
                  borderColor: `${chipColor}30`,
                  color: chipColor,
                  borderRadius: 4,
                }}
              >
                {result.token.type}
              </Tag>
            </div>
          );
        })
      )}
    </div>
  );
}

function Tag({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={style}>{children}</span>;
}
