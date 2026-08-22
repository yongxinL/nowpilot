import React, { useState } from 'react';
import {
  UpOutlined,
  DownOutlined,
  CloseOutlined,
  GithubOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { TabItem } from '../../types';

interface PinnedTabsBarProps {
  pinnedTabs: TabItem[];
  onUnpinTab: (tabId: string) => void;
}

export const PinnedTabsBar: React.FC<PinnedTabsBarProps> = ({
  pinnedTabs,
  onUnpinTab,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!pinnedTabs || pinnedTabs.length === 0) return null;

  const count = pinnedTabs.length;

  if (count === 1) {
    const tab = pinnedTabs[0];
    const isGithub = tab.url?.includes('github');
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 8,
          background: 'var(--muted)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: 8,
          }}
        >
          {isGithub ? (
            <GithubOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14, flexShrink: 0 }} />
          ) : (
            <GlobalOutlined style={{ color: '#3b82f6', fontSize: 14, flexShrink: 0 }} />
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--foreground)',
              fontWeight: 500,
            }}
          >
            {tab.title}
          </span>
          {tab.isCurrent && (
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>• Current tab</span>
          )}
        </div>
        <button
          onClick={() => onUnpinTab(tab.id)}
          style={{
            padding: 4,
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            background: 'transparent',
            border: 'none',
          }}
          title="Unpin tab"
        >
          <CloseOutlined style={{ fontSize: 10 }} />
        </button>
      </div>
    );
  }

  // Count > 1: Collapsed or Expanded
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 10,
          background: 'var(--muted)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          fontSize: 12,
          marginBottom: 8,
          cursor: 'pointer',
          transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {pinnedTabs.slice(0, 3).map((t, i) => (
              <div
                key={t.id}
                style={{
                  marginLeft: i === 0 ? 0 : -6,
                  width: 20,
                  height: 20,
                  borderRadius: 9999,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  flexShrink: 0,
                }}
              >
                {t.url?.includes('github') ? (
                  <GithubOutlined />
                ) : (
                  <GlobalOutlined style={{ color: '#3b82f6' }} />
                )}
              </div>
            ))}
          </div>
          <span
            style={{
              color: 'var(--foreground)',
              fontWeight: 600,
              marginLeft: 2,
            }}
          >
            Sharing {count} tabs
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          style={{
            padding: 4,
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
          }}
          title="Expand tabs list"
        >
          <UpOutlined style={{ fontSize: 12 }} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 10,
        background: 'var(--muted)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        fontSize: 12,
        marginBottom: 8,
        userSelect: 'none',
      }}
    >
      {/* Expanded Header */}
      <div
        onClick={() => setIsExpanded(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600,
          color: 'var(--foreground)',
          marginBottom: 8,
          cursor: 'pointer',
          transition: 'opacity 150ms ease',
        }}
      >
        <span>Sharing {count} tabs</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          style={{
            padding: 4,
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
          }}
          title="Collapse tabs list"
        >
          <DownOutlined style={{ fontSize: 12 }} />
        </button>
      </div>

      {/* Expanded Tabs List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {pinnedTabs.map(tab => {
          const isGithub = tab.url?.includes('github');
          return (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 6,
                background: 'var(--card)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  paddingRight: 8,
                }}
              >
                {isGithub ? (
                  <GithubOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14, flexShrink: 0 }} />
                ) : (
                  <GlobalOutlined style={{ color: '#3b82f6', fontSize: 14, flexShrink: 0 }} />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--foreground)',
                    fontWeight: 400,
                  }}
                >
                  {tab.title}
                </span>
                {tab.isCurrent && (
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>• Current tab</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onUnpinTab(tab.id)}
                style={{
                  padding: 4,
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  background: 'transparent',
                  border: 'none',
                }}
                title="Unpin tab"
              >
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
