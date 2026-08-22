import React from 'react';
import { Tooltip, Popover, Button, theme } from 'antd';
import { SettingOutlined, RightOutlined, CheckCircleFilled } from '@ant-design/icons';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { UserAvatar } from '../common/UserAvatar';
import { ThemeToggle } from '../common/ThemeToggle';

export type WorkspaceTab = 'Chat' | 'Note' | 'Write' | 'Tools' | 'Teams';

interface WorkspaceSidebarProps {
  activeMenu: WorkspaceTab;
  onSelectMenu: (menu: WorkspaceTab) => void;
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
  onOpenSidepanel?: () => void;
  onOpenOptions?: () => void;
}

// Sider widths per DESIGN_SYSTEM §8.2 — locked to 72px / 240px (overriding
// the scaffold's 64/230 px drift in the same edit).
const SIDER_WIDTH_COLLAPSED = 72;
const SIDER_WIDTH_EXPANDED = 240;
const ICON_BUTTON_SIZE = 40; // 8px scale
const ICON_BUTTON_SIZE_SMALL = 28; // 4px scale
const AVATAR_SIZE_COLLAPSED = 36;
const AVATAR_SIZE_EXPANDED = 32;

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeMenu,
  onSelectMenu,
  collapsed,
  onToggleCollapsed,
  onOpenSidepanel,
  onOpenOptions,
}) => {
  const { token } = theme.useToken();

  // Sidebar tokens (light/dark aware via AntD theme.useToken()).
  const SIDEBAR_BG = token.colorBgLayout;
  const SIDEBAR_FG = token.colorTextSecondary;
  const ITEM_ACTIVE_BG = token.colorBgContainer;
  const ITEM_ACTIVE_FG = token.colorText;
  const ITEM_HOVER_BG = token.colorFillTertiary;
  const ITEM_IDLE_FG = token.colorTextTertiary;
  const ACCENT = token.colorPrimary;
  const DIVIDER = token.colorBorderSecondary;
  const BADGE_BG = token.colorPrimaryBg;
  const BADGE_FG = token.colorPrimary;

  const navMenuItems: { key: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'Chat',
      label: 'Chat',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      key: 'Note',
      label: 'Note',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      key: 'Write',
      label: 'Write',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
    {
      key: 'Tools',
      label: 'Tools',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      key: 'Teams',
      label: 'Teams',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  const userProfileContent = (
    <div style={{ width: 224, padding: token.paddingXS }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.paddingSM,
          paddingBottom: token.paddingSM,
          borderBottom: `1px solid ${DIVIDER}`,
        }}
      >
        <UserAvatar size={36} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText }}>
            User Account
          </div>
          <div style={{ fontSize: 12, color: token.colorTextQuaternary }}>
            NowPilot Workspace
          </div>
        </div>
      </div>
      <div
        style={{
          padding: `${token.paddingXS}px 0`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6, // 6px ≈ 4+2 stack — within allowed stack margin (≤8)
          fontSize: 12,
          color: token.colorTextSecondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Plan</span>
          <span
            style={{
              fontWeight: 500,
              color: token.colorSuccess,
              display: 'flex',
              alignItems: 'center',
              gap: token.paddingXXS,
            }}
          >
            <CheckCircleFilled style={{ fontSize: 10 }} /> Pro Active
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Mode</span>
          <span style={{ fontWeight: 500 }}>Standalone Tab</span>
        </div>
      </div>
      {onOpenOptions && (
        <Button
          type="default"
          size="small"
          block
          icon={<SettingOutlined />}
          onClick={onOpenOptions}
          style={{ marginTop: token.paddingXXS }}
        >
          Manage Settings
        </Button>
      )}
    </div>
  );

  const collapsedStyle: React.CSSProperties = {
    width: SIDER_WIDTH_COLLAPSED,
    alignItems: 'center',
    paddingLeft: token.paddingXXS,
    paddingRight: token.paddingXXS,
    paddingTop: token.paddingSM,
    paddingBottom: token.paddingSM,
  };
  const expandedStyle: React.CSSProperties = {
    width: SIDER_WIDTH_EXPANDED,
    paddingLeft: token.padding,
    paddingRight: token.padding,
    paddingTop: token.paddingSM,
    paddingBottom: token.paddingSM,
  };

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 200ms',
        userSelect: 'none',
        flexShrink: 0,
        backgroundColor: SIDEBAR_BG,
        color: SIDEBAR_FG,
        ...(collapsed ? collapsedStyle : expandedStyle),
      }}
    >
      {/* Top Section */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {collapsed ? (
          <div
            style={{
              marginBottom: token.paddingLG + token.paddingXS, // 24 = lg (16) + xs (8)
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <NowPilotAvatar size={AVATAR_SIZE_COLLAPSED} />
            </div>
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: token.paddingLG,
              paddingLeft: token.paddingXXS,
              paddingRight: token.paddingXXS,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <NowPilotAvatar size={AVATAR_SIZE_EXPANDED} />
              </div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13, // 14 → 13 (within {12,13,14,16})
                  letterSpacing: -0.2,
                  color: token.colorText,
                  userSelect: 'none',
                }}
              >
                NowPilot
              </span>
            </div>

            {onOpenSidepanel && (
              <Tooltip title="Switch to side panel view" placement="right">
                <button
                  type="button"
                  onClick={onOpenSidepanel}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: token.borderRadiusSM,
                    background: 'transparent',
                    border: 'none',
                    color: token.colorTextTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 150ms, color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = ITEM_HOVER_BG;
                    e.currentTarget.style.color = token.colorText;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = token.colorTextTertiary;
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* Plan 01-07: same Segmented theme control as the Side Panel —
            mounted in the top chrome (APPR-04). In collapsed mode it
            tucks under the avatar with `width: 100%` so the segmented
            rows align with the icon buttons below. */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            marginBottom: token.padding,
            paddingLeft: token.paddingXXS,
            paddingRight: token.paddingXXS,
          }}
        >
          <ThemeToggle />
        </div>

        {/* Navigation Menu Items */}
        <nav
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: token.paddingXXS, // 8 (within {4,8,16,24,32})
          }}
        >
          {navMenuItems.map((item) => {
            const isActive = activeMenu === item.key;
            const isTeams = item.key === 'Teams';

            return (
              <React.Fragment key={item.key}>
                {isTeams && (
                  <div style={{ margin: `${token.paddingXXS}px 0`, paddingLeft: token.paddingXS, paddingRight: token.paddingXS }}>
                    <div style={{ height: 1, width: '100%', backgroundColor: DIVIDER }} />
                  </div>
                )}

                {collapsed ? (
                  <Tooltip title={isTeams ? 'Teams (Add-on)' : item.label} placement="right">
                    <button
                      type="button"
                      onClick={() => onSelectMenu(item.key)}
                      style={{
                        width: ICON_BUTTON_SIZE,
                        height: ICON_BUTTON_SIZE,
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        borderRadius: token.borderRadius,
                        background: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        position: 'relative',
                        color: isActive ? ACCENT : ITEM_IDLE_FG,
                        backgroundColor: isActive ? ITEM_ACTIVE_BG : 'transparent',
                      }}
                    >
                      {item.icon}
                      {isTeams && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: ACCENT,
                          }}
                        />
                      )}
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectMenu(item.key)}
                    style={{
                      width: '100%',
                      paddingLeft: token.padding,
                      paddingRight: token.padding,
                      paddingTop: token.paddingSM,
                      paddingBottom: token.paddingSM,
                      borderRadius: token.borderRadius,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13, // 14 → 13 (within {12,13,14,16})
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      border: 'none',
                      color: isActive ? token.colorText : token.colorTextTertiary,
                      backgroundColor: isActive ? ITEM_ACTIVE_BG : 'transparent',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.paddingSM }}>
                      <span style={{ color: isActive ? ACCENT : 'inherit' }}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {isTeams && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: token.paddingXXS }}>
                        <span
                          style={{
                            fontSize: 10,
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 2,
                            paddingBottom: 2,
                            borderRadius: token.borderRadiusXS,
                            backgroundColor: BADGE_BG,
                            color: BADGE_FG,
                            fontWeight: 600,
                          }}
                        >
                          Add-on
                        </span>
                        <RightOutlined style={{ fontSize: 12, color: token.colorTextQuaternary }} />
                      </div>
                    )}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div style={{ width: '100%', paddingTop: token.paddingSM }}>
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.paddingXS }}>
            {onOpenOptions && (
              <Tooltip title="Options" placement="right">
                <button
                  type="button"
                  onClick={onOpenOptions}
                  style={{
                    width: ICON_BUTTON_SIZE,
                    height: ICON_BUTTON_SIZE,
                    borderRadius: token.borderRadius,
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: token.colorTextTertiary,
                    cursor: 'pointer',
                    transition: 'background-color 150ms, color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = ITEM_HOVER_BG;
                    e.currentTarget.style.color = token.colorText;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = token.colorTextTertiary;
                  }}
                >
                  <SettingOutlined style={{ fontSize: token.fontSize }} />
                </button>
              </Tooltip>
            )}

            <Popover content={userProfileContent} trigger="click" placement="rightBottom">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${ACCENT}55`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <UserAvatar size={32} />
              </div>
            </Popover>

            <Tooltip title="Expand side navbar" placement="right">
              <button
                type="button"
                onClick={() => onToggleCollapsed(false)}
                style={{
                  width: ICON_BUTTON_SIZE,
                  height: ICON_BUTTON_SIZE,
                  borderRadius: token.borderRadius,
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorTextTertiary,
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                  marginTop: token.paddingXXS,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ITEM_HOVER_BG;
                  e.currentTarget.style.color = token.colorText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = token.colorTextTertiary;
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="5" x2="19" y2="19" />
                  <polyline points="7 6 13 12 7 18" />
                </svg>
              </button>
            </Tooltip>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: token.paddingXXS,
              paddingRight: token.paddingXXS,
              paddingTop: token.paddingXXS,
              paddingBottom: token.paddingXXS,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Popover content={userProfileContent} trigger="click" placement="topLeft">
                <div
                  style={{
                    width: ICON_BUTTON_SIZE_SMALL,
                    height: ICON_BUTTON_SIZE_SMALL,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${ACCENT}55`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <UserAvatar size={28} />
                </div>
              </Popover>

              {onOpenOptions && (
                <Tooltip title="Options" placement="top">
                  <button
                    type="button"
                    onClick={onOpenOptions}
                    style={{
                      width: ICON_BUTTON_SIZE_SMALL,
                      height: ICON_BUTTON_SIZE_SMALL,
                      borderRadius: token.borderRadiusSM,
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: token.colorTextTertiary,
                      cursor: 'pointer',
                      transition: 'background-color 150ms, color 150ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = ITEM_HOVER_BG;
                      e.currentTarget.style.color = token.colorText;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = token.colorTextTertiary;
                    }}
                  >
                    <SettingOutlined style={{ fontSize: token.fontSizeSM }} />
                  </button>
                </Tooltip>
              )}
            </div>

            <Tooltip title="Collapse side navbar" placement="top">
              <button
                type="button"
                onClick={() => onToggleCollapsed(true)}
                style={{
                  width: ICON_BUTTON_SIZE_SMALL,
                  height: ICON_BUTTON_SIZE_SMALL,
                  borderRadius: token.borderRadiusSM,
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorTextTertiary,
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ITEM_HOVER_BG;
                  e.currentTarget.style.color = token.colorText;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = token.colorTextTertiary;
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="5" x2="5" y2="19" />
                  <polyline points="17 6 11 12 17 18" />
                </svg>
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
};
