import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseWikilinks, resolveLinks, WIKILINK_REGEX } from '../../../src/core/notes/LinkParser';
import type { Note } from '../../../src/core/notes/NoteSchema';

function note(id: string, title: string, updatedAt: number): Note {
  return {
    id,
    title,
    content: '',
    tags: [],
    categoryPath: '',
    createdAt: 0,
    updatedAt,
    version: 1,
    provenance: { source: 'user-created' },
    links: [],
    unresolvedLinks: [],
  };
}

describe('parseWikilinks', () => {
  it('extracts basic titles', () => {
    expect(parseWikilinks('see [[Alpha]] and [[Beta]]')).toEqual(['Alpha', 'Beta']);
  });

  it('extracts only the title portion from alias syntax', () => {
    expect(parseWikilinks('see [[Beta|display alias]]')).toEqual(['Beta']);
  });

  it('extracts only the title portion from heading syntax', () => {
    expect(parseWikilinks('see [[Gamma#section-2]]')).toEqual(['Gamma']);
  });

  it('extracts only the title portion from combined alias + heading syntax', () => {
    expect(parseWikilinks('[[Delta#sub|show me]]')).toEqual(['Delta']);
  });

  it('deduplicates repeated links', () => {
    expect(parseWikilinks('[[Alpha]] and [[Alpha]] again')).toEqual(['Alpha']);
  });

  it('returns [] for content without links and for empty content', () => {
    expect(parseWikilinks('no links here')).toEqual([]);
    expect(parseWikilinks('')).toEqual([]);
  });

  it('trims surrounding whitespace in titles', () => {
    expect(parseWikilinks('[[  Padded Title  ]]')).toEqual(['Padded Title']);
  });
});

describe('resolveLinks', () => {
  const mockDb: { findByTitle: ReturnType<typeof vi.fn> } = {
    findByTitle: vi.fn(),
  };

  beforeEach(() => {
    mockDb.findByTitle.mockReset();
  });

  it('maps existing titles to note IDs and tracks unresolved titles', async () => {
    mockDb.findByTitle.mockImplementation(async (title: string) =>
      title === 'existing' ? [note('a', 'existing', 100)] : [],
    );
    const result = await resolveLinks(['existing', 'nonexistent'], mockDb);
    expect(result).toEqual({ links: ['a'], unresolvedLinks: ['nonexistent'] });
    expect(mockDb.findByTitle).toHaveBeenCalledWith('existing');
    expect(mockDb.findByTitle).toHaveBeenCalledWith('nonexistent');
  });

  it('tie-breaks duplicate titles to the most recently updated note', async () => {
    mockDb.findByTitle.mockResolvedValue([note('a', 'dupe', 100), note('b', 'dupe', 200)]);
    const result = await resolveLinks(['dupe'], mockDb);
    expect(result).toEqual({ links: ['b'], unresolvedLinks: [] });
  });

  it('returns empty result for an empty titles array', async () => {
    const result = await resolveLinks([], mockDb);
    expect(result).toEqual({ links: [], unresolvedLinks: [] });
  });
});

describe('WIKILINK_REGEX', () => {
  it('is exported for downstream consumers', () => {
    expect(WIKILINK_REGEX).toBeInstanceOf(RegExp);
    expect(WIKILINK_REGEX.global).toBe(true);
  });
});
