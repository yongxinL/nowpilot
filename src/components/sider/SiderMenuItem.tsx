import { Tooltip, theme } from 'antd';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';

export interface SiderMenuItemRenderContext {
  surface: 'sidepanel' | 'standalone';
  density: 'expanded' | 'narrow' | 'collapsed';
  active: boolean;
}

export interface SiderMenuItemProps {
  item: NowPilotNavItem;
  active?: boolean;
  density?: SiderMenuItemRenderContext['density'];
  surface?: SiderMenuItemRenderContext['surface'];
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

function handleKeyDown(e: KeyboardEvent, callback: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    callback();
  }
}

function HorizontalMenuItem({
  item,
  active,
  density,
  surface,
  onClick,
  showArrow,
  token,
}: SiderMenuItemProps & { token: any }) {
  const showLabel = density === 'expanded';
  const tooltipLabel = item.tooltip ?? item.label;
  const buttonLabel = item.shortLabel ?? item.label;

  const isActive = active === true;

  const bgStyle: CSSProperties = isActive
    ? { backgroundColor: token.colorFillContent, color: token.colorPrimary }
    : { backgroundColor: 'transparent', color: token.colorTextSecondary };

  const content = (
    <div
      role="button"
      tabIndex={0}
      aria-label={tooltipLabel}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={item.disabled}
      data-nav-id={item.id}
      data-surface={surface}
      data-density={density}
      data-active={isActive ? 'true' : 'false'}
      onClick={() => onClick(item)}
      onKeyDown={(e) => handleKeyDown(e, () => onClick(item))}
      style={{
        ...bgStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        width: '100%',
        padding: '10px 16px',
        borderRadius: 12,
        font: 'inherit',
        fontWeight: 600,
        fontSize: 14,
        lineHeight: '20px',
        textAlign: 'left',
        outline: 'none',
        cursor: 'pointer',
        transition: `background-color ${token.motionDurationMid} ${token.motionEaseOut}, color ${token.motionDurationMid} ${token.motionEaseOut}`,
        ...(item.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
      }}
      onMouseEnter={(e) => {
        if (!isActive && !item.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = token.colorFillTertiary;
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
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
            paddingLeft: 8,
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
            flexShrink: 0,
          }}
        >
          ›
        </span>
      )}
    </div>
  );

  if (showLabel) return content;
  return (
    <Tooltip title={tooltipLabel} placement={surface === 'sidepanel' ? 'left' : 'right'}>
      {content}
    </Tooltip>
  );
}

function VerticalMenuItem({
  item,
  active,
  density,
  surface,
  onClick,
  token,
}: SiderMenuItemProps & { token: any }) {
  const showLabel = density === 'expanded';
  const tooltipLabel = item.tooltip ?? item.label;
  const buttonLabel = item.shortLabel ?? item.label;

  const isActive = active === true;

  return (
    <Tooltip title={tooltipLabel} placement="left">
      <div
        role="button"
        tabIndex={0}
        aria-label={tooltipLabel}
        aria-current={isActive ? 'page' : undefined}
        aria-disabled={item.disabled}
        data-nav-id={item.id}
        data-surface={surface}
        data-density={density}
        data-active={isActive ? 'true' : 'false'}
        onClick={() => onClick(item)}
        onKeyDown={(e) => handleKeyDown(e, () => onClick(item))}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          width: '100%',
          padding: 0,
          borderRadius: 8,
          font: 'inherit',
          background: 'transparent',
          cursor: 'pointer',
          outline: 'none',
          transition: `opacity ${token.motionDurationMid} ${token.motionEaseOut}`,
          ...(item.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 8,
            background: isActive ? token.colorFillContent : 'transparent',
            color: isActive ? token.colorPrimary : token.colorTextSecondary,
            transition: `background-color ${token.motionDurationMid} ${token.motionEaseOut}, color ${token.motionDurationMid} ${token.motionEaseOut}`,
          }}
          onMouseEnter={(e) => {
            if (!isActive && !item.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = token.colorFillTertiary;
          }}
          onMouseLeave={(e) => {
            if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <span style={ICON_BOX}>{item.icon}</span>
        </div>
        {showLabel && (
          <span
            style={{
              marginTop: 4,
              maxWidth: 50,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 11,
              lineHeight: '11px',
              letterSpacing: '-0.2px',
              color: isActive ? token.colorPrimary : token.colorTextSecondary,
            }}
          >
            {buttonLabel}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

export function SiderMenuItem(props: SiderMenuItemProps) {
  const { token } = theme.useToken();

  if (props.surface === 'sidepanel') {
    return <VerticalMenuItem {...props} token={token} />;
  }
  return <HorizontalMenuItem {...props} token={token} />;
}
