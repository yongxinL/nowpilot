import { ApiOutlined } from '@ant-design/icons';
import { Badge, Tooltip } from 'antd';
import { useThemeStore } from '../../core/stores/themeStore';

interface MCPStatusIndicatorProps {
  enabled?: boolean;
}

export function MCPStatusIndicator({ enabled }: MCPStatusIndicatorProps) {
  const mode = useThemeStore((s) => s.mode);
  const resolved = enabled ?? mode !== 'auto';
  const label = resolved ? 'MCP tools enabled' : 'No MCP tools enabled';
  return (
    <Tooltip title={label}>
      <Badge
        status={resolved ? 'success' : 'default'}
        text={
          <span aria-label={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ApiOutlined />
            MCP
          </span>
        }
      />
    </Tooltip>
  );
}
