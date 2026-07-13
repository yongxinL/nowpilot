import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Typography } from 'antd';
import { useToken } from 'antd/es/theme/useToken';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

const { Text } = Typography;

// ── Types ──

interface NoteGraphNodeDatum extends SimulationNodeDatum {
  id: string;
  title: string;
}

interface NoteGraphLinkDatum extends SimulationLinkDatum<NoteGraphNodeDatum> {
  source: string | NoteGraphNodeDatum;
  target: string | NoteGraphNodeDatum;
}

interface GraphNode {
  id: string;
  title: string;
}

interface GraphLink {
  source: string;
  target: string;
}

export interface NoteGraphViewProps {
  notes: GraphNode[];
  links: GraphLink[];
  onNavigateNote: (noteId: string) => void;
}

// ── Component ──

export function NoteGraphView({ notes, links, onNavigateNote }: NoteGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const token = useToken();

  // Track dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // d3-force simulation and canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;

    // Build simulation data
    const simNodes: NoteGraphNodeDatum[] = notes.map((n) => ({
      id: n.id,
      title: n.title,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    }));

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: NoteGraphLinkDatum[] = links
      .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map((l) => ({
        source: l.source,
        target: l.target,
      }));

    const simulation = forceSimulation<NoteGraphNodeDatum>(simNodes)
      .force(
        'link',
        forceLink<NoteGraphNodeDatum, NoteGraphLinkDatum>(simLinks)
          .id((d) => d.id)
          .distance(100),
      )
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide().radius(30))
      .alpha(0.5)
      .on('tick', () => {
        ctx.clearRect(0, 0, width, height);

        // Draw edges
        ctx.strokeStyle = token.colorBorderSecondary || '#d9d9d9';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        for (const link of simLinks) {
          const s = link.source as NoteGraphNodeDatum;
          const t = link.target as NoteGraphNodeDatum;
          if (s && t && s.x !== undefined && t.x !== undefined) {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;

        // Draw nodes
        for (const node of simNodes) {
          if (node.x === undefined || node.y === undefined) continue;

          // Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = token.colorPrimary || '#1677ff';
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Label
          ctx.fillStyle = token.colorText || '#000';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.title, node.x, node.y - 14);
        }
      });

    // Drag behavior
    let dragging: NoteGraphNodeDatum | null = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const getNodeAt = (px: number, py: number): NoteGraphNodeDatum | null => {
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        if (n.x === undefined || n.y === undefined) continue;
        const dx = px - n.x;
        const dy = py - n.y;
        if (dx * dx + dy * dy < 100) return n; // radius 10 for hit detection
      }
      return null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const node = getNodeAt(px, py);
      if (node) {
        dragging = node;
        dragOffsetX = px - node.x!;
        dragOffsetY = py - node.y!;
        simulation.alphaTarget(0.3).restart();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      dragging.fx = e.clientX - rect.left - dragOffsetX;
      dragging.fy = e.clientY - rect.top - dragOffsetY;
    };

    const handleMouseUp = () => {
      if (dragging) {
        dragging.fx = null;
        dragging.fy = null;
        dragging = null;
        simulation.alphaTarget(0);
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const node = getNodeAt(px, py);
      if (node) {
        onNavigateNote(node.id);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Simple zoom via canvas transform
      const rect = canvas.getBoundingClientRect();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      ctx.translate(rect.width / 2, rect.height / 2);
      ctx.scale(delta, delta);
      ctx.translate(-rect.width / 2, -rect.height / 2);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      simulation.stop();
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [notes, links, dimensions, onNavigateNote, token]);

  // Minimum 3 notes check — show placeholder if less
  if (notes.length < 3) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 200,
          color: token.colorTextSecondary,
        }}
      >
        <Text type="secondary">
          {notes.length === 0
            ? 'No notes to display. Create at least 3 notes to see the graph.'
            : `Add at least ${3 - notes.length} more note${3 - notes.length === 1 ? '' : 's'} to see the graph.`}
        </Text>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block', cursor: 'grab' }}
      />
    </div>
  );
}
