import React, { useState } from 'react';
import { CompassOutlined, ArrowRightOutlined, CloseOutlined } from '@ant-design/icons';

interface FollowupSuggestionsProps {
  suggestions?: string[];
  onSelectSuggestion: (prompt: string) => void;
  onDeepResearch?: () => void;
}

export const FollowupSuggestions: React.FC<FollowupSuggestionsProps> = ({
  suggestions,
  onSelectSuggestion,
  onDeepResearch,
}) => {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div
      style={{
        marginTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
      }}
    >
      {/* Deep Research Banner Card */}
      {!dismissed && (
        <div
          onClick={onDeepResearch}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            paddingRight: 32,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            cursor: 'pointer',
            transition: 'all 200ms ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                color: 'var(--foreground)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Go further——in-depth analysis with Deep Research
            </span>
            <ArrowRightOutlined style={{ fontSize: 12, color: '#3b82f6' }} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <CompassOutlined style={{ fontSize: 14 }} />
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: 4,
              color: 'var(--muted-foreground)',
              borderRadius: 9999,
              cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              background: 'transparent',
              border: 'none',
            }}
            title="Close banner"
          >
            <CloseOutlined style={{ fontSize: 10 }} />
          </button>
        </div>
      )}

      {/* Suggestion Chips */}
      {suggestions && suggestions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 4,
          }}
        >
          {suggestions.map((sugg, i) => (
            <button
              key={i}
              onClick={() => onSelectSuggestion(sugg)}
              style={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 6,
                paddingBottom: 6,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--muted-foreground)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                textAlign: 'left',
              }}
            >
              {sugg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
