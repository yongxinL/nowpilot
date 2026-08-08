// src/entrypoints/background.ts — §5.1 canonical background service worker
// (BLOCKER 3: replaces the 01-01 scaffold stub body; canonical shape, spec
// lines 858-872). All four managers register SYNCHRONOUSLY at module load —
// DONE-when (§18 line 2559: "Background router registers listeners
// synchronously"; §5.2 line 906) — with NO await before listener registration.
//
// R-3: the SW does PROXY_FETCH / alarms / context menus / CORS proxy only —
// no AI, no IndexedDB. Dependency-free core (Pitfall 4): no React, no antd.
import { BackgroundRouter } from '@/core/background/BackgroundRouter';
import { ContextMenuHost } from '@/core/background/ContextMenuHost';
import { KeepAliveManager } from '@/core/background/KeepAliveManager';
import { LifecycleManager } from '@/core/background/LifecycleManager';

export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    // Synchronous listener registration (DONE-when): the first statement that
    // could await is none — every manager wires its listeners inline.
    BackgroundRouter.register();
    LifecycleManager.register();
    KeepAliveManager.register();
    ContextMenuHost.recreateAll();
  },
});
