import React, { useEffect, useState } from 'react';
import { Alert, Button, Divider, Input, Layout, Tooltip, Typography, theme } from 'antd';
import {
  AppstoreOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EditOutlined,
  FileTextOutlined,
  LeftOutlined,
  MessageOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  StandaloneRouter,
  STANDALONE_MAIN_ROUTES,
  resolveStandaloneRoute,
  type StandaloneRoute,
} from './StandaloneRouter';
import { hydrateFromURL } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { requestRefocus } from '../../core/workspace/WriterElection';
import { MirrorBanner } from '../common/MirrorBanner';
import { AddonRegistry } from '../../core/registry/Registry';
import { t } from '../../core/i18n/strings';

const SIDER_WIDTH_EXPANDED = 240;
const SIDER_WIDTH_COLLAPSED = 72;
const HEADER_HEIGHT = 56;
const ITEM_HEIGHT = 40;
const MIN_VIEWPORT_WIDTH = 1024;

/**
 * The Sider Add-ons group label (UI-SPEC § Standalone: "Labelled divider + group
 * label, then add-on items"). Phase 1 registers no add-ons, so the label and its
 * separator are **absent rather than empty** — an empty group header is never
 * shown and an absent element carries no marker.
 */
const SIDER_ADDONS_GROUP_LABEL = 'Add-ons';

const ROUTE_ICONS: Record<StandaloneRoute, React.ReactNode> = {
  Chat: <MessageOutlined />,
  Agent: <RobotOutlined />,
  Note: <FileTextOutlined />,
  Write: <EditOutlined />,
  Tools: <AppstoreOutlined />,
  Options: <SettingOutlined />,
};

function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? MIN_VIEWPORT_WIDTH : window.innerWidth,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

export interface StandaloneShellProps {
  onOpenOptions?: () => void;
}

/**
 * Standalone workspace (UI-SPEC § Phase 1 Surface Contracts).
 *
 * Canonical shell: `Layout` + `Sider` (240 collapsed to 72) + 56 px top bar +
 * content area. The Sider Main group is the fixed canonical set
 * `Chat · Agent · Note · Write · Tools`; the Add-ons group renders only at
 * one or more registered add-ons and the account block only at one or more
 * identities — Phase 1 has neither, so **both are absent rather than empty**
 * and neither is marked: at ≥1 registered add-on the group label and its
 * separator render, and at zero neither does. The prototype `Teams` entry is not
 * part of the canonical Main set, so `TeamsPanel` and the unmounted
 * `WorkspaceSidebar` duplicate took the inventory's `remove` disposition rather
 * than being silently kept (D-02: one live implementation per element).
 */
