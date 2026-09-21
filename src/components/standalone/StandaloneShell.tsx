import React, { useEffect, useState } from 'react';
import { Alert, Button, Input, Layout, Tooltip, Typography, theme } from 'antd';
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
import { t } from '../../core/i18n/strings';

const SIDER_WIDTH_EXPANDED = 240;
const SIDER_WIDTH_COLLAPSED = 72;
const HEADER_HEIGHT = 56;
const ITEM_HEIGHT = 40;
const MIN_VIEWPORT_WIDTH = 1024;

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
 * and neither is marked. The prototype chat host and `TeamsPanel` are not
 * mounted.
 */
export const StandaloneShell: React.FC<StandaloneShellProps> = ({ onOpenOptions }) => {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [route, setRoute] = useState<StandaloneRoute>(() =>
    resolveStandaloneRoute(typeof window === 'undefined' ? '' : window.location.search),
  );
  const viewportWidth = useViewportWidth();

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

          <Button
            type="text"
            aria-label={t('common.back')}
            icon={<LeftOutlined />}
            style={{ color: token.colorTextSecondary }}
          />

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
          <div style={{ flex: 1, minHeight: 0 }}>
            <StandaloneRouter route={route} onOpenOptions={onOpenOptions} />
          </div>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};
