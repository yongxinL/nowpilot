// tests/components/notes/NoteGraphView.test.tsx — Phase 5 (05-08, D-05-17,
// KNW-02, UI-SPEC Graph visual contract): the d3-force NoteGraphView renders
// the DERIVED graph (edges from NoteGraph.edges — never parse-at-render),
// states per the §12 matrix (<3 → STR.notes.graphEmpty and NO simulation is
// constructed, loading → graphLoading + Skeleton, error → graphFailed +
// Retry), theme-token colors (never hex), reduced-motion tick-stepping, and
// click-to-open. Tests stub matchMedia to 'reduce' so the simulation runs to
// equilibrium SYNCHRONOUSLY (simulation.tick(300) → final layout → stop) —
// jsdom never awaits real simulation ticks (Pitfall 6 — no rAF, no hang).
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteGraphView, phyllotaxisLayout } from '@/components/notes/NoteGraphView';
import type { NoteGraphNode } from '@/components/notes/NoteGraphView';
import { STR } from '@/core/i18n/strings';

// ---------------------------------------------------------------------------
// IN-04 (05-10): observability seam over d3-force — the refresh regression
// asserts the simulation's INITIAL (pre-tick) state, so the mock CLONES each
// node's { id, x, y } at forceSimulation CALL time and then delegates to the
// real implementation (the suite still runs REAL d3-force — existing tests
// unchanged, only observability added; the clone is mandatory because d3-force
// mutates the node objects IN PLACE, so any post-tick read sees equilibrium
// values, not the seeded pre-tick state).
// ---------------------------------------------------------------------------
const { simulatedInitialStates } = vi.hoisted(() => ({
  simulatedInitialStates: [] as Array<Array<{ id: string; x?: number; y?: number }>>,
}));

vi.mock('d3-force', async (importOriginal) => {
  const actual = await importOriginal<typeof import('d3-force')>();
  return {
    ...actual,
    forceSimulation: vi.fn((nodes: unknown) => {
      simulatedInitialStates.push(
        (nodes as Array<{ id: string; x?: number; y?: number }>).map((n) => ({
          id: n.id,
          x: n.x,
          y: n.y,
        })),
      );
      // Delegate to the real d3-force implementation (the suite still runs
      // REAL d3-force — only observability added). The mock's unknown-typed
      // parameter crosses the module boundary, hence the boundary cast.
      return actual.forceSimulation(nodes as Parameters<typeof actual.forceSimulation>[0]);
    }),
  };
});

/** prefers-reduced-motion: reduce stub — the synchronous final-layout path. */
function stubReducedMotion(): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

/** prefers-reduced-motion: no-preference stub — the tick-event path. In jsdom
    no simulation tick ever fires on this path (d3-timer's 17 ms fallback only
    fires when the event loop yields), so `positions` cannot move between the
    rerender and the synchronous assertions. */
function stubNoReducedMotion(): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

interface NodeFixture {
  id: string;
  title: string;
  links: string[];
}

