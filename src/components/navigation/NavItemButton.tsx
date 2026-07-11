import { Tooltip, theme } from 'antd';
import type { CSSProperties } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';

export interface NavItemButtonRenderContext {
  surface: 'sidepanel' | 'standalone';
  density: 'expanded' | 'narrow' | 'collapsed';
  active: boolean;
}

export interface NavItemButtonProps {
  item: NowPilotNavItem;
  active?: boolean;
  density?: NavItemButtonRenderContext['density'];
  surface?: NavItemButtonRenderContext['surface'];
  onClick: (item: NowPilotNavItem) => void;
  showArrow?: boolean;
}

const ICON_BOX: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  fontSize: 20,
  flexShrink: 0,
};

export function NavItemButton({
  item,
  active = false,
  density = 'expanded',
  surface = 'standalone',
  onClick,
  showArrow = false,
}: NavItemButtonProps) {
  const { token } = theme.useToken();
  const showLabel = density === 'expanded';
  const tooltipLabel = item.tooltip ?? item.label;
  const buttonLabel = item.shortLabel ?? item.label;

  const bgStyle: CSSProperties = active
    ? { backgroundColor: token.colorFillSecondary, color: token.colorPrimary }
    : { backgroundColor: 'transparent', color: token.colorTextSecondary };

  const hoverStyle: CSSProperties = {
    cursor: 'pointer',
    transition: `background-color ${token.motionDurationMid} ${token.motionEaseOut}, color ${token.motionDurationMid} ${token.motionEaseOut}`,
  };

  const button = (
    <button
      type="button"
      aria-label={tooltipLabel}
      aria-current={active ? 'page' : undefined}
      disabled={item.disabled}
      data-nav-id={item.id}
      data-surface={surface}
      data-density={density}
      data-active={active ? 'true' : 'false'}
      onClick={() => onClick(item)}
      style={{
        ...bgStyle,
        ...hoverStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: showLabel ? '8px 12px' : '6px',
        border: 'none',
        borderRadius: token.borderRadius,
        font: 'inherit',
        fontWeight: 600,
        fontSize: showLabel ? 14 : 12,
        lineHeight: '20px',
        textAlign: 'left',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = token.colorFillTertiary;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 2px ${token.colorPrimaryBg}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={ICON_BOX}>{item.icon}</span>
      {showLabel && (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {buttonLabel}
        </span>
      )}
      {showArrow && showLabel && (
        <span
          aria-hidden
          style={{
            color: token.colorTextTertiary,
            fontSize: 12,
          }}
        >
          ›
        </span>
      )}
    </button>
  );

  if (showLabel) return button;
  return (
    <Tooltip title={tooltipLabel} placement={surface === 'sidepanel' ? 'left' : 'right'}>
      {button}
    </Tooltip>
  );
}
