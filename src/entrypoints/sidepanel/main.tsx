import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/theme/ThemeStore';
import { SidePanelShell } from '@/components/sidepanel/SidePanelShell';

function Root() {
  const { mode, pack } = useThemeStore((s) => ({ mode: s.mode, pack: s.pack }));
  const cfg = getAntdConfig({ mode, pack, compact: true });
  return (
    <XProvider {...cfg}>
      <AntdApp>
        <SidePanelShell />
      </AntdApp>
    </XProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
