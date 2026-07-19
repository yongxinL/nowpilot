import { addonRegistry } from '../../core/registries/AddonRegistry';
import { researchSkill } from './ResearchSkill';

/**
 * Registers global add-ons (add-on features not tied to any domain).
 * Called during startup in main.tsx before React mounts.
 *
 * Per D-14: ResearchSkill is a global add-on — registered via AddonRegistry
 * as a skill. Available from both Chat and Agent modes via the /research command.
 */
export function registerGlobalAddons(): void {
  // Register ResearchSkill as a global add-on skill (D-14)
  addonRegistry.registerSkill('global', {
    name: 'research',
    description: 'Web search via configured MCP server',
    addonId: 'global',
    handler: async (input) => {
      const query =
        typeof input === 'object' && input !== null && 'query' in input
          ? String((input as Record<string, unknown>).query)
          : String(input);
      return researchSkill.execute(query);
    },
  });
}
