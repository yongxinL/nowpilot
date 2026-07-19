import { WriteIcon } from '../../components/sider/icons';
import { WritePage } from './components/WritePage';
import { sidepanelPageRegistry } from '../../core/registries/SidepanelPageRegistry';
import { registerWriteTemplates } from './skills/writeSkills';

export function registerWriteAddon(): void {
  // Register prompt templates
  registerWriteTemplates().catch(() => {
    // Idempotent — templates may already be registered
  });

  // Register Side Panel page (Side Panel only per D-09)
  sidepanelPageRegistry.register({
    id: 'write',
    label: 'Write',
    icon: WriteIcon,
    component: WritePage,
    order: 10,
  });
}
