import { Empty, Typography } from 'antd';

export function ChatPage() {
  return (
    <section data-testid="standalone-page-chat" aria-label="Chat">
      <Typography.Title level={3}>Chat</Typography.Title>
      <Empty description="Chat workspace arrives in a later phase." />
    </section>
  );
}
