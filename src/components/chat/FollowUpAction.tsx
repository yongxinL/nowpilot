import { useMemo, type CSSProperties } from 'react';
import { theme } from 'antd';
import type { FollowUpSuggestion } from '../../core/ai/followUp/FollowUpService';
import { ActionChipGroup, type ChipAction } from '../common/ActionChipGroup';

export interface FollowUpActionProps {
  suggestions: Array<{ text: string }>;
  onSelect: (text: string) => void;
}

/**
 * FollowUpAction — renders a visual divider with "Follow up" label and suggestion chips.
 *
 * Per UI-SPEC §Follow-up Divider Copy:
 * - Divider with "Follow up" label (fontSize: 12, uppercase, colorTextQuaternary)
 * - Suggestion chips via ActionChipGroup (token.colorFillQuaternary bg)
 * - Tapping a chip calls onSelect which sends the text as next user message (D-29)
 */
export function FollowUpAction({ suggestions, onSelect }: FollowUpActionProps) {
  const { token } = theme.useToken();

  if (!suggestions.length) return null;

  const chips: ChipAction[] = useMemo(
    () =>
      suggestions.map((s) => ({
        key: s.text,
        label: s.text,
        value: s.text,
      })),
    [suggestions],
  );

  const dividerStyle: CSSProperties = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    }),
    [],
  );

  const lineStyle: CSSProperties = useMemo(
    () => ({
      flex: 1,
      height: 1,
      backgroundColor: token.colorBorderSecondary,
    }),
    [token],
  );

  const labelStyle: CSSProperties = useMemo(
    () => ({
      fontSize: 12,
      fontWeight: 400,
      color: token.colorTextQuaternary,
      textTransform: 'uppercase' as const,
      whiteSpace: 'nowrap',
    }),
    [token],
  );

  const containerStyle: CSSProperties = useMemo(
    () => ({
      marginTop: token.marginSM,
    }),
    [token],
  );

  return (
    <div style={containerStyle}>
      <div style={dividerStyle}>
        <div style={lineStyle} />
        <span style={labelStyle}>Follow up</span>
        <div style={lineStyle} />
      </div>
      <ActionChipGroup actions={chips} onSelect={onSelect} variant="default" />
    </div>
  );
}
