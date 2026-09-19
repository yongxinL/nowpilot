import { Empty, Typography } from 'antd';

export function ToolsPage() {
  return (
    <section data-testid="standalone-page-tools" aria-label="Tools">
      <Typography.Title level={3}>Tools</Typography.Title>
      <Empty description="Tools arrive in a later phase." />
    </section>
  );
}
