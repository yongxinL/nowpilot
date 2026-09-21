export interface KeymapRegistration {
  id: string;
  keys: string;
  handler: () => void;
  description: string;
}

/**
 * The registration tokens that name the **platform-primary** modifier.
 *
 * A registration may spell the chord `Cmd+K`, `Command+K`, `Control+K` or
 * `Meta+K`; all four mean "the platform's primary modifier" — `metaKey` on
 * macOS, `ctrlKey` elsewhere. The matcher compares the resolved primary
 * against `e.metaKey || e.ctrlKey`, never against one physical key.
 *
 * Defect this replaces: the previous predicate compared `meta === e.metaKey`
 * where `meta` was true only for the literal token `Meta`. A `Cmd+K`
 * registration therefore could not match on macOS (`Cmd` sets `e.metaKey`, it
 * never sets a `Meta` token), so the palette would never have opened on the
 * primary development platform (RESEARCH Pitfall 2).
 */
export const PRIMARY_TOKENS: ReadonlySet<string> = new Set([
  'Control',
  'Cmd',
  'Command',
  'Meta',
]);

/**
 * Match a registration string against a keyboard event.
 *
 * The last `+`-separated part is the key (lower-cased); any leading part in
 * `PRIMARY_TOKENS` marks the primary modifier. `Shift` and `Alt` are strict
 * exact matches: a registration without `Shift` does not fire while `Shift`
 * is held, and a registration with `Shift` does not fire without it.
 */
export function matchesKeymap(keys: string, e: KeyboardEvent): boolean {
  const parts = keys.split('+');
  const key = parts.pop()?.toLowerCase();
  const primary = parts.some((part) => PRIMARY_TOKENS.has(part));
  const shift = parts.includes('Shift');
  const alt = parts.includes('Alt');

  return (
    key === e.key.toLowerCase() &&
    primary === (e.metaKey || e.ctrlKey) &&
    shift === e.shiftKey &&
    alt === e.altKey
  );
}

/**
 * The canonical duplicate-binding failure: `KEYMAP_CONFLICT` (PRODUCT_SPEC
 * §21.6). A conflict is **never** silently resolved and never resolved
 * first-wins — the second registration does not land (T-1-38).
 */
export class KeymapConflictError extends Error {
  readonly code = 'KEYMAP_CONFLICT';
  readonly keymapId: string;

  constructor(keymapId: string) {
    super(`Keymap conflict: ${keymapId} already registered`);
    this.name = 'KeymapConflictError';
    this.keymapId = keymapId;
  }
}

const keymaps = new Map<string, KeymapRegistration>();

const keydownListener = (e: KeyboardEvent): void => {
  for (const keymap of keymaps.values()) {
    if (!matchesKeymap(keymap.keys, e)) continue;

    // preventDefault runs before the handler so the browser default never
    // fires alongside the command.
    e.preventDefault();
    try {
      keymap.handler();
    } catch {
      // Swallow the handler's failure and keep evaluating the remaining
      // registrations: one broken handler must not disable the others.
      continue;
    }
    // The first successful handler owns the event.
    return;
  }
};

let listening = false;

export const KeymapRegistry = {
  register(keymap: KeymapRegistration): void {
    if (keymaps.has(keymap.id)) {
      throw new KeymapConflictError(keymap.id);
    }
    keymaps.set(keymap.id, keymap);
    if (!listening && typeof document !== 'undefined') {
      document.addEventListener('keydown', keydownListener);
      listening = true;
    }
  },

  unregister(id: string): void {
    keymaps.delete(id);
    if (keymaps.size === 0 && listening) {
      document.removeEventListener('keydown', keydownListener);
      listening = false;
    }
  },

  getAll(): KeymapRegistration[] {
    return Array.from(keymaps.values());
  },
};
