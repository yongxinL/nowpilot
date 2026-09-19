import { AgentPage } from '../../components/standalone/pages/AgentPage';
import { ChatPage } from '../../components/standalone/pages/ChatPage';
import { DiagnosticsPage } from '../../components/standalone/pages/DiagnosticsPage';
import { NotesPage } from '../../components/standalone/pages/NotesPage';
import { ToolsPage } from '../../components/standalone/pages/ToolsPage';
import { WritePage } from '../../components/standalone/pages/WritePage';
import { OptionsPage } from '../../components/options/OptionsPage';
import {
  createStandalonePageRegistry,
  type StandalonePageRegistry,
} from './StandalonePageRegistry';

export function createCorePageRegistry(): StandalonePageRegistry {
  const registry = createStandalonePageRegistry();
  registry.register('chat', ChatPage);
  registry.register('agent', AgentPage);
  registry.register('notes', NotesPage);
  registry.register('write', WritePage);
  registry.register('tools', ToolsPage);
  registry.register('options', OptionsPage);
  registry.register('diagnostics', DiagnosticsPage);
  return registry;
}

export const CORE_PAGE_REGISTRY = createCorePageRegistry();
