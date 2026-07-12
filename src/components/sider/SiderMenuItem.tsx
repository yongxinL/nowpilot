import { Tooltip, theme } from 'antd';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { NavItemSuffixArrow } from './NavItemSuffixArrow';

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
  lineHeight: 0,
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
    ? { backgroundColor: token.colorFillSecondary, color: token.colorPrimary }
    : { backgroundColor: 'transparent', color: token.colorTextSecondary };

  const iconColor: CSSProperties = {
    color: isActive ? token.colorPrimary : token.colorTextSecondary,
  };

  const buttonPadding: string = showLabel ? '10px 16px' : '10px 0';
  const buttonJustify: CSSProperties['justifyContent'] = showLabel ? 'flex-start' : 'center';

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
        justifyContent: buttonJustify,
        gap: 0,
        width: '100%',
        padding: buttonPadding,
        borderRadius: token.borderRadiusLG,
        font: 'inherit',
        fontWeight: 600,
        fontSize: 14,
        lineHeight: '20px',
        textAlign: showLabel ? 'left' : 'center',
        outline: 'none',
        cursor: 'pointer',
        transition: `background-color ${token.motionDurationMid} ${token.motionEaseOut}, color ${token.motionDurationMid} ${token.motionEaseOut}`,
        ...(item.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
      }}
      onMouseEnter={(e) => {
        if (!isActive && !item.disabled) {
          (e.currentTarget as HTMLElement).style.backgroundColor = token.colorFillTertiary;
          const iconSpan = (e.currentTarget as HTMLElement).querySelector(
            '[data-nav-item-icon="true"]',
          ) as HTMLElement | null;
          if (iconSpan) iconSpan.style.color = token.colorText;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          const iconSpan = (e.currentTarget as HTMLElement).querySelector(
            '[data-nav-item-icon="true"]',
          ) as HTMLElement | null;
          if (iconSpan) iconSpan.style.color = token.colorTextSecondary;
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 2px ${token.colorPrimaryBg}`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span data-nav-item-icon="true" style={{ ...ICON_BOX, ...iconColor }}>
        {item.icon}
      </span>
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
      {showArrow && showLabel && <NavItemSuffixArrow />}
    </div>
  );

  if (showLabel) return content;
  return (
    <div style={{ width: '100%' }}>
      <Tooltip title={tooltipLabel} placement={surface === 'sidepanel' ? 'left' : 'right'}>
        {content}
      </Tooltip>
    </div>
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
  const isAddon = item.group === 'addons';
  const showLabel = density === 'expanded' && !isAddon;
  const tooltipLabel = item.tooltip ?? item.label;
  const buttonLabel = item.shortLabel ?? item.label;

  const isActive = active === true;

  const button = (
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
        gap: 4,
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
          borderRadius: 10,
          background: isActive ? token.colorFillSecondary : 'transparent',
          color: isActive ? token.colorPrimary : token.colorTextSecondary,
          transition: `background-color ${token.motionDurationMid} ${token.motionEaseOut}, color ${token.motionDurationMid} ${token.motionEaseOut}`,
        }}
        onMouseEnter={(e) => {
          if (!isActive && !item.disabled) {
            (e.currentTarget as HTMLElement).style.backgroundColor = token.colorFillTertiary;
            (e.currentTarget as HTMLElement).style.color = token.colorText;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = token.colorTextSecondary;
          }
        }}
      >
        <span data-nav-item-icon="true" style={{ ...ICON_BOX, color: 'inherit' }}>
          {item.icon}
        </span>
      </div>
      {showLabel && (
        <span
          style={{
            maxWidth: 50,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11,
            lineHeight: '11px',
            letterSpacing: '-0.2px',
            color: isActive ? token.colorPrimary : token.colorTextSecondary,
            fontWeight: 600,
          }}
        >
          {buttonLabel}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ width: '100%' }}>
      <Tooltip title={tooltipLabel} placement="left">
        {button}
      </Tooltip>
    </div>
  );
}

export function SiderMenuItem(props: SiderMenuItemProps) {
  const { token } = theme.useToken();

  if (props.surface === 'sidepanel') {
    return <VerticalMenuItem {...props} token={token} />;
  }
  return <HorizontalMenuItem {...props} token={token} />;
}