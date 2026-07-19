import { sidepanelPageRegistry } from '../../core/registries/SidepanelPageRegistry';
import { standalonePageRegistry } from '../../core/registries/StandalonePageRegistry';
import { addonRegistry } from '../../core/registries/AddonRegistry';
import { ServiceNowSidepanelPage } from './components/ServiceNowSidepanelPage';
import { ServiceNowStandalonePage } from './components/ServiceNowStandalonePage';
import { registerServiceNowSkills } from './skills/serviceNowSkills';
import { ToolsIcon } from '../../components/sider/icons';

export function registerServiceNowAddon(): void {
  // Register prompt templates
  registerServiceNowSkills();

  // Register pages with existing registries (per D-01: pages go through page registries)
  sidepanelPageRegistry.register({
    id: 'servicenow',
    label: 'ServiceNow',
    icon: ToolsIcon,
    component: ServiceNowSidepanelPage,
    order: 11,
  });

  standalonePageRegistry.register({
    id: 'servicenow',
    label: 'ServiceNow',
    icon: ToolsIcon,
    component: ServiceNowStandalonePage,
    order: 11,
  });

  // Register add-on metadata with AddonRegistry (per D-01/D-02)
  addonRegistry.registerSettingsSchema({
    addonId: 'servicenow',
    fields: {
      instanceUrl: { type: 'string', label: 'ServiceNow Instance URL', default: '' },
      autoDetect: { type: 'boolean', label: 'Auto-detect from active tab', default: true },
    },
  });
}
