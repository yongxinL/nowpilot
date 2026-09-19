import { Layout, Menu } from 'antd';
import {
  FOOTER_STANDALONE_ROUTES,
  PRIMARY_STANDALONE_ROUTES,
  type StandaloneRouteId,
} from '@/core/registry/standaloneRoutes';

export interface StandaloneSiderProps {
  activeRoute: StandaloneRouteId;
  onNavigate(routeId: StandaloneRouteId): void;
}

export function StandaloneSider({ activeRoute, onNavigate }: StandaloneSiderProps) {
  const items = [
    ...PRIMARY_STANDALONE_ROUTES.map((route) => ({ key: route.id, label: route.label })),
    ...FOOTER_STANDALONE_ROUTES.map((route) => ({ key: route.id, label: route.label })),
  ];
  return (
    <Layout.Sider width={240} theme="light" aria-label="Workspace navigation">
      <Menu
        mode="inline"
        selectedKeys={[activeRoute]}
        items={items}
        onClick={({ key }) => onNavigate(key as StandaloneRouteId)}
      />
    </Layout.Sider>
  );
}
