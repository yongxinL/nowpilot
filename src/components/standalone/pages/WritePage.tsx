import { Empty, Typography } from 'antd';

export function WritePage() {
  return (
    <section data-testid="standalone-page-write" aria-label="Write">
      <Typography.Title level={3}>Write</Typography.Title>
      <Empty description="Write arrives in a later phase." />
    </section>
  );
}
