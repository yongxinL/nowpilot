import React, { useEffect, useState } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useThemeStore } from '../../core/stores/themeStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { OptionsRoot, OptionsShellFooter, optionsSections } from '../../components/options/OptionsRoot';
import { standalonePageRegistry } from '../../core/registries/StandalonePageRegistry';
import { OptionsPage } from '../../core/pages/OptionsPage';
import '../../core/registries/registerNowPilotCorePages';

registerStandaloneOptionsPage();

function registerStandaloneOptionsPage() {
  standalonePageRegistry.register({
    id: 'options',
    label: 'Options',
    component: OptionsPage,
    order: 999,
  });
}

const HASH_TO_SECTION: Record<string, string> = Object.fromEntries(
  optionsSections.map((s) => [s.id, s.id]),
);

function resolveHashSection(): string {
  if (typeof window === 'undefined') return 'providers';
  const id = window.location.hash.replace('#', '');
  return HASH_TO_SECTION[id] ?? 'providers';
}

export function OptionsApp() {
  const mode = useThemeStore((s) => s.mode);
  const [section, setSection] = useState<string>(resolveHashSection());

  useEffect(() => {
    const onHashChange = () => setSection(resolveHashSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const antdConfig = getAntdConfig({ mode, compact: false });

  const renderSectionContent = (sectionId: string) => (
    <div data-options-rendered-section={sectionId} style={{ padding: '8px 0' }}>
      <OptionsPage sectionId={sectionId} />
    </div>
  );

  return (
    <ConfigProvider {...antdConfig}>
      <AntApp>
        <ErrorBoundary>
          <OptionsRoot
            initialSection={section}
            onSelectSection={setSection}
            renderSectionContent={renderSectionContent}
          />
          <OptionsShellFooter />
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
