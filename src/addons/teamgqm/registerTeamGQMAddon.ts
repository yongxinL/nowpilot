import { sidepanelPageRegistry } from '../../core/registries/SidepanelPageRegistry';
import { standalonePageRegistry } from '../../core/registries/StandalonePageRegistry';
import { addonRegistry } from '../../core/registries/AddonRegistry';
import { TeamGQMSidepanelPage } from './components/TeamGQMSidepanelPage';
import { TeamGQMStandalonePage } from './components/TeamGQMStandalonePage';
import { ApartmentOutlined } from '@ant-design/icons';

export function registerTeamGQMAddon(): void {
  sidepanelPageRegistry.register({
    id: 'teamgqm',
    label: 'Goals & Metrics',
    icon: ApartmentOutlined,
    component: TeamGQMSidepanelPage,
    order: 12,
  });

  standalonePageRegistry.register({
    id: 'teamgqm',
    label: 'GQM Workspace',
    icon: ApartmentOutlined,
    component: TeamGQMStandalonePage,
    order: 12,
  });

  addonRegistry.registerSettingsSchema({
    addonId: 'teamgqm',
    fields: {},
  });
}
