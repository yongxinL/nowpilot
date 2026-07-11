import { Tooltip, theme } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

export interface SidepanelCollapsedTriggerProps {
  onActivate: () => void;
}

export function SidepanelCollapsedTrigger({ onActivate }: SidepanelCollapsedTriggerProps) {
  const { token } = theme.useToken();
  return (
    <Tooltip title="Open navigation" placement="left">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onActivate}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 32,
          height: 32,
          borderRadius: token.borderRadius,
          backgroundColor: token.colorBgContainer,
          color: token.colorTextSecondary,
          border: `1px solid ${token.colorBorderSecondary}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          boxShadow: token.boxShadowSecondary,
        }}
        data-sidepanel-action="expand"
      >
        <ArrowRightOutlined />
      </button>
    </Tooltip>
  );
}
