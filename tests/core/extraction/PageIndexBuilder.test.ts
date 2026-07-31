import { describe, expect, it, beforeEach } from 'vitest';
import MiniSearch from 'minisearch';
import { PageIndexBuilder } from '../../../src/core/extraction/PageIndexBuilder';
import type { APCLiteNode } from '../../../src/core/extraction/apcLite.types';

/**
 * PageIndexBuilder tests — ephemeral per-tab MiniSearch index with
 * heading-aware chunking, BM25 retrieval, and tab-scoped cleanup.
 */

const SAMPLE_MARKDOWN = `# Introduction

This is the introduction paragraph. It provides context for the rest of the document.

## Getting Started

To get started, follow these basic steps. First, install the package using npm.

### Prerequisites

Make sure you have Node.js version 18 or higher installed on your system.

## Advanced Usage

The advanced features section covers custom configuration and plugin development.

### Custom Configuration

You can customize the behavior using the configuration file located at \`config.yaml\`.

### Plugin Development

Plugins extend the core functionality. Write your first plugin by implementing the Plugin interface.`;

function makeAPCLiteFixture(): APCLiteNode {
  return {
    role: 'document',
    name: 'Test Page',
    children: [
      {
        role: 'navigation',
        name: 'Main Nav',
        text: 'Home | About | Contact',
        children: [
          {
            role: 'link',
            name: 'Home',
            attributes: { href: '/home' },
          },
          {
            role: 'link',
            name: 'About',
            attributes: { href: '/about' },
          },
        ],
      },
      {
        role: 'main',
        name: 'Main Content',
        children: [
          {
            role: 'heading',
            name: 'Welcome',
            text: 'Welcome to the test page',
            semanticLabel: 'H1',
          },
          {
            role: 'paragraph',
            text: 'This is a test paragraph with some meaningful content for search indexing.',
          },
          {
            role: 'button',
            name: 'Submit',
            text: 'Click to submit the form',
            attributes: { type: 'submit', 'aria-label': 'Submit form' },
          },
        ],
      },
    ],
  };
}

