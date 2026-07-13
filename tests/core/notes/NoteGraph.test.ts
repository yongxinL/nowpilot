import { describe, it, expect, beforeEach } from 'vitest';
import { NoteGraph } from '../../../src/core/notes/NoteGraph';

interface TestNote {
  id: string;
  title: string;
  content?: string;
}

describe('NoteGraph', () => {
  let graph: NoteGraph;

  beforeEach(() => {
    graph = new NoteGraph();
  });

  describe('buildGraphData', () => {
    it('should build nodes and links from notes with wikilink content', () => {
      const notes = [
        { id: 'n1', title: 'Alpha', content: 'See [[Beta]] and [[Gamma]]' },
        { id: 'n2', title: 'Beta', content: 'About Beta' },
        { id: 'n3', title: 'Gamma', content: 'About Gamma' },
      ];
      const result = graph.buildGraphData(notes);
      expect(result.nodes).toHaveLength(3);
      // Should have links from Alpha → Beta and Alpha → Gamma
      expect(result.links).toHaveLength(2);
      const linkFrom = result.links[0].source;
      const linkTo = result.links[0].target;
      // Both links should originate from n1 (Alpha)
      expect(linkFrom).toBe('n1');
    });

    it('should return empty nodes and links when given empty array', () => {
      const result = graph.buildGraphData([]);
      expect(result).toEqual({ nodes: [], links: [] });
    });

    it('should return nodes but no links when notes have no wikilinks', () => {
      const notes = [
        { id: 'n1', title: 'Alpha', content: 'Plain text' },
        { id: 'n2', title: 'Beta', content: 'More text' },
      ];
      const result = graph.buildGraphData(notes);
      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(0);
    });

    it('should filter out self-links (source === target)', () => {
      const notes = [
        { id: 'n1', title: 'Alpha', content: 'See [[Alpha]]' },
        { id: 'n2', title: 'Beta', content: 'About Beta' },
      ];
      const result = graph.buildGraphData(notes);
      // Self-link to Alpha should be filtered out
      expect(result.links).toHaveLength(0);
    });

    it('should filter out unresolved links (target note not found)', () => {
      const notes = [
        { id: 'n1', title: 'Alpha', content: 'See [[NonExistent]]' },
        { id: 'n2', title: 'Beta', content: 'About Beta' },
      ];
      const result = graph.buildGraphData(notes);
      expect(result.links).toHaveLength(0);
    });
  });
});
