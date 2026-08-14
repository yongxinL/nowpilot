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
import { NoteGraphView } from '@/components/notes/NoteGraphView';
import { STR } from '@/core/i18n/strings';

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
