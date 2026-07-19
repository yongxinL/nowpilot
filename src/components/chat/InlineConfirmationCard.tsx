import { Typography, theme, Spin, Flex } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { ActionChipGroup, type ChipAction } from '../common/ActionChipGroup';

const { Text } = Typography;

export interface InlineConfirmationCardProps {
  actionDescription: string;
  rationale?: string;
  onProceed: () => void;
  onCancel: () => void;
  state: 'pending' | 'executing' | 'completed' | 'cancelled';
  actionSummary?: string;
}

export function InlineConfirmationCard({
  actionDescription, rationale, onProceed, onCancel, state, actionSummary,
}: InlineConfirmationCardProps) {
  const { token } = theme.useToken();

  if (state === 'cancelled') {
    return <Text type="secondary" style={{ fontSize: 12 }}>Action cancelled.</Text>;
  }

  if (state === 'executing' || state === 'completed') {
    return (
      <Flex align="center" gap={token.marginXS}>
        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
        <Text style={{ fontSize: 12 }}>{actionSummary}</Text>
        {state === 'executing' && <Spin size="small" />}
      </Flex>
    );
  }

  // Pending state — main confirmation card
  const chips: ChipAction[] = [
    { key: 'proceed', label: 'Proceed', value: 'proceed' },
    { key: 'cancel', label: "Don't proceed", value: 'cancel' },
  ];

  const handleSelect = (value: string) => {
    if (value === 'proceed') onProceed();
    else onCancel();
  };

  return (
    <div
      style={{
        border: `1px solid ${token.colorWarningBorder}`,
        borderRadius: token.borderRadiusLG,
        padding: token.paddingSM,
        marginTop: token.marginXS,
        background: token.colorWarningBg,
      }}
    >
      <Text strong style={{ fontSize: 13 }}>{actionDescription}</Text>
      {rationale && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
          {rationale}
        </Text>
      )}
      <div style={{ marginTop: token.marginSM }}>
        <ActionChipGroup actions={chips} onSelect={handleSelect} variant="default" />
      </div>
    </div>
  );
}