function makeNode(id: string, title: string, links: string[] = []): NodeFixture {
  return { id, title, links };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NoteGraphView — states (spec §12 NoteGraph row)', () => {
  it('< 3 notes (0, 1, 2) → STR.notes.graphEmpty and NO <svg> simulation renders', () => {
    const onOpen = vi.fn();
    for (const count of [0, 1, 2]) {
      const notes = Array.from({ length: count }, (_, i) => makeNode(`n${i}`, `Note ${i}`));
      const { unmount } = render(<NoteGraphView notes={notes} onOpenNote={onOpen} />);
      expect(screen.getByText(STR.notes.graphEmpty)).toBeTruthy();
      // The simulation is NEVER rendered below 3 nodes (zero-one-many E5).
      expect(document.querySelector('[data-np-graph-svg]')).toBeNull();
      expect(document.querySelector('[data-np-graph-node]')).toBeNull();
      unmount();
    }
  });

  it('loading → STR.notes.graphLoading + Skeleton', () => {
    const onOpen = vi.fn();
    render(<NoteGraphView notes={[]} loading onOpenNote={onOpen} />);
    expect(screen.getByText(STR.notes.graphLoading)).toBeTruthy();
    expect(document.querySelector('.ant-skeleton')).not.toBeNull();
    expect(document.querySelector('[data-np-graph-svg]')).toBeNull();
  });

  it('error → STR.notes.graphFailed + Retry fires onRetry', () => {
    const onOpen = vi.fn();
    const onRetry = vi.fn();
    render(<NoteGraphView notes={[]} error onRetry={onRetry} onOpenNote={onOpen} />);
    expect(screen.getByText(STR.notes.graphFailed.split(' [')[0])).toBeTruthy();
    fireEvent.click(screen.getByText(STR.chat.retry));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('NoteGraphView — derived graph rendering (D-05-17)', () => {
  // Four notes: Alpha↔Beta (2 edges), Gamma + Delta isolated (degree 0).
  const FIXTURE = [
    makeNode('alpha', 'Alpha', ['beta']),
    makeNode('beta', 'Beta', ['alpha']),
    makeNode('gamma', 'Gamma'),
    makeNode('delta', 'Delta'),
  ];

  it('4 notes with 2 edges → svg renders 4 node groups + 2 edge lines; the selected node circle carries the selected marker', () => {
    stubReducedMotion();
    const onOpen = vi.fn();
    render(<NoteGraphView notes={FIXTURE} selectedNoteId="beta" onOpenNote={onOpen} />);
    const svg = document.querySelector('[data-np-graph-svg]');
    expect(svg).not.toBeNull();
    expect(document.querySelectorAll('[data-np-graph-node]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-np-graph-edge]')).toHaveLength(2);
    // Selected node ('beta') carries the selected marker on its circle.
    const betaGroup = document.querySelector('[data-np-graph-node="beta"]');
    expect(betaGroup).not.toBeNull();
    expect(betaGroup!.querySelector('[data-np-graph-selected="1"]')).not.toBeNull();
    expect(
      document.querySelector('[data-np-graph-node="alpha"] [data-np-graph-selected]'),
    ).toBeNull();
  });

  it('reduced-motion path: matchMedia reduce → final layout renders synchronously (tick(300), no rAF) with circle cx/cy present', () => {
    stubReducedMotion();
    const onOpen = vi.fn();
    render(<NoteGraphView notes={FIXTURE} onOpenNote={onOpen} />);
    // All node circles carry a resolved position — the tick(300) final-layout
    // path ran synchronously (no awaited simulation ticks).
    const circles = document.querySelectorAll('[data-np-graph-node] circle');
    expect(circles.length).toBe(4);
    for (const circle of Array.from(circles)) {
      expect(circle.getAttribute('cx')).not.toBeNull();
      expect(circle.getAttribute('cy')).not.toBeNull();
      expect(Number.isNaN(Number(circle.getAttribute('cx')))).toBe(false);
      expect(Number.isNaN(Number(circle.getAttribute('cy')))).toBe(false);
    }
  });

  it('node click → onOpenNote with the clicked note id (fireEvent on the node group)', () => {
    stubReducedMotion();
    const onOpen = vi.fn();
    render(<NoteGraphView notes={FIXTURE} onOpenNote={onOpen} />);
    const node = document.querySelector('[data-np-graph-node="gamma"]');
    expect(node).not.toBeNull();
    fireEvent.click(node!);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('gamma');
  });
});

describe('NoteGraphView — IN-04 deterministic layout + position preservation (05-10)', () => {
  // Same 4-node fixture as above: alpha↔beta linked, gamma + delta isolated.
  const FIXTURE = [
    makeNode('alpha', 'Alpha', ['beta']),
    makeNode('beta', 'Beta', ['alpha']),
    makeNode('gamma', 'Gamma'),
    makeNode('delta', 'Delta'),
  ];

  const VIEW_W = 800;
  const VIEW_H = 600;

  it('phyllotaxisLayout is deterministic and in-view (IN-04): identical maps, every node within the viewBox, not all at (0,0)', () => {
    const notes: NoteGraphNode[] = FIXTURE.map((n) => ({
      id: n.id,
      title: n.title,
      selected: false,
      degree: n.links.length,
    }));
    const first = phyllotaxisLayout(notes);
    const second = phyllotaxisLayout(notes);
    expect(first).toEqual(second); // deterministic — same input, same map
    expect(first.size).toBe(4);
    for (const node of notes) {
      const pos = first.get(node.id);
      expect(pos).toBeDefined();
      // In-view: within [0, VIEW_W] × [0, VIEW_H].
      expect(pos!.x).toBeGreaterThanOrEqual(0);
      expect(pos!.x).toBeLessThanOrEqual(VIEW_W);
      expect(pos!.y).toBeGreaterThanOrEqual(0);
      expect(pos!.y).toBeLessThanOrEqual(VIEW_H);
    }
    // Not all at (0,0) — the fallback is a real layout, not the origin flash.
    const xs = [...first.values()].map((p) => p.x);
    const ys = [...first.values()].map((p) => p.y);
    expect(xs.some((x) => x !== 0)).toBe(true);
    expect(ys.some((y) => y !== 0)).toBe(true);
  });

  it('first render without ticks shows the phyllotaxis fallback, never (0,0) (IN-04)', () => {
    // NO reduced-motion stub: matchMedia matches:false in jsdom → the tick-event
    // path, where no simulation tick ever fires before the assertions — the
    // pre-tick frame renders the deterministic phyllotaxis layout.
    const onOpen = vi.fn();
    render(<NoteGraphView notes={FIXTURE} onOpenNote={onOpen} />);
    const circles = document.querySelectorAll('[data-np-graph-node] circle');
    expect(circles.length).toBe(4);
    for (const circle of Array.from(circles)) {
      expect(Number(circle.getAttribute('cx'))).not.toBe(0);
      expect(Number(circle.getAttribute('cy'))).not.toBe(0);
    }
  });

  it('positions survive a list refresh: pre-tick seed assertion + first-frame continuity (IN-04)', () => {
    // Set up: reduced-motion stub runs the REAL d3-force to equilibrium
    // synchronously; capture each pre-existing node's equilibrium cx/cy.
    stubReducedMotion();
    const onOpen = vi.fn();
    const view = render(<NoteGraphView notes={FIXTURE} onOpenNote={onOpen} />);
    const prevPositions = new Map<string, { x: number; y: number }>();
    for (const node of FIXTURE) {
      const circle = document.querySelector(
        `[data-np-graph-node="${node.id}"] circle`,
      ) as SVGCircleElement | null;
      expect(circle).not.toBeNull();
      prevPositions.set(node.id, {
        x: Number(circle!.getAttribute('cx')),
        y: Number(circle!.getAttribute('cy')),
      });
    }

    // Refresh: add a linked note (epsilon → alpha) and change beta's title.
    const updated = [...FIXTURE, makeNode('epsilon', 'Epsilon', ['alpha'])];
    const updatedNotes: NoteGraphNode[] = updated.map((n) => ({
      id: n.id,
      title: n.title === 'Beta' ? 'Beta renamed' : n.title,
      selected: false,
      degree: n.links.length,
    }));
    // Swap to a non-reduce stub: in jsdom no simulation tick ever fires on the
    // tick-event path, so the `positions` state cannot move before the
    // assertions — the first post-refresh frame renders the PRESERVED map.
    stubNoReducedMotion();
    simulatedInitialStates.length = 0; // only the refresh simulation matters
    view.rerender(<NoteGraphView notes={updated} onOpenNote={onOpen} />);

    // FIRST FRAME (b): every pre-existing node circle renders at EXACTLY its
    // previous coordinates (strict toBe — the commit renders the unchanged
    // positions map; no jump, no (0,0) flash). The added node renders at
    // origin for that one frame — do NOT assert it.
    for (const node of FIXTURE) {
      const circle = document.querySelector(
        `[data-np-graph-node="${node.id}"] circle`,
      ) as SVGCircleElement | null;
      expect(Number(circle!.getAttribute('cx'))).toBe(prevPositions.get(node.id)!.x);
      expect(Number(circle!.getAttribute('cy'))).toBe(prevPositions.get(node.id)!.y);
    }

    // MECHANISM (a): the refresh simulation's initial (pre-tick) state — the
    // d3-force wrapper cloned each node at forceSimulation CALL time, BEFORE
    // any in-place equilibrium mutation. Every pre-existing node id was seeded
    // from the previous positions (=== the same source values, strict toBe);
    // the added node was seeded from the same pure phyllotaxisLayout function
    // the render fallback uses (identical floats — same input, same map).
    const refreshInitial = simulatedInitialStates.at(-1);
    expect(refreshInitial).toBeDefined();
    for (const node of FIXTURE) {
      const seeded = refreshInitial!.find((n) => n.id === node.id);
      expect(seeded?.x).toBe(prevPositions.get(node.id)!.x);
      expect(seeded?.y).toBe(prevPositions.get(node.id)!.y);
    }
    const epsilonSeeded = refreshInitial!.find((n) => n.id === 'epsilon');
    const epsilonPhyllotaxis = phyllotaxisLayout(updatedNotes).get('epsilon');
    expect(epsilonSeeded?.x).toBe(epsilonPhyllotaxis!.x);
    expect(epsilonSeeded?.y).toBe(epsilonPhyllotaxis!.y);
  });
});
