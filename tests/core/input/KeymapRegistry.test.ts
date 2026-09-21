import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * FLOW-8 / SP-09 / SA-09 — `KeymapRegistry` is the only global keyboard owner.
 *
 * Three properties are pinned here, and none of them can be proven anywhere
 * else in the suite:
 *
 *   1. **The chord works on the primary development platform.** The prototype
 *      predicate compared `meta === e.metaKey` where `meta` was only true for
 *      the literal token `Meta`, so `Cmd+K` could never match on macOS
 *      (RESEARCH Pitfall 2). The registration token names the *platform-primary*
 *      modifier, never the physical meta key.
 *   2. **A duplicate id is a typed conflict.** The throw carries the canonical
 *      `KEYMAP_CONFLICT` code (§21.6); it is never silently resolved and never
 *      resolved first-wins (T-1-38).
 *   3. **No ad-hoc global listener remains.** The source scan over
 *      `src/entrypoints/**` fails the moment a keyboard listener is
 *      reintroduced there (T-1-39) — two listeners would toggle the palette
 *      twice and make the conflict guard meaningless.
 *
 * Each case gets a fresh module instance (`vi.resetModules()` + dynamic
 * re-import) so the module `Map` and the listener lifecycle are observed from
 * zero; the `afterEach` unregisters everything the case registered, so no
 * listener outlives its case.
 */

type RegistryModule = typeof import('../../../src/core/input/KeymapRegistry');

const REGISTRY_SPEC = '../../../src/core/input/KeymapRegistry';

let registry: RegistryModule | null = null;
let registeredIds: string[] = [];
let addListenerSpy: ReturnType<typeof vi.spyOn> | null = null;
let removeListenerSpy: ReturnType<typeof vi.spyOn> | null = null;

async function freshRegistry(): Promise<RegistryModule> {
  vi.resetModules();
  addListenerSpy = vi.spyOn(document, 'addEventListener');
  removeListenerSpy = vi.spyOn(document, 'removeEventListener');
  registry = (await import(REGISTRY_SPEC)) as RegistryModule;
  return registry;
}

function register(
  mod: RegistryModule,
  registration: { id: string; keys: string; handler: () => void },
): void {
  mod.KeymapRegistry.register({ description: `binding ${registration.id}`, ...registration });
  registeredIds.push(registration.id);
}

afterEach(() => {
  for (const id of registeredIds) {
    registry?.KeymapRegistry.unregister(id);
  }
  registeredIds = [];
  registry = null;
  vi.restoreAllMocks();
  addListenerSpy = null;
  removeListenerSpy = null;
});

interface SpiedKeyEvent {
  event: KeyboardEvent;
  preventDefault: ReturnType<typeof vi.fn>;
  order: string[];
}

/**
 * A real `KeyboardEvent` dispatched on `document`, with `preventDefault`
 * instrumented so a case can assert both the call and its ordering relative
 * to the handler. The original implementation still runs, so
 * `defaultPrevented` remains observable.
 */
function keyEvent(init: KeyboardEventInit, order: string[]): SpiedKeyEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  const original = event.preventDefault.bind(event);
  const preventDefault = vi.fn(() => {
    order.push('preventDefault');
    original();
  });
  Object.defineProperty(event, 'preventDefault', { configurable: true, value: preventDefault });
  return { event, preventDefault, order };
}

function keydownAdds(): unknown[][] {
  return (addListenerSpy?.mock.calls ?? []).filter(([type]) => type === 'keydown');
}

function keydownRemoves(): unknown[][] {
  return (removeListenerSpy?.mock.calls ?? []).filter(([type]) => type === 'keydown');
}

