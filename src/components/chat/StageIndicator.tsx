import { useMemo, useEffect, useState, type CSSProperties } from 'react';
import { Typography, theme } from 'antd';
import { Think } from '@ant-design/x';
import type { OrchestrationStage } from '../../hooks/useStreamingLLM';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageIndicatorProps {
  stage: OrchestrationStage;
  hasPinnedTabs: boolean;
  lastTokenTime?: number;
  currentTool?: string;
  reasoning?: string;
}

// ---------------------------------------------------------------------------
// ThinkingIcon — reused from ChatPage
// ---------------------------------------------------------------------------

const ThinkingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 12 12" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      <path d="M6 1.45a4.15 4.15 0 0 0-2.832 7.185c.209.2.357.343.436.448.084.111.12.17.179.297.056.12.097.263.15.45l.01.035.04.141a.75.75 0 0 0 .721.544h2.59a.75.75 0 0 0 .721-.544l.04-.141.01-.036c.054-.186.095-.33.15-.449.06-.126.095-.186.18-.297a5 5 0 0 1 .48-.491A4.15 4.15 0 0 0 6 1.45M.95 5.6A5.05 5.05 0 1 1 9.5 9.24a7 7 0 0 0-.388.385l-.045.065-.036.07a3 3 0 0 0-.11.352l-.04.141a1.65 1.65 0 0 1-1.587 1.197h-2.59a1.65 1.65 0 0 1-1.586-1.197l-.04-.141a3 3 0 0 0-.11-.352l-.036-.07-.046-.065a6 6 0 0 0-.387-.385A5.04 5.04 0 0 1 .95 5.6" />
      <path d="M5.9 3.45A2.05 2.05 0 0 0 3.85 5.5a.45.45 0 1 1-.9 0A2.95 2.95 0 0 1 5.9 2.55a.45.45 0 1 1 0 .9" />
    </g>
  </svg>
);

/**
 * StageIndicator — enhanced pipeline-driven stage pills per D-35/D-36/D-37.
 *
 * Replaces the inline Think + switch statement in ChatPage.tsx with
 * context-aware pipeline-driven labels and slow-stream pulse animation.
 */
export function StageIndicator({
  stage,
  hasPinnedTabs,
  lastTokenTime,
  currentTool,
  reasoning,
}: StageIndicatorProps) {
  const { token } = theme.useToken();
  const [isSlow, setIsSlow] = useState(false);

  // Monitor slow-stream detection: >3s since last token
  useEffect(() => {
    if (stage === 'generating' && lastTokenTime) {
      const check = () => {
        const elapsed = Date.now() - lastTokenTime;
        setIsSlow(elapsed > 3000);
      };

      check(); // Immediate check
      const interval = setInterval(check, 1000);
      return () => clearInterval(interval);
    } else {
      setIsSlow(false);
    }
  }, [stage, lastTokenTime]);

  // Context-aware stage labels per D-35/UI-SPEC
  const stageLabel = useMemo(() => {
    switch (stage) {
      case 'retrieving':
        return hasPinnedTabs ? 'Reading page context…' : 'Retrieving context…';
      case 'planning':
        return 'Planning response…';
      case 'thinking':
        return 'Thinking…';
      case 'tool':
        return currentTool ? `Running tool: ${currentTool}` : 'Running tool…';
      case 'generating':
        return 'Generating…';
      case 'extracting':
        return 'Extracting insights…';
      case 'idle':
      default:
        return '';
    }
  }, [stage, hasPinnedTabs, currentTool]);

  // Slow-stream subtitle
  const stageDetail = useMemo(() => {
    switch (stage) {
      case 'retrieving':
        return 'Searching memory and notes for relevant context…';
      case 'planning':
        return 'Determining the best approach…';
      case 'thinking':
        return reasoning || 'Analyzing the request…';
      case 'generating':
        return 'Writing the final response…';
      case 'tool':
        return currentTool ? `Executing ${currentTool}…` : 'Running tool…';
      default:
        return null;
    }
  }, [stage, reasoning, currentTool]);

  if (!stageLabel) {
    return null;
  }

  return (
    <div>
      <Think
        icon={<ThinkingIcon />}
        title={stageLabel}
        loading
        blink
        defaultExpanded={!!(stage === 'thinking' && reasoning)}
      >
        {stageDetail}
      </Think>
      {isSlow && stage === 'generating' && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{
            animation: 'pulse 1.5s ease-in-out infinite',
            fontSize: 12,
          }}>
            Still working…
          </Text>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.5; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