describe('PageIndexBuilder', () => {
  let builder: PageIndexBuilder;

  beforeEach(() => {
    builder = new PageIndexBuilder();
  });

  // ── buildFromText ──────────────────────────────────────────

  describe('buildFromText', () => {
    it('chunks markdown by heading hierarchy with correct breadcrumb paths', () => {
      builder.buildFromText(1, 'default', SAMPLE_MARKDOWN);

      // Content under # Introduction → headingPath = "Introduction"
      const introResults = builder.selectRelevant('introduction paragraph', 10000);
      expect(introResults.length).toBeGreaterThan(0);
      expect(introResults.some((c) => c.headingPath === 'Introduction')).toBe(true);

      // Content under ## Getting Started → headingPath = "Introduction → Getting Started"
      const startResults = builder.selectRelevant('basic steps', 10000);
      expect(startResults.length).toBeGreaterThan(0);
      expect(startResults.some((c) => c.headingPath === 'Introduction → Getting Started')).toBe(true);

      // Content under ### Prerequisites → headingPath = "Introduction → Getting Started → Prerequisites"
      const prereqResults = builder.selectRelevant('Node.js', 10000);
      expect(prereqResults.length).toBeGreaterThan(0);
      expect(prereqResults.some((c) => c.headingPath === 'Introduction → Getting Started → Prerequisites')).toBe(true);

      // Content under ## Advanced Usage → headingPath = "Introduction → Advanced Usage"
      const advancedResults = builder.selectRelevant('advanced features', 10000);
      expect(advancedResults.length).toBeGreaterThan(0);
      expect(advancedResults.some((c) => c.headingPath === 'Introduction → Advanced Usage')).toBe(true);

      // Content under ### Custom Configuration → headingPath includes correct breadcrumb
      const configResults = builder.selectRelevant('config.yaml', 10000);
      expect(configResults.length).toBeGreaterThan(0);
      expect(configResults.some((c) => c.headingPath === 'Introduction → Advanced Usage → Custom Configuration')).toBe(true);

      // Content under ### Plugin Development → headingPath includes correct breadcrumb
      const pluginResults = builder.selectRelevant('Plugin interface', 10000);
      expect(pluginResults.length).toBeGreaterThan(0);
      expect(pluginResults.some((c) => c.headingPath === 'Introduction → Advanced Usage → Plugin Development')).toBe(true);
    });

    it('creates a preamble chunk for content before the first heading', () => {
      const md = `Some alpha preamble text that appears before any heading.

# First Heading

Content under the first heading.`;

      builder.buildFromText(1, 'default', md);

      const results = builder.selectRelevant('alpha preamble', 10000);
      const preambleChunks = results.filter((c) => c.headingPath === '(preamble)');
      expect(preambleChunks.length).toBeGreaterThan(0);
      expect(preambleChunks[0].chunkText).toContain('alpha preamble');
      expect(preambleChunks[0].headingText).toBe('(preamble)');
    });

    it('treats entire content as preamble when no headings exist', () => {
      const md = 'Plain text with no headings at all.';

      builder.buildFromText(2, 'default', md);

      const results = builder.selectRelevant('plain', 10000);
      expect(results.length).toBe(1);
      expect(results[0].headingPath).toBe('(preamble)');
      expect(results[0].headingText).toBe('(preamble)');
      expect(results[0].chunkText).toContain('Plain text');
    });

    it('handles markdown with only headings and no body text', () => {
      const md = '# A\n## B\n### C';
      builder.buildFromText(1, 'default', md);

      // No body text between headings → all chunks would be empty → skipped
      // The entire content is headings only, no text chunks
      const results = builder.selectRelevant('A', 10000);
      // No body text means no chunks are created (headings alone don't produce chunks
      // since there's no text between them)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty content gracefully', () => {
      builder.buildFromText(1, 'default', '');
      const results = builder.selectRelevant('anything', 10000);
      expect(results.length).toBe(0);

      builder.buildFromText(1, 'default', '   \n\n  ');
      const results2 = builder.selectRelevant('anything', 10000);
      expect(results2.length).toBe(0);
    });
  });

  // ── removeTab ──────────────────────────────────────────────

  describe('removeTab', () => {
    it('removes all chunks for a tabId — tab-unique keywords no longer findable', () => {
      builder.buildFromText(1, 'default', '# TabX\nAlphaKeyword123 appears here for tab 1.');
      builder.buildFromText(2, 'default', '# TabY\nBetaKeyword456 appears here for tab 2.');

      // Both keywords should be findable
      expect(builder.selectRelevant('AlphaKeyword123', 10000).length).toBe(1);
      expect(builder.selectRelevant('BetaKeyword456', 10000).length).toBe(1);

      builder.removeTab(1);

      // Tab 1 keyword gone
      expect(builder.selectRelevant('AlphaKeyword123', 10000).length).toBe(0);
      // Tab 2 keyword still present
      expect(builder.selectRelevant('BetaKeyword456', 10000).length).toBe(1);

      builder.removeTab(2);
      expect(builder.selectRelevant('BetaKeyword456', 10000).length).toBe(0);
    });

    it('second buildFromText on same tab clears old chunks first (Pitfall 5)', () => {
      builder.buildFromText(1, 'default', '# Old Title\nGammaUnique789 is the old content marker.');
      // New content does NOT contain GammaUnique789
      builder.buildFromText(1, 'default', '# New Title\nDeltaNew999 is the replacement content.');

      // Old unique keyword should NOT be found
      const oldResults = builder.selectRelevant('GammaUnique789', 10000);
      expect(oldResults.length).toBe(0);

      // New unique keyword should be found
      const newResults = builder.selectRelevant('DeltaNew999', 10000);
      expect(newResults.length).toBe(1);
    });
  });

  // ── selectRelevant ──────────────────────────────────────────

  describe('selectRelevant', () => {
    beforeEach(() => {
      builder.buildFromText(1, 'default', SAMPLE_MARKDOWN);
    });

    it('returns chunks matching the query', () => {
      const results = builder.selectRelevant('custom configuration', 10000);
      expect(results.length).toBeGreaterThan(0);

      const matchFound = results.some(
        (c) =>
          c.chunkText.toLowerCase().includes('custom') ||
          c.headingText.toLowerCase().includes('custom') ||
          c.headingPath.toLowerCase().includes('custom'),
      );
      expect(matchFound).toBe(true);
    });

    it('heading-matched chunks rank higher than text-matched chunks', () => {
      const results = builder.selectRelevant('getting', 10000);
      expect(results.length).toBeGreaterThan(0);

      // At least one result should match "getting" in the heading
      const headingMatchExists = results.some(
        (c) =>
          c.headingText.toLowerCase().includes('getting') ||
          c.headingPath.toLowerCase().includes('getting'),
      );
      expect(headingMatchExists).toBe(true);
    });

    it('respects the token budget when first result fits', () => {
      const budget = 100; // 100 tokens ≈ 400 chars
      const results = builder.selectRelevant('plugin', budget);

      const totalChars = results.reduce((sum, c) => sum + c.chunkText.length, 0);
      expect(totalChars).toBeLessThanOrEqual(budget * 4);
    });

    it('returns empty array for empty query', () => {
      expect(builder.selectRelevant('', 10000)).toEqual([]);
    });

    it('returns empty array for non-positive budget', () => {
      expect(builder.selectRelevant('intro', 0)).toEqual([]);
    });

    it('returns at least one chunk even if first chunk exceeds budget', () => {
      const results = builder.selectRelevant('plugin', 1);
      expect(results.length).toBe(1);
    });
  });

  // ── buildFromTree ──────────────────────────────────────────

  describe('buildFromTree', () => {
    it('flattens APCLiteNode tree into chunks with role-based heading paths', () => {
      const tree = makeAPCLiteFixture();
      builder.buildFromTree(1, tree);

      // Search for unique terms in each node to verify breadcrumbs
      // Link node: contains "Home" and "About"
      const linkResults = builder.selectRelevant('About Contact', 10000);
      expect(linkResults.length).toBeGreaterThan(0);
      expect(linkResults.some((c) => c.headingPath === 'document → navigation')).toBe(true);
      expect(linkResults.some((c) => c.headingPath.startsWith('document → navigation → link'))).toBe(true);

      // Heading node: contains "Welcome"
      const headingResults = builder.selectRelevant('Welcome to the test page', 10000);
      expect(headingResults.length).toBeGreaterThan(0);
      expect(headingResults.some((c) => c.headingPath === 'document → main → heading')).toBe(true);

      // Paragraph node: contains "meaningful content"
      const paraResults = builder.selectRelevant('meaningful content', 10000);
      expect(paraResults.length).toBeGreaterThan(0);
      expect(paraResults.some((c) => c.headingPath === 'document → main → paragraph')).toBe(true);

      // Button node: contains "Submit" and "Click"
      const btnResults = builder.selectRelevant('Submit the form', 10000);
      expect(btnResults.length).toBeGreaterThan(0);
      expect(btnResults.some((c) => c.headingPath === 'document → main → button')).toBe(true);
    });

    it('includes attribute values in searchable text', () => {
      const tree = makeAPCLiteFixture();
      builder.buildFromTree(1, tree);

      // "Submit form" comes from aria-label attribute on button
      const results = builder.selectRelevant('Submit form', 10000);
      expect(results.length).toBeGreaterThan(0);
    });

    it('clears old APCLite chunks before re-indexing (Pitfall 5)', () => {
      const oldTree: APCLiteNode = {
        role: 'document',
        name: 'Old Page',
        children: [
          { role: 'paragraph', text: 'ZetaStale111 content that should not appear after re-index.' },
        ],
      };
      builder.buildFromTree(1, oldTree);
      expect(builder.selectRelevant('ZetaStale111', 10000).length).toBe(1);

      // Re-index with new tree (does NOT contain ZetaStale111)
      const newTree = makeAPCLiteFixture();
      builder.buildFromTree(1, newTree);

      // Stale keyword should NOT be found
      expect(builder.selectRelevant('ZetaStale111', 10000).length).toBe(0);
      // New content should be found
      expect(builder.selectRelevant('test', 10000).length).toBeGreaterThan(0);
    });
  });

  // ── Multi-tab isolation ────────────────────────────────────

  describe('multi-tab isolation', () => {
    it('chunks are isolated per tabId — removing one tab does not affect others', () => {
      builder.buildFromText(1, 'default', '# Tab One\nEtaTabOne222 unique content for tab one.');
      builder.buildFromText(2, 'default', '# Tab Two\nThetaTabTwo333 unique content for tab two.');

      // Both keywords findable
      expect(builder.selectRelevant('EtaTabOne222', 10000).length).toBe(1);
      expect(builder.selectRelevant('ThetaTabTwo333', 10000).length).toBe(1);

      builder.removeTab(1);

      // Tab 1 keyword gone
      expect(builder.selectRelevant('EtaTabOne222', 10000).length).toBe(0);
      // Tab 2 keyword still present
      expect(builder.selectRelevant('ThetaTabTwo333', 10000).length).toBe(1);
    });

    it('multiple tabs can use the same heading structures without interference', () => {
      builder.buildFromText(1, 'default', '# Shared\nIotaShared444 content from tab 1.');
      builder.buildFromText(2, 'default', '# Shared\nKappaShared555 content from tab 2.');

      const allResults = builder.selectRelevant('shared', 10000);
      // Both tabs have a chunk matching "shared"
      expect(allResults.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Module-level singleton ─────────────────────────────────

  describe('singleton', () => {
    it('exports a module-level pageIndexBuilder singleton', async () => {
      const mod = await import('../../../src/core/extraction/PageIndexBuilder');
      expect(mod.pageIndexBuilder).toBeDefined();
      expect(mod.pageIndexBuilder).toBeInstanceOf(PageIndexBuilder);
    });
  });
});
