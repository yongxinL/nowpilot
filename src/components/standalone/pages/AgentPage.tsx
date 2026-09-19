import { Empty, Typography } from 'antd';

export function AgentPage() {
  return (
    <section data-testid="standalone-page-agent" aria-label="Agent">
      <Typography.Title level={3}>Agent</Typography.Title>
      <Empty description="Agent workspace arrives in a later phase." />
    </section>
  );
}
