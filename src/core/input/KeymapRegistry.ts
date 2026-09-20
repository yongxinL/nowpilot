export interface KeymapRegistration {
  id: string;
  keys: string;
  handler: () => void;
  description: string;
}

const keymaps = new Map<string, KeymapRegistration>();
const keydownListener = (e: KeyboardEvent): void => {
  for (const keymap of keymaps.values()) {
    const modifiers = keymap.keys.split('+');
    const key = modifiers.pop()?.toLowerCase();
    const ctrl = modifiers.includes('Control') || modifiers.includes('Cmd');
    const shift = modifiers.includes('Shift');
    const alt = modifiers.includes('Alt');
    const meta = modifiers.includes('Meta');

    if (
      key === e.key.toLowerCase() &&
      ctrl === (e.ctrlKey || e.metaKey) &&
      shift === e.shiftKey &&
      alt === e.altKey &&
      meta === e.metaKey
    ) {
      e.preventDefault();
      try {
        keymap.handler();
      } catch {
        // swallow
      }
      return;
    }
  }
};

let listening = false;

export const KeymapRegistry = {
  register(keymap: KeymapRegistration): void {
    if (keymaps.has(keymap.id)) {
      throw new Error(`Keymap conflict: ${keymap.id} already registered`);
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
