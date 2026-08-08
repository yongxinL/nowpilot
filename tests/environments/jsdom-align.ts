// tests/environments/jsdom-align.ts — jsdom with realm-aligned codecs.
//
// WHY (01-04 Rule 3): Vitest's builtin jsdom setup overrides
// globalThis.Uint8Array (it is in LIVING_KEYS, so populateGlobal replaces it
// with the jsdom-window-realm constructor), but globalThis.TextEncoder is NOT
// an own window property, so it stays Node's realm — a Node TextEncoder's
// encode() returns Node-realm Uint8Arrays, which fail
// `... instanceof Uint8Array` against the jsdom-realm global. esbuild 0.25's
// load-time invariant `new TextEncoder().encode("") instanceof Uint8Array`
// then throws whenever esbuild loads after the environment is populated
// (vitest loads it at the tail of the environment phase — after setup(),
// before setupFiles, so a setup.ts alignment is too late). This wrapper probes
// the actual encoder output realm and pins the global Uint8Array binding (via
// populateGlobal's setter) to it, so every later esbuild load passes the
// invariant. TextEncoder/TextDecoder are aligned to the same realm for
// consistency.
import { builtinEnvironments, type Environment } from 'vitest/runtime';
import { TextEncoder as NodeTextEncoder } from 'node:util';

const jsdomEnv = builtinEnvironments.jsdom as Environment;

const jsdomAlign: Environment = {
  name: 'jsdom-align',
  viteEnvironment: 'client',
  async setup(global: typeof globalThis, options: Record<string, any>) {
    const jsdomTeardown = await jsdomEnv.setup!(global, options);
    const win = global.window as (Window & typeof globalThis) | undefined;
    if (win && typeof win.TextEncoder === 'function') {
      global.TextEncoder = win.TextEncoder;
      global.TextDecoder = win.TextDecoder;
      // Probe the realm the encoder actually produces and pin the global
      // Uint8Array to it — this is the invariant esbuild 0.25 checks at load.
      const probe = new (win.TextEncoder as typeof NodeTextEncoder)().encode('');
      const probeCtor = probe.constructor as typeof Uint8Array;
      if (typeof probeCtor === 'function') global.Uint8Array = probeCtor;
    }
    return {
      async teardown(globalForTeardown: typeof globalThis) {
        await jsdomTeardown?.teardown?.(globalForTeardown);
      },
    };
  },
};

export default jsdomAlign;
