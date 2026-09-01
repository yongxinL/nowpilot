// NoteGraphView.tsx — D-111 graph adjacency/rendering-data core + thin scaffold
// (UI-SPEC Contract 3).
//
// Core logic: current note = center node (kind 'current'); topKSimilar(k=5) →
// 'similar' nodes + 'similar' edges; computeBacklinks → 'backlink' nodes +
// 'backlink' edges. Renders adjacency data legible (SVG scaffold). React JSX +
// SVG only — no raw HTML rendering (CTX-02).
//
// The full d3-force graph view is Phase 15 (commented). Phase-15 NotesWorkspace
// integration is a caller edit (scope fence).

import React, { useMemo } from 'react';
import { Typography } from 'antd';

import type { Note } from '../../types/notes';
import { topKSimilar, computeBacklinks } from '../../core/notes/NoteGraph';

const { Text } = Typography;

/** Graph node kinds (UI-SPEC Contract 3). */
export type GraphNodeKind = 'current' | 'similar' | 'backlink';

/** Graph node (UI-SPEC Contract 3). */
export interface GraphNode {
  id: string;
  title: string;
  kind: GraphNodeKind;
}

/** Graph edge types (UI-SPEC Contract 3). */
export type GraphEdgeType = 'similar' | 'backlink';

/** Graph edge (UI-SPEC Contract 3). */
export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
}

/** Graph adjacency data. */
export interface GraphAdjacency {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Build graph adjacency from notes for `noteId` (pure helper, UI-SPEC Contract 3).
 * Current note = center; topKSimilar(k=5) → similar nodes/edges; computeBacklinks
 * → backlink nodes/edges. No self-edges.
 */
export function buildGraphAdjacency(notes: Note[], noteId: string, k = 5): GraphAdjacency {
  const current = notes.find((n) => n.id === noteId);
  if (!current) return { nodes: [], edges: [] };

  const nodes: GraphNode[] = [{ id: current.id, title: current.title, kind: 'current' }];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>([current.id]);

  // Similar nodes from topKSimilar
  const similar = topKSimilar(current, notes, k);
  for (const { note } of similar) {
    if (nodeIds.has(note.id)) continue;
    nodeIds.add(note.id);
    nodes.push({ id: note.id, title: note.title, kind: 'similar' });
    edges.push({ source: current.id, target: note.id, type: 'similar' });
  }

  // Backlink nodes from computeBacklinks
  const backlinks = computeBacklinks(notes);
  const referencingIds = backlinks.get(noteId) ?? [];
  const noteById = new Map(notes.map((n) => [n.id, n]));
  for (const refId of referencingIds) {
    if (nodeIds.has(refId)) {
      // Already a node — just add the backlink edge
      edges.push({ source: refId, target: noteId, type: 'backlink' });
      continue;
    }
    const note = noteById.get(refId);
    if (note) {
      nodeIds.add(refId);
      nodes.push({ id: note.id, title: note.title, kind: 'backlink' });
      edges.push({ source: refId, target: noteId, type: 'backlink' });
    }
  }

  return { nodes, edges };
}

/** NoteGraphView props (UI-SPEC Contract 3). */
interface NoteGraphViewProps {
  notes: Note[];
  noteId: string;
  onSelect: (noteId: string) => void;
}

/**
 * NoteGraphView — D-111 core logic + thin SVG scaffold. Current node colorPrimary
 * fill; similar/backlink nodes colorBgContainer with colorBorder; node click →
 * onSelect. Empty state 'No connections yet'.
 *
 * The d3-force layout + clustering is Phase 15 (commented).
 */
export const NoteGraphView: React.FC<NoteGraphViewProps> = ({ notes, noteId, onSelect }) => {
  const adjacency = useMemo(() => buildGraphAdjacency(notes, noteId), [notes, noteId]);

  // Empty state: no connections (only the current node exists, no edges)
  if (adjacency.nodes.length <= 1 || adjacency.edges.length === 0) {
    return (
      <div style={{ padding: 16, background: 'var(--card, #fff)', borderRadius: 12, textAlign: 'center' }}>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
          No connections yet
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Related and linking notes appear here as you add wikilinks.
        </Text>
      </div>
    );
  }

  // Simple radial layout scaffold (Phase 15: replace with d3-force)
  const width = 400;
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 100;

  const positioned = adjacency.nodes.map((node, i) => {
    if (node.kind === 'current') {
      return { ...node, x: cx, y: cy };
    }
    const angle = ((i - 1) / (adjacency.nodes.length - 1)) * 2 * Math.PI - Math.PI / 2;
    return { ...node, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  const nodeById = new Map(positioned.map((n) => [n.id, n]));

  return (
    <div style={{ background: 'var(--card, #fff)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #f0f0f0)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}>
          NOTE GRAPH
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
          {/* Edges */}
          {adjacency.edges.map((edge, i) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={`e${i}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={edge.type === 'similar' ? '#3b82f6' : '#d1d5db'}
                strokeWidth={edge.type === 'similar' ? 2 : 1}
                strokeDasharray={edge.type === 'backlink' ? '4 2' : undefined}
              />
            );
          })}
          {/* Nodes */}
          {positioned.map((node) => (
            <g
              key={node.id}
              onClick={() => onSelect(node.id)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`Open note ${node.title}`}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.kind === 'current' ? 20 : 14}
                fill={node.kind === 'current' ? '#3b82f6' : '#fff'}
                stroke={node.kind === 'current' ? '#2563eb' : '#d1d5db'}
                strokeWidth={2}
              />
              <text
                x={node.x}
                y={node.y + (node.kind === 'current' ? 32 : 28)}
                textAnchor="middle"
                fontSize={10}
                fill={node.kind === 'current' ? '#3b82f6' : '#6b7280'}
              >
                {node.title.length > 15 ? `${node.title.slice(0, 15)}…` : node.title}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};