export const StandaloneShell: React.FC<StandaloneShellProps> = ({ onOpenOptions }) => {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [route, setRoute] = useState<StandaloneRoute>(() =>
    resolveStandaloneRoute(typeof window === 'undefined' ? '' : window.location.search),
  );
  const viewportWidth = useViewportWidth();
  // The Add-ons group appears only at one or more registered add-ons. Phase 1
  // registers none (and installs no later-phase registration path), so the group
  // is absent in production; the positive control in
  // `tests/components/StandaloneShell.test.tsx` registers one add-on to prove the
  // absence assertion is not vacuous.
  const registeredAddons = AddonRegistry.getAll();
  // D-12 / D2-34: the banner's visibility is a pure function of the store's
  // writer state — never of the fact that this surface opened. A mirroring
  // Standalone reports it once, above the routed content.
  const writerState = useWorkspaceStore((state) => state.writerState);

  // Hydrate the workspace store from this tab's query string and become the
  // handoff target (D-13): the bootstrap is validated before use, readiness is
  // announced, and the returned disposer unsubscribes on unmount. A direct
  // open with no handoff bootstrap is a no-op.
  useEffect(() => {
    return hydrateFromURL(typeof window === 'undefined' ? '' : window.location.search);
  }, []);

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: token.paddingSM,
    width: '100%',
    height: ITEM_HEIGHT,
    paddingInline: token.paddingSM,
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: token.borderRadius,
    border: 'none',
    cursor: 'pointer',
    // Colour is never the only signal: the active state keeps its fill and
    // its weight, and the label/aria-label always carries the name.
    backgroundColor: isActive ? token.colorPrimaryBg : 'transparent',
    color: isActive ? token.colorPrimary : token.colorTextSecondary,
    fontWeight: isActive ? 600 : 400,
    fontSize: token.fontSize,
    fontFamily: token.fontFamily,
    textAlign: 'left',
  });

  return (
    <Layout style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <Layout.Sider
        data-testid="np-sider"
        collapsed={collapsed}
        collapsedWidth={SIDER_WIDTH_COLLAPSED}
        width={SIDER_WIDTH_EXPANDED}
        collapsible
        trigger={null}
        theme="light"
        style={{
          backgroundColor: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <nav
          aria-label={t('app.name')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: token.paddingXS,
            padding: token.paddingXS,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {STANDALONE_MAIN_ROUTES.map((item) => (
            <button
              key={item}
              type="button"
              aria-label={item}
              data-testid={`np-sider-item-${item}`}
              aria-current={route === item ? 'page' : undefined}
              style={navItemStyle(route === item)}
              onClick={() => setRoute(item)}
            >
              <Tooltip title={collapsed ? item : ''} placement="right">
                <span style={{ display: 'inline-flex', fontSize: 20 }}>{ROUTE_ICONS[item]}</span>
              </Tooltip>
              {!collapsed && <span>{item}</span>}
            </button>
          ))}

          {registeredAddons.length > 0 && (
            <>
              <Divider data-testid="np-sider-addons-separator" style={{ margin: `${token.marginXS}px 0` }} />
              <div
                data-testid="np-sider-addons-group"
                style={{
                  paddingInline: token.paddingSM,
                  paddingBlock: token.paddingXS,
                  fontSize: token.fontSizeSM,
                  fontWeight: 600,
                  color: token.colorTextTertiary,
                }}
              >
                {SIDER_ADDONS_GROUP_LABEL}
              </div>
              {registeredAddons.map((addon) => (
                <Tooltip key={addon.id} title={collapsed ? addon.name : ''} placement="right">
                  <button
                    type="button"
                    aria-label={addon.name}
                    data-testid={`np-sider-addon-${addon.id}`}
                    data-np-backing="deferred"
                    disabled
                    style={navItemStyle(false)}
                  >
                    <span style={{ display: 'inline-flex', fontSize: 20 }}>
                      <AppstoreOutlined />
                    </span>
                    {!collapsed && <span>{addon.name}</span>}
                  </button>
                </Tooltip>
              ))}
            </>
          )}
        </nav>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: token.paddingXS,
            padding: token.paddingXS,
          }}
        >
          <button
            type="button"
            aria-label={t('a11y.options')}
            data-testid="np-sider-options"
            style={navItemStyle(false)}
            onClick={onOpenOptions}
          >
            <Tooltip title={collapsed ? t('a11y.options') : ''} placement="right">
              <span style={{ display: 'inline-flex', fontSize: 20 }}>
                <SettingOutlined />
              </span>
            </Tooltip>
            {!collapsed && <span>{t('a11y.options')}</span>}
          </button>
        </div>
      </Layout.Sider>

      <Layout style={{ backgroundColor: token.colorBgContainer, minWidth: 0 }}>
        <Layout.Header
          style={{
            height: HEADER_HEIGHT,
            minHeight: HEADER_HEIGHT,
            lineHeight: `${HEADER_HEIGHT}px`,
            display: 'flex',
            alignItems: 'center',
            gap: token.paddingSM,
            paddingInline: token.padding,
            backgroundColor: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Tooltip title={t('a11y.collapseSidebar')}>
            <Button
              type="text"
              aria-label={collapsed ? t('a11y.expandSidebar') : t('a11y.collapseSidebar')}
              icon={collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
          </Tooltip>

          {/* WR-05: the back chevron is part of the pinned 56 px top bar
              composition, but Phase 1 has no in-app history to return to. An
              enabled control that does nothing is forbidden (marking
              convention hard rule 1), so it is disabled and marked exactly like
              the global search field beside it, with the same pinned deferred
              disclosure copy. */}
          <Tooltip title={t('deferred.reasonDeferred')}>
            <Button
              type="text"
              data-testid="np-topbar-back"
              data-np-backing="deferred"
              disabled
              aria-label={t('common.back')}
              icon={<LeftOutlined />}
              style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>

          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: token.borderRadiusSM,
              backgroundColor: token.colorPrimary,
              color: token.colorTextLightSolid,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            N
          </span>
          <Typography.Text strong>{t('app.name')}</Typography.Text>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
            <Tooltip title={t('deferred.reasonDeferred')}>
              <Input
                data-testid="np-global-search"
                data-np-backing="deferred"
                disabled
                aria-label={t('a11y.globalSearch')}
                placeholder={t('standalone.globalSearchPlaceholder')}
                prefix={<SearchOutlined />}
                style={{ maxWidth: 420 }}
              />
            </Tooltip>
          </div>
        </Layout.Header>

        <Layout.Content
          data-testid="np-standalone-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'auto',
            backgroundColor: token.colorBgContainer,
          }}
        >
          {viewportWidth < MIN_VIEWPORT_WIDTH && (
            <Alert
              data-testid="np-min-width-alert"
              type="warning"
              showIcon
              message={t('standalone.minWidth')}
              style={{ margin: token.paddingSM }}
            />
          )}
          {/* The single cross-surface status banner (D-12 carry-forward,
              D2-34), immediately above the routed content and mounted for
              exactly one writer state. Its action asks the registered election
              to promote this surface and changes nothing locally: a promotion
              unmounts the banner through authoritative state, and a refocus
              that does not reach primary reports through the election-failure
              channel. No optimistic hide, no success message, no reload. */}
          {writerState === 'mirror' && (
            <MirrorBanner
              onRefocus={() => {
                void requestRefocus();
              }}
            />
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            <StandaloneRouter route={route} onOpenOptions={onOpenOptions} />
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};
