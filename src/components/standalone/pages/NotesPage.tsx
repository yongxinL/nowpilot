import { Empty, Typography } from 'antd';

export function NotesPage() {
  return (
    <section data-testid="standalone-page-notes" aria-label="Notes">
      <Typography.Title level={3}>Notes</Typography.Title>
      <Empty description="Notes arrive in a later phase." />
    </section>
  );
}
