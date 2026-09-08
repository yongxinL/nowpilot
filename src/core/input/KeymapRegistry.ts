import { Registry } from '@/core/registry/Registry';

export type KeymapWhen = 'always' | 'in-composer' | 'in-note' | 'in-side-panel' | 'in-standalone';
export type KeymapEnv = 'sidepanel' | 'standalone' | 'composer' | 'note';

export interface KeymapRegistration {
  id: string;
  when?: KeymapWhen;
  combo: string;
  description: string;
  handlerId: string;
}

function matchesWhen(when: KeymapWhen | undefined, env: KeymapEnv | undefined): boolean {
  if (!when || when === 'always') return true;
  if (!env) return false;
  switch (when) {
    case 'in-composer':
      return env === 'composer';
    case 'in-note':
      return env === 'note';
    case 'in-side-panel':
      return env === 'sidepanel';
    case 'in-standalone':
      return env === 'standalone';
    default:
      return false;
  }
}

class KeymapRegistryClass {
  private reg = new Registry<KeymapRegistration>();

  register(registration: KeymapRegistration): void {
    if (this.reg.has(registration.id)) return;
    this.reg.register(registration.id, registration);
  }

  get(combo: string): KeymapRegistration | undefined {
    return this.reg.getAll().find((k) => k.combo === combo);
  }

  resolve(combo: string, env?: KeymapEnv): KeymapRegistration | undefined {
    const found = this.get(combo);
    if (!found) return undefined;
    return matchesWhen(found.when, env) ? found : undefined;
  }

  list(): KeymapRegistration[] {
    return this.reg.getAll();
  }

  clear(): void {
    this.reg.clear();
  }
}

export const KeymapRegistry = new KeymapRegistryClass();

export function registerDefaultKeymaps(): void {
  KeymapRegistry.register({
    id: 'command-palette.toggle',
    combo: 'mod+k',
    description: 'Open command palette',
    handlerId: 'command-palette.open',
    when: 'always',
  });
}
