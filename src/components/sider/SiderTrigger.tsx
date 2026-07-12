import { Tooltip, theme } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

export interface SiderTriggerProps {
  mode: 'expand-button' | 'collapsed-float';
  onActivate: () => void;
}

export function SiderTrigger({ mode, onActivate }: SiderTriggerProps) {
  const { token } = theme.useToken();

  if (mode === 'expand-button') {
    return (
      <Tooltip title="Expand sider" placement="right">
        <button
          type="button"
          aria-label="Expand sider"
          onClick={onActivate}
          style={{
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: token.colorFillTertiary,
            color: token.colorTextSecondary,
            cursor: 'pointer',
            border: 'none',
          }}
          data-sider-action="expand"
        >
          <ArrowRightOutlined style={{ fontSize: 12 }} />
        </button>
      </Tooltip>
    );
  }

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
        data-sider-action="expand"
      >
        <ArrowRightOutlined />
      </button>
    </Tooltip>
  );
}
