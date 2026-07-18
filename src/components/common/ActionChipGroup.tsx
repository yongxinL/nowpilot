import { useMemo, type CSSProperties } from 'react';
import { Button, Flex, theme } from 'antd';

export interface ChipAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  value: string;
}

export interface ActionChipGroupProps {
  actions: ChipAction[];
  onSelect: (value: string) => void;
  maxVisible?: number;
  variant?: 'default' | 'quickAction';
}

/**
 * ActionChipGroup — shared horizontally-scrollable chip container.
 *
 * Used by QuickActionChips, ClarificationAction, and FollowUpAction.
 * Renders antd Button chips (size='small', variant='outlined') in a Flex container.
 */
export function ActionChipGroup({
  actions,
  onSelect,
  maxVisible,
  variant = 'default',
}: ActionChipGroupProps) {
  const { token } = theme.useToken();

  if (actions.length === 0) return null;

  const visibleActions = maxVisible ? actions.slice(0, maxVisible) : actions;

  const containerStyle: CSSProperties = useMemo(
    () => ({
      overflowX: 'auto',
      paddingBottom: 4,
      flexShrink: 0,
    }),
    [],
  );

  return (
    <Flex gap={token.marginXS} style={containerStyle}>
      {visibleActions.map((action) => (
        <Button
          key={action.key}
          size="small"
          variant="outlined"
          style={{
            whiteSpace: 'nowrap',
            maxWidth: 200,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            background: token.colorFillSecondary,
            border: variant === 'quickAction' ? 'none' : `1px solid ${token.colorBorderSecondary}`,
          }}
          onClick={() => onSelect(action.value)}
        >
          {variant === 'quickAction' && action.icon && (
            <span style={{ marginRight: 4 }}>{action.icon}</span>
          )}
          {action.label}
        </Button>
      ))}
    </Flex>
  );
}
