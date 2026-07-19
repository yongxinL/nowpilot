import { Flex, Button, Typography, theme } from 'antd';
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface ConversationClosureProps {
  onFeedback: (helpful: boolean) => void;
}

export function ConversationClosure({ onFeedback }: ConversationClosureProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      align="center"
      gap={token.marginXS}
      style={{
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Text style={{ fontSize: 13, color: token.colorTextSecondary }}>
        Did this help?
      </Text>
      <Button
        type="text"
        size="small"
        icon={<LikeOutlined />}
        aria-label="This was helpful"
        onClick={() => onFeedback(true)}
      />
      <Button
        type="text"
        size="small"
        icon={<DislikeOutlined />}
        aria-label="This was not helpful"
        onClick={() => onFeedback(false)}
      />
    </Flex>
  );
}
