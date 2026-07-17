import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note, BacklinkEntry } from '../../../src/core/notes/LinkParser';
import type { TaggerResult } from '../../../src/core/notes/noteTypes';

// ── Hoisted Mocks ──

const { mockAnalyze } = vi.hoisted(() => ({
  mockAnalyze: vi.fn(),
}));

vi.mock('../../../src/core/notes/NoteTagger', () => ({
  NoteTagger: vi.fn(),
  noteTagger: {
    analyze: mockAnalyze,
  },
}));

// Module imports (after vi.mock hoisting)
import { NoteMaintenance, noteMaintenance } from '../../../src/core/notes/NoteMaintenance';

// ── Helpers ──

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: `note-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Note',
    content: 'Test content',
    created: now,
    updated: now,
    tags: [],
    ...overrides,
  };
}

// ── Tests ──

describe('NoteMaintenance', () => {
  let maintenance: NoteMaintenance;

  beforeEach(() => {
    vi.clearAllMocks();
    maintenance = new NoteMaintenance();
  });

  // ── Test 1: detectOrphans finds orphans ──

  it('detectOrphans() returns notes with 0 wikilinks AND 0 backlinks', () => {
    const notes = [
      makeNote({ id: '1', title: 'Orphan Note', content: 'No wikilinks here' }),
      makeNote({ id: '2', title: 'Linked Note', content: 'Links to [[Note 3]]' }),
      makeNote({ id: '3', title: 'Target Note', content: 'Has some content' }),
    ];

    // Note 3 has a backlink from Note 2
    const backlinks = new Map<string, BacklinkEntry[]>();
    backlinks.set('3', [
      { noteId: '2', title: 'Linked Note', snippet: 'Links to [[Target Note]]' },
    ]);

    const orphans = maintenance.detectOrphans(notes, backlinks, notes);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].id).toBe('1');
    expect(orphans[0].title).toBe('Orphan Note');
  });

  // ── Test 2: detectOrphans empty when all linked ──

  it('detectOrphans() returns empty array when every note has at least one link', () => {
    const notes = [
      makeNote({ id: '1', title: 'Note 1', content: 'Links to [[Note 2]]' }),
      makeNote({ id: '2', title: 'Note 2', content: 'Links to [[Note 1]]' }),
    ];

    const backlinks = new Map<string, BacklinkEntry[]>();
    backlinks.set('1', [
      { noteId: '2', title: 'Note 2', snippet: 'Links to [[Note 1]]' },
    ]);
    backlinks.set('2', [
      { noteId: '1', title: 'Note 1', snippet: 'Links to [[Note 2]]' },
    ]);

    const orphans = maintenance.detectOrphans(notes, backlinks, notes);
    expect(orphans).toHaveLength(0);
  });

  // ── Test 3: detectStale tags ──

  it('detectStale() returns notes where updated > tagsGeneratedAt', () => {
    const notes = [
      makeNote({
        id: '1',
        title: 'Stale Tags',
        updated: 5000,
        tagsGeneratedAt: 1000, // content updated after tags analysis
      }),
      makeNote({
        id: '2',
        title: 'Fresh Tags',
        updated: 1000,
        tagsGeneratedAt: 2000, // tags generated after last content change
      }),
    ];

    const result = maintenance.detectStale(notes);
    expect(result.staleTags).toHaveLength(1);
    expect(result.staleTags[0].id).toBe('1');
    expect(result.staleSummary).toHaveLength(0);
  });

  // ── Test 4: detectStale summary ──

  it('detectStale() returns notes where updated > summaryGeneratedAt', () => {
    const notes = [
      makeNote({
        id: '1',
        title: 'Stale Summary',
        updated: 5000,
        summaryGeneratedAt: 1000, // content updated after summary analysis
      }),
      makeNote({
        id: '2',
        title: 'Fresh Summary',
        updated: 1000,
        summaryGeneratedAt: 2000, // summary generated after last content change
      }),
    ];

    const result = maintenance.detectStale(notes);
    expect(result.staleSummary).toHaveLength(1);
    expect(result.staleSummary[0].id).toBe('1');
    expect(result.staleTags).toHaveLength(0);
  });

  // ── Test 5: detectStale empty when all up to date ──

  it('detectStale() returns empty arrays when all notes are up to date', () => {
    const notes = [
      makeNote({
        id: '1',
        updated: 1000,
        tagsGeneratedAt: 2000,
        summaryGeneratedAt: 3000,
      }),
      makeNote({
        id: '2',
        updated: 500,
        tagsGeneratedAt: 1000,
        summaryGeneratedAt: 1500,
      }),
    ];

    const result = maintenance.detectStale(notes);
    expect(result.staleTags).toHaveLength(0);
    expect(result.staleSummary).toHaveLength(0);
  });

  // ── Test 6: getMaintenanceStats ──

  it('getMaintenanceStats() returns summary with total, orphan, and stale counts', () => {
    const notes = [
      makeNote({ id: '1', title: 'Orphan', content: 'No links' }),
      makeNote({ id: '2', title: 'Linked', content: 'Links to [[Note 3]]' }),
      makeNote({ id: '3', title: 'Target', content: 'Content', updated: 5000, tagsGeneratedAt: 1000 }),
    ];

    // Note 1: orphan (no outgoing, no backlinks)
    // Note 2: linked (outgoing to 3)
    // Note 3: linked (backlink from 2), stale tags
    const backlinks = new Map<string, BacklinkEntry[]>();
    backlinks.set('3', [
      { noteId: '2', title: 'Linked', snippet: 'Links to [[Target]]' },
    ]);

    const stats = maintenance.getMaintenanceStats(notes, backlinks, notes);
    expect(stats.totalNotes).toBe(3);
    expect(stats.orphanCount).toBe(1);
    expect(stats.staleTagsCount).toBe(1);
    expect(stats.staleSummaryCount).toBe(0);
  });

  // ── Test 7: bulkAnalyze calls NoteTagger sequentially ──

  it('bulkAnalyze() calls NoteTagger.analyze() sequentially for each stale note', async () => {
    const notes = [
      makeNote({
        id: '1',
        title: 'Note 1',
        content: 'First',
        updated: 5000,
        tagsGeneratedAt: 1000, // stale
      }),
      makeNote({
        id: '2',
        title: 'Note 2',
        content: 'Second',
        updated: 5000,
        tagsGeneratedAt: 2000, // stale
      }),
    ];

    mockAnalyze
      .mockResolvedValueOnce({
        tags: ['tag1'],
        categoryPath: 'Cat',
        summary: 'Summary 1',
      } as TaggerResult)
      .mockResolvedValueOnce({
        tags: ['tag2'],
        categoryPath: null,
        summary: 'Summary 2',
      } as TaggerResult);

    const result = await maintenance.bulkAnalyze(notes, ['Cat']);

    expect(mockAnalyze).toHaveBeenCalledTimes(2);
    expect(result.analyzed).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.results.size).toBe(2);
    expect(result.results.get('1')?.tags).toEqual(['tag1']);
    expect(result.results.get('2')?.tags).toEqual(['tag2']);
  });

  // ── Test 8: bulkAnalyze skips unchanged notes ──

  it('bulkAnalyze() skips notes with unchanged content since last analysis', async () => {
    const notes = [
      makeNote({
        id: '1',
        title: 'Stale',
        content: 'Changed',
        updated: 5000,
        tagsGeneratedAt: 1000, // stale
      }),
      makeNote({
        id: '2',
        title: 'Fresh',
        content: 'Same',
        updated: 500,
        tagsGeneratedAt: 2000, // not stale
      }),
    ];

    mockAnalyze.mockResolvedValue({
      tags: ['tag'],
      categoryPath: null,
      summary: 'Summary',
    } as TaggerResult);

    const result = await maintenance.bulkAnalyze(notes, ['Cat']);

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(result.analyzed).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.results.size).toBe(1);
    expect(result.results.has('1')).toBe(true);
    expect(result.results.has('2')).toBe(false);
  });

  // ── Singleton export ──

  it('exports a singleton instance', () => {
    expect(noteMaintenance).toBeDefined();
    expect(noteMaintenance).toBeInstanceOf(NoteMaintenance);
  });
});
