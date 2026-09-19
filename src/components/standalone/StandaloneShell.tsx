import { Layout } from 'antd';
import type { StandalonePageRegistry } from '@/core/registry/StandalonePageRegistry';
import type { StandaloneRouteId } from '@/core/registry/standaloneRoutes';
import { StandaloneRouter, useStandaloneRoute } from './StandaloneRouter';
import { StandaloneSider } from './StandaloneSider';

export interface StandaloneShellProps {
  registry: StandalonePageRegistry;
  initialHash?: string;
  focusSubscription?: (listener: (destination: StandaloneRouteId) => void) => () => void;
  onRouteFallback?: (rawHash: string) => void;
}

export function StandaloneShell({
  registry,
  initialHash,
  focusSubscription,
  onRouteFallback,
}: StandaloneShellProps) {
  const { routeId, navigate } = useStandaloneRoute({
    initialHash,
    focusSubscription,
    onRouteFallback,
  });
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <StandaloneSider activeRoute={routeId} onNavigate={navigate} />
      <Layout.Content>
        <StandaloneRouter registry={registry} routeId={routeId} />
      </Layout.Content>
    </Layout>
  );
}
