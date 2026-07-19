import React from 'react';
import { Card, Typography } from 'antd';
import { GeneralSection } from '../../components/options/GeneralSection';
import { DiagnosticsSection } from '../../components/options/DiagnosticsSection';
import { ProvidersSection } from '../../components/options/ProvidersSection';
import { ModelsSection } from '../../components/options/ModelsSection';
import { MCPSection } from '../../components/options/MCPSection';
import { PromptsSection } from '../../components/options/PromptsSection';
import { SlashSection } from '../../components/options/SlashSection';
import { MemorySection } from '../../components/options/MemorySection';
import { AppearanceSection } from '../../components/options/AppearanceSection';
import { ImportExportSection } from '../../components/options/ImportExportSection';
import { FeatureFlagsSection } from '../../components/options/FeatureFlagsSection';
import { PersonaPage } from '../../components/options/PersonaPage';
import { NotesSection } from '../../components/options/NotesSection';
import { AddonSettingsSection } from '../../components/options/AddonSettingsSection';
import { AboutSection } from '../../components/options/AboutSection';
import { SidebarSection } from '../../components/options/SidebarSection';
import { TranslateSection } from '../../components/options/TranslateSection';
import { AdvancedSection } from '../../components/options/AdvancedSection';

const { Title, Text } = Typography;

export interface OptionsPageProps {
  sectionId?: string;
}

function DefaultSectionPlaceholder({ id }: { id: string }) {
  return (
    <Card>
      <Title level={3}>Options</Title>
      <Text type="secondary">Section: {id}</Text>
      <p style={{ marginTop: 8 }}>This section is not yet implemented.</p>
    </Card>
  );
}

export function OptionsPage({ sectionId = 'general' }: OptionsPageProps) {
  switch (sectionId) {
    case 'general':
      return <GeneralSection />;
    case 'sidebar':
      return <SidebarSection />;
    case 'translate':
      return <TranslateSection />;
    case 'providers':
      return <ProvidersSection />;
    case 'models':
      return <ModelsSection />;
    case 'mcp':
      return <MCPSection />;
    case 'prompts':
      return <PromptsSection />;
    case 'slash':
      return <SlashSection />;
    case 'memory':
      return <MemorySection />;
    case 'appearance':
      return <AppearanceSection />;
    case 'diagnostics':
      return <DiagnosticsSection />;
    case 'import-export':
      return <ImportExportSection />;
    case 'feature-flags':
      return <FeatureFlagsSection />;
    case 'persona':
      return <PersonaPage />;
    case 'notes':
      return <NotesSection />;
    case 'addons':
      return <AddonSettingsSection />;
    case 'about':
      return <AboutSection />;
    case 'advanced':
      return <AdvancedSection />;
    default:
      return <DefaultSectionPlaceholder id={sectionId} />;
  }
}
