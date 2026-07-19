import { Button, Flex, message, theme } from 'antd';
import { CopyOutlined, TableOutlined } from '@ant-design/icons';

export interface StructuredOutputActionsProps {
  content: string;
  hasTable: boolean;
}

export function StructuredOutputActions({ content, hasTable }: StructuredOutputActionsProps) {
  const { token } = theme.useToken();

  const handleCopyTable = () => {
    navigator.clipboard.writeText(content).then(() => message.success('Table copied to clipboard'));
  };

  const handleExportCSV = () => {
    // Extract markdown table rows → CSV
    const rows = content.split('\n').filter(line => line.startsWith('|'));
    const csv = rows.map(row =>
      row.split('|').filter(cell => cell.trim()).map(cell => `"${cell.trim()}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasTable) return null;

  return (
    <Flex gap={4} style={{ marginTop: 4 }}>
      <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopyTable}>
        Copy as table
      </Button>
      <Button type="text" size="small" icon={<TableOutlined />} onClick={handleExportCSV}>
        Export CSV
      </Button>
    </Flex>
  );
}
