import { Typography, theme } from 'antd';
import { ActionChipGroup, type ChipAction } from '../common/ActionChipGroup';

const { Text } = Typography;

export interface ClarificationActionProps {
  question: string;
  options: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
}

/**
 * ClarificationAction — renders PlannerService's ask_clarification response in a Bubble (D-26).
 *
 * Pure presentation component. Receives all data via props — no Zustand or service calls.
 * Renders the question text followed by clickable option chips.
 */
export function ClarificationAction({
  question,
  options,
  onSelect,
}: ClarificationActionProps) {
  const { token } = theme.useToken();

  const chips: ChipAction[] = options.map((opt, idx) => ({
    key: `clarify-${idx}`,
    label: opt.label,
    value: opt.value,
  }));

  return (
    <div>
      <Text
        style={{
          marginBottom: token.marginSM,
          display: 'block',
        }}
      >
        {question}
      </Text>
      <ActionChipGroup
        actions={chips}
        onSelect={onSelect}
        variant="default"
      />
    </div>
  );
}
