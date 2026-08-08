// src/core/input/KeymapRegistry.ts — canonical §18 path (spec line 2441; NOT
// src/core/prompts/). Source: Appendix C KeymapRegistration type (lines
// 4353-4361) + Flow 8 (line 1698: "KeymapRegistry global keydown listener →
// handler → preventDefault"). Constants only — no UI logic. Phase 1 commands
// only (D-15).
export interface KeymapRegistration {
  id: string;
  when?: 'always' | 'in-composer' | 'in-note' | 'in-side-panel' | 'in-standalone';
  combo: string;
  description: string;
  handlerId: string;
}

/** Canonical Phase-1 shortcut constants (mod = Cmd on macOS, Ctrl elsewhere). */
export const KEYMAP = {
  CMD_K: 'mod+k',
  CMD_N: 'mod+n',
  CMD_B: 'mod+b',
  ESC: 'Escape',
  CMD_ENTER: 'mod+Enter',
} as const;

export type KeymapCombo = (typeof KEYMAP)[keyof typeof KEYMAP];

/** True when the event is the Cmd+K (macOS) / Ctrl+K (elsewhere) shortcut. */
export function isCmdK(e: KeyboardEvent): boolean {
  const kPressed = e.key.toLowerCase() === 'k';
  return (e.metaKey || e.ctrlKey) && kPressed;
}