describe('KeymapRegistry — platform-primary matching (FLOW-8, SP-09)', () => {
  it('fires Cmd+K when the platform reports the meta key (macOS), preventDefault first', async () => {
    const mod = await freshRegistry();
    const order: string[] = [];
    const handler = vi.fn(() => {
      order.push('handler');
    });
    register(mod, { id: 'palette', keys: 'Cmd+K', handler });

    const { event, preventDefault } = keyEvent({ key: 'k', metaKey: true }, order);
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['preventDefault', 'handler']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('fires the same Cmd+K registration when the platform reports the control key (Windows/Linux)', async () => {
    const mod = await freshRegistry();
    const order: string[] = [];
    const handler = vi.fn(() => {
      order.push('handler');
    });
    register(mod, { id: 'palette', keys: 'Cmd+K', handler });

    const { event, preventDefault } = keyEvent({ key: 'k', ctrlKey: true }, order);
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['preventDefault', 'handler']);
  });

  it('does not fire Cmd+K for an event with no modifier held', async () => {
    const mod = await freshRegistry();
    const order: string[] = [];
    const handler = vi.fn(() => {
      order.push('handler');
    });
    register(mod, { id: 'palette', keys: 'Cmd+K', handler });

    const { event, preventDefault } = keyEvent({ key: 'k' }, order);
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not fire Cmd+K while Shift is held — Shift is a strict exact match', async () => {
    const mod = await freshRegistry();
    const order: string[] = [];
    const handler = vi.fn(() => {
      order.push('handler');
    });
    register(mod, { id: 'palette', keys: 'Cmd+K', handler });

    const { event } = keyEvent({ key: 'k', metaKey: true, shiftKey: true }, order);
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('fires Cmd+Shift+K only when the shift key is held', async () => {
    const mod = await freshRegistry();
    const order: string[] = [];
    const handler = vi.fn(() => {
      order.push('handler');
    });
    register(mod, { id: 'palette-shift', keys: 'Cmd+Shift+K', handler });

    const withoutShift = keyEvent({ key: 'k', metaKey: true }, order);
    document.dispatchEvent(withoutShift.event);
    expect(handler).not.toHaveBeenCalled();

    const withShift = keyEvent({ key: 'k', metaKey: true, shiftKey: true }, order);
    document.dispatchEvent(withShift.event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('treats Control, Cmd, Command and Meta as the same platform-primary token', async () => {
    const mod = await freshRegistry();
    const tokens = ['Control', 'Cmd', 'Command', 'Meta'];
    const metaHeld = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    const controlHeld = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    const noneHeld = new KeyboardEvent('keydown', { key: 'k' });

    for (const token of tokens) {
      expect(mod.PRIMARY_TOKENS.has(token), `PRIMARY_TOKENS must carry ${token}`).toBe(true);
      expect(
        mod.matchesKeymap(`${token}+K`, metaHeld),
        `${token}+K must resolve to the platform-primary modifier`,
      ).toBe(true);
      expect(mod.matchesKeymap(`${token}+K`, controlHeld), `${token}+K`).toBe(true);
      expect(mod.matchesKeymap(`${token}+K`, noneHeld), `${token}+K`).toBe(false);
    }
  });

  it('matches a bare key only when no modifier is held', async () => {
    const mod = await freshRegistry();
    const handler = vi.fn();
    register(mod, { id: 'bare', keys: 'K', handler });

    document.dispatchEvent(keyEvent({ key: 'k' }, []).event);
    expect(handler).toHaveBeenCalledTimes(1);

    document.dispatchEvent(keyEvent({ key: 'k', metaKey: true }, []).event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores a different key even when the primary modifier is held', async () => {
    const mod = await freshRegistry();
    const handler = vi.fn();
    register(mod, { id: 'palette', keys: 'Cmd+K', handler });

    document.dispatchEvent(keyEvent({ key: 'j', metaKey: true }, []).event);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('KeymapRegistry — conflict, lifecycle and handler isolation', () => {
  it('throws a typed KEYMAP_CONFLICT error on a duplicate id and keeps the first binding', async () => {
    const mod = await freshRegistry();
    const first = vi.fn();
    register(mod, { id: 'palette', keys: 'Cmd+K', handler: first });

    const duplicate = vi.fn();
    let thrown: unknown;
    try {
      mod.KeymapRegistry.register({
        id: 'palette',
        keys: 'Cmd+J',
        description: 'duplicate',
        handler: duplicate,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(mod.KeymapConflictError);
    expect((thrown as { code?: string }).code).toBe('KEYMAP_CONFLICT');
    expect((thrown as Error).message).toContain('palette');

    // The conflict is not silently resolved: one binding per id, first-wins is
    // not the behaviour — the second registration never lands.
    expect(mod.KeymapRegistry.getAll()).toHaveLength(1);
    document.dispatchEvent(keyEvent({ key: 'j', metaKey: true }, []).event);
    expect(duplicate).not.toHaveBeenCalled();
    document.dispatchEvent(keyEvent({ key: 'k', metaKey: true }, []).event);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('unregisters a binding and detaches the single document listener when the map empties', async () => {
    const mod = await freshRegistry();
    register(mod, { id: 'palette', keys: 'Cmd+K', handler: vi.fn() });
    expect(mod.KeymapRegistry.getAll()).toHaveLength(1);
    expect(keydownAdds()).toHaveLength(1);

    mod.KeymapRegistry.unregister('palette');
    registeredIds = [];

    expect(mod.KeymapRegistry.getAll()).toEqual([]);
    expect(keydownRemoves()).toHaveLength(1);
    // Same function identity added and removed — no listener is orphaned.
    expect(keydownRemoves()[0][1]).toBe(keydownAdds()[0][1]);
  });

  it('holds exactly one document keydown listener across repeated register/unregister cycles', async () => {
    const mod = await freshRegistry();

    for (let cycle = 0; cycle < 5; cycle += 1) {
      register(mod, { id: `cycle-${cycle}`, keys: 'Cmd+K', handler: vi.fn() });
      mod.KeymapRegistry.unregister(`cycle-${cycle}`);
      registeredIds = [];
    }

    register(mod, { id: 'final', keys: 'Cmd+K', handler: vi.fn() });

    const net = keydownAdds().length - keydownRemoves().length;
    expect(net).toBe(1);
    expect(mod.KeymapRegistry.getAll()).toHaveLength(1);
    // Every attach used the same listener function — a re-created listener
    // would leak one per cycle.
    expect(new Set(keydownAdds().map(([, fn]) => fn)).size).toBe(1);
  });

  it('swallows a throwing handler and still evaluates later matching registrations', async () => {
    const mod = await freshRegistry();
    const throwing = vi.fn(() => {
      throw new Error('handler exploded');
    });
    const later = vi.fn();
    register(mod, { id: 'throwing', keys: 'Cmd+K', handler: throwing });
    register(mod, { id: 'later', keys: 'Cmd+K', handler: later });

    expect(() =>
      document.dispatchEvent(keyEvent({ key: 'k', metaKey: true }, []).event),
    ).not.toThrow();

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('getAll() returns the live registrations in registration order', async () => {
    const mod = await freshRegistry();
    register(mod, { id: 'first', keys: 'Cmd+K', handler: vi.fn() });
    register(mod, { id: 'second', keys: 'Cmd+J', handler: vi.fn() });

    expect(mod.KeymapRegistry.getAll().map((k) => k.id)).toEqual(['first', 'second']);
  });
});

describe('KeymapRegistry — no ad-hoc global listener remains (FLOW-8, T-1-39)', () => {
  const KEYBOARD_LISTENER_RE =
    /addEventListener\(\s*['"`](?:keydown|keyup|keypress)['"`]|on(?:keydown|keyup|keypress)\s*=/;

  function walkSourceFiles(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...walkSourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
    return found;
  }

  it('finds zero global keyboard-listener registrations under src/entrypoints', () => {
    const root = join(process.cwd(), 'src', 'entrypoints');
    const files = walkSourceFiles(root);

    // Positive control: a scan over a missing/empty tree would pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .filter((file) => KEYBOARD_LISTENER_RE.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('the scan pattern has teeth — it catches every reintroduction spelling', () => {
    expect(KEYBOARD_LISTENER_RE.test("window.addEventListener('keydown', onKey)")).toBe(true);
    expect(KEYBOARD_LISTENER_RE.test('document.addEventListener("keypress", onKey)')).toBe(true);
    expect(KEYBOARD_LISTENER_RE.test('document.onkeydown = onKey')).toBe(true);
    expect(KEYBOARD_LISTENER_RE.test("window.addEventListener('resize', onResize)")).toBe(false);
  });
});
