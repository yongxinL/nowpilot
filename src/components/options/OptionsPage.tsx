import { Empty, Typography } from 'antd';

export function OptionsPage() {
  return (
    <section data-testid="standalone-page-options" aria-label="Options">
      <Typography.Title level={3}>Options</Typography.Title>
      <Empty description="Appearance controls are added in Task 20." />
    </section>
  );
}
