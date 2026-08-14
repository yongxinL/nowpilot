// src/components/notes/NoteGraphView.tsx — Phase 5 (05-08, D-05-17, KNW-02,
// ROADMAP SC2, UI-SPEC Graph visual contract): the d3-force (^3) derived note
// graph — THE ONLY file importing d3-force (R-3: Standalone bundle only, never
// side panel / background SW). Data is DERIVED from NoteGraph.edges (05-05) —
// never re-derived from bodies, never a graph store (D-05-17). States per the
// §12 matrix: loading → STR.notes.graphLoading + Skeleton; error →
// STR.notes.graphFailed + Retry; < 3 notes → STR.notes.graphEmpty and the
// simulation is NEVER constructed below 3 nodes (zero-one-many E5). Colors are
// theme tokens at runtime (antd useToken) — never hex literals (UI-SPEC Color):
// selected node = colorPrimary, others = colorFillTertiary, isolated (degree 0)
// = reduced-opacity colorTextQuaternary-family but visible, edges =
// colorBorder, labels = 12px colorTextSecondary. Reduced motion (UI-SPEC
// Motion): prefers-reduced-motion → simulation.tick(300) synchronous + render
// the final layout directly + stop(); otherwise the tick-event pattern
// (d3js.org/d3-force CITED API — RESEARCH Common Operation 4: forceLink
// distance ~80, forceManyBody strength ~-200, forceCenter on the viewport).
// Node click → onOpenNote(noteId); node hover → antd Tooltip with the full
// title. Note titles render as SVG <text> content ONLY — never HTML
// (T-05-28); no dangerouslySetInnerHTML. Tests step ticks synchronously
// (Pitfall 6 — jsdom never awaits real simulation ticks; no rAF loop).
import { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton, Tooltip, Typography, theme } from 'antd';
import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { STR } from '@/core/i18n/strings';
import { edges } from '@/core/notes/NoteGraph';
import type { Note } from '@/core/storage/NotesDB';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';

/** Fixed viewBox (planner discretion — a real container measurement would be
    non-deterministic in jsdom, Pitfall 6); preserveAspectRatio keeps the
    layout stable at any pane size. */
const VIEW_W = 800;
const VIEW_H = 600;
/** Beside-node label cap — UI-SPEC: truncated 12px titles. */
const LABEL_MAX = 24;

/** One simulation node — the d3-force datum for a note (WIKI-ID-01: node id =
    note id; edges are ID-based, never titles). */
export interface NoteGraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  selected: boolean;
  degree: number;
}

/** One simulation link — the note-id edge from NoteGraph.edges (05-05). */
export interface NoteGraphLink extends SimulationLinkDatum<NoteGraphNode> {
  source: string;
  target: string;
}

interface NoteGraphViewProps {
  /** The current note list — the page owns state; the view derives edges. */
  notes: readonly Pick<Note, 'id' | 'title' | 'links'>[];
  /** The selected/current note id — its node fills colorPrimary. */
  selectedNoteId?: string;
  /** Single navigation contract (D-05-17): select + switch to Notes view. */
  onOpenNote: (noteId: string) => void;
  /** Loading state → STR.notes.graphLoading + Skeleton (page shares its own). */
  loading?: boolean;
  /** Error state → STR.notes.graphFailed + Retry (page shares its own). */
  error?: boolean;
  /** Retry re-runs the page's read — no duplicate error state. */
  onRetry?: () => void;
}

/** UI-SPEC [Retry] token convention: the canonical string keeps its action
    token; the UI renders the prefix text + a Retry button (NotesPage
    precedent). */
function stripActionToken(copy: string): string {
  return copy.split(' [')[0];
}

/** Display-only truncation for the beside-node label. */
function truncateTitle(title: string): string {
  return title.length > LABEL_MAX ? `${title.slice(0, LABEL_MAX - 1)}…` : title;
}

