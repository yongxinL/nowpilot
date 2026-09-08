import type { z } from 'zod';
import type { PromptTemplate } from '@/core/prompts/types';
import type { SidePanelPageRegistration } from '@/core/registry/SidePanelPageRegistry';
import type { StandalonePageRegistration } from '@/core/registry/StandalonePageRegistry';
import type { KeymapRegistration } from '@/core/input/KeymapRegistry';

export interface Addon {
  id: string;
  name: string;
  scope: 'site' | 'global';
  urlPatterns?: string[];
  prompts?: PromptTemplate[];
  sidePanelPages?: SidePanelPageRegistration[];
  standalonePages?: StandalonePageRegistration[];
  addonSettings?: z.ZodSchema<unknown>;
  keymap?: KeymapRegistration[];
}
