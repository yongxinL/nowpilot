import { Empty, Typography } from 'antd';

export function DiagnosticsPage() {
  return (
    <section data-testid="standalone-page-diagnostics" aria-label="Diagnostics">
      <Typography.Title level={3}>Diagnostics</Typography.Title>
      <Empty description="Diagnostics arrive in a later phase." />
    </section>
  );
}