export function NoteGraphView({
  notes,
  selectedNoteId,
  onOpenNote,
  loading = false,
  error = false,
  onRetry,
}: NoteGraphViewProps) {
  const { token } = theme.useToken();

  // Derived graph data (D-05-17): edges from NoteGraph, nodes with degree
  // counts (isolated = degree 0 → reduced-opacity fill, UI-SPEC Color).
  const edgeList = useMemo(() => edges(notes), [notes]);

  const nodes = useMemo<NoteGraphNode[]>(() => {
    const degree = new Map<string, number>();
    for (const edge of edgeList) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }
    return notes.map((note) => ({
      id: note.id,
      title: note.title,
      selected: note.id === selectedNoteId,
      degree: degree.get(note.id) ?? 0,
    }));
  }, [notes, edgeList, selectedNoteId]);

  // Final-layout positions — set once (reduced motion) or on every tick.
  const [positions, setPositions] = useState<ReadonlyMap<string, { x: number; y: number }> | null>(
    null,
  );

  useEffect(() => {
    // The simulation is NEVER constructed below 3 notes (spec §12, E5) nor
    // while a state surface owns the pane (loading/error).
    if (notes.length < 3 || loading || error) return;

    const snapshot = (): ReadonlyMap<string, { x: number; y: number }> => {
      const map = new Map<string, { x: number; y: number }>();
      for (const node of nodes) {
        map.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
      }
      return map;
    };

    // d3js.org/d3-force CITED API (RESEARCH Common Operation 4): link distance
    // ~80, charge ~-200, center on the viewBox midpoint.
    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink<NoteGraphNode, NoteGraphLink>(edgeList)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(VIEW_W / 2, VIEW_H / 2));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Reduced motion (UI-SPEC Motion): run to equilibrium synchronously and
      // render the final layout directly — no rAF animation loop, keep
      // opacity, drop movement.
      simulation.tick(300);
      simulation.stop();
      setPositions(snapshot());
      return;
    }

    simulation.on('tick', () => {
      setPositions(snapshot());
    });
    return () => {
      simulation.stop();
    };
  }, [nodes, edgeList, notes.length, loading, error]);

  const centerStyle = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as const;

  if (loading) {
    return (
      <div data-np-graph-loading="1" style={centerStyle}>
        <Typography.Text type="secondary">{STR.notes.graphLoading}</Typography.Text>
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div data-np-graph-error="1" style={centerStyle}>
        <Typography.Text type="danger">{stripActionToken(STR.notes.graphFailed)}</Typography.Text>
        {onRetry && (
          <Button size="small" data-np-graph-retry="1" onClick={onRetry}>
            {STR.chat.retry}
          </Button>
        )}
      </div>
    );
  }

  if (notes.length < 3) {
    return (
      <div data-np-graph-empty="1" style={centerStyle}>
        <Typography.Text type="secondary">{STR.notes.graphEmpty}</Typography.Text>
      </div>
    );
  }

  return (
    <svg
      data-np-graph-svg="1"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <g>
        {edgeList.map((edge, index) => {
          const source = positions?.get(edge.source);
          const target = positions?.get(edge.target);
          return (
            <line
              key={`${edge.source}-${edge.target}-${index}`}
              data-np-graph-edge="1"
              x1={source?.x ?? 0}
              y1={source?.y ?? 0}
              x2={target?.x ?? 0}
              y2={target?.y ?? 0}
              stroke={token.colorBorder}
              strokeWidth={1}
            />
          );
        })}
      </g>
      <g>
        {nodes.map((node) => {
          const position = positions?.get(node.id);
          const isolated = node.degree === 0;
          const fill = node.selected
            ? token.colorPrimary
            : isolated
              ? token.colorTextQuaternary
              : token.colorFillTertiary;
          const x = position?.x ?? 0;
          const y = position?.y ?? 0;
          return (
            <g
              key={node.id}
              data-np-graph-node={node.id}
              onClick={() => onOpenNote(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <Tooltip title={node.title}>
                <circle
                  cx={x}
                  cy={y}
                  r={node.selected ? 14 : 10}
                  fill={fill}
                  stroke={node.selected ? token.colorPrimary : token.colorBorder}
                  strokeWidth={1}
                  opacity={isolated ? 0.7 : 1}
                  data-np-graph-selected={node.selected ? '1' : undefined}
                />
              </Tooltip>
              <text
                x={x + (node.selected ? 20 : 16)}
                y={y + 4}
                fontSize={12}
                fill={token.colorTextSecondary}
                style={{ pointerEvents: 'none' }}
              >
                {truncateTitle(node.title)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
