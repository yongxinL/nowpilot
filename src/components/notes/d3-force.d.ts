// src/components/notes/d3-force.d.ts — Phase 5 (05-08, Rule 3 deviation):
// d3-force ^3 ships NO TypeScript types (verified: no @types/d3-force on the
// approved stack — AGENTS.md §7 "do not install anything else" — and the
// package's exports map exposes only JS entry points). This minimal ambient
// declaration covers the FOUR CITED force primitives used by NoteGraphView
// (RESEARCH Common Operation 4 — d3js.org/d3-force API) with the typed usage
// the plan mandates (forceLink<NoteGraphNode, NoteGraphLink>). Members are
// declared as method shorthand so parameter bivariance applies: untyped calls
// (forceManyBody(), forceCenter()) resolve NodeDatum to the SimulationNodeDatum
// constraint and stay assignable to the simulation's typed Force slots under
// strictFunctionTypes. Co-located with the only consumer — the R-3 isolation
// story (d3-force lives exclusively in the Standalone Notes bundle) stays
// intact: this file contains types only, no runtime import.
declare module 'd3-force' {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }

  export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
    source: NodeDatum | string | number;
    target: NodeDatum | string | number;
  }

  export interface Force<
    NodeDatum extends SimulationNodeDatum,
    _LinkDatum extends SimulationLinkDatum<NodeDatum>,
  > {
    (alpha: number): void;
    initialize?(nodes: NodeDatum[]): void;
  }

  export interface ForceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  > extends Force<NodeDatum, LinkDatum> {
    links(links: LinkDatum[]): this;
    id(accessor: (node: NodeDatum, index: number) => string | number): this;
    distance(distance: number | ((link: LinkDatum, index: number) => number)): this;
  }

  export interface ForceManyBody<NodeDatum extends SimulationNodeDatum> extends Force<
    NodeDatum,
    SimulationLinkDatum<NodeDatum>
  > {
    strength(strength: number | ((node: NodeDatum, index: number) => number)): this;
  }

  export interface ForceCenter<NodeDatum extends SimulationNodeDatum> extends Force<
    NodeDatum,
    SimulationLinkDatum<NodeDatum>
  > {
    x(x: number): this;
    y(y: number): this;
  }

  export interface Simulation<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  > {
    nodes(): NodeDatum[];
    nodes(nodes: NodeDatum[]): this;
    force(name: string): Force<NodeDatum, LinkDatum> | undefined;
    force(name: string, force: Force<NodeDatum, LinkDatum> | null): this;
    tick(iterations?: number): this;
    stop(): this;
    on(
      typenames: string,
      listener: ((this: Simulation<NodeDatum, LinkDatum>, event: unknown) => void) | null,
    ): this;
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(
    nodes?: NodeDatum[],
  ): Simulation<NodeDatum, SimulationLinkDatum<NodeDatum>>;
  export function forceLink<
    NodeDatum extends SimulationNodeDatum,
    LinkDatum extends SimulationLinkDatum<NodeDatum>,
  >(links?: LinkDatum[]): ForceLink<NodeDatum, LinkDatum>;
  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>;
  export function forceCenter<NodeDatum extends SimulationNodeDatum>(
    x?: number,
    y?: number,
  ): ForceCenter<NodeDatum>;
}
