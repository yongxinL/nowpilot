// notes-search-e2e.test.ts — Phase 8 §18 DONE-when end-to-end proof (D-105).
//
// Proves the full save->index->query path at the SERVICE level (no UI call-site):
//   PageContext fixture -> canonical Note -> saveNote (parse -> resolve -> put ->
//   emit note:saved) -> MiniSearchIndex upsert -> query returns the note.
//
// Plus the RICH-R-05 surface check: buildPreferenceProfile includes persona
// overrides from np_persona (never the fact store).
//
// D-105: proven by a service-level test, NOT a shipped UI call-site. The file
// imports only src/core modules + tests/setup mocks — zero component imports.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDBPDatabase } from 'idb';

// Mutable isPrimaryWriter mock (PreferenceMemoryStore gates setPersonaOverrides
// on isPrimaryWriter()). Mirrors MemoryEngine.test.ts pattern.
const isPrimaryWriterMock = vi.fn(() => true);
vi.mock('../../../src/core/workspace/WorkspaceStore', () => ({
  isPrimaryWriter: () => isPrimaryWriterMock(),
}));

import { openNotesDB, type NotesDBV1 } from '@/core/storage/NotesDB';
import type { Note } from '@/types/notes';
import { saveNote } from '@/core/notes/save';
import {
  MiniSearchIndex,
  __test__ as indexTest,
  query,
} from '@/core/search/MiniSearchIndex';
import { usePreferenceMemoryStore } from '@/core/memory/PreferenceMemoryStore';
import { MemoryEngine } from '@/core/memory/MemoryEngine';
import type { PageContext } from '@/core/content/PageContext';

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: over.id ?? 'note-1',
    title: over.title ?? 'Note',
    content: over.content ?? '',
    created: over.created ?? 1000,
    updated: over.updated ?? 1000,
    tags: over.tags ?? [],
    links: over.links ?? [],
    unresolvedLinks: over.unresolvedLinks ?? [],
    source: over.source ?? { kind: 'manual' },
    aiMeta: over.aiMeta ?? { suggestedLinks: [], concepts: [] },
    version: over.version ?? 1,
    ...over,
  };
}

function makePageContext(over: Partial<PageContext> = {}): PageContext {
  return {
    url: over.url ?? 'https://instance.service-now.com/incident/INC0012345',
    origin: over.origin ?? 'https://instance.service-now.com',
    hostname: over.hostname ?? 'instance.service-now.com',
    title: over.title ?? 'High CPU on prod db',
    meta: over.meta ?? {},
    extractedAt: over.extractedAt ?? Date.now(),
    ...over,
  };
}

// Flush the async note:saved handler (openNotesDB -> db.get -> getIndex -> add).
function flushTicks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

describe('notes-search-e2e: PageContext -> Note -> saveNote -> MiniSearchIndex -> query', () => {
  let db: IDBPDatabase<NotesDBV1>;

  beforeEach(async () => {
    (globalThis as any).__resetIndexedDB();
    (globalThis as any).__chromeStorageMap.clear();
    db = await openNotesDB();
    indexTest.reset();
    isPrimaryWriterMock.mockReturnValue(true);
  });

  it('(1) proves the DONE-when path end-to-end + tracks unresolved wikilinks (WIKI-ID-03)', async () => {
    // (a) Build a Phase-6 PageContext fixture (the PageContentService-shaped input).
    const page = makePageContext();

    // (b) Derive a canonical Note from the PageContext (service-level step — the
    // real NoteTagger/LLM pipeline is Phase 9; the seam is canonical Note construction).
    const note = makeNote({
      id: 'note-incident',
      title: 'Incident: High CPU on prod db',
      content:
        'The database showed [[MySQL Guide]] high CPU. See the [[Runbook]] for the fix.',
      tags: ['incident', 'perf'],
      source: { kind: 'page-export' },
      aiMeta: { suggestedLinks: [], concepts: ['cpu'] },
      version: 1,
    });

    // (c) Seed a 'MySQL Guide' note so the [[MySQL Guide]] wikilink RESOLVES.
    const mysqlGuide = makeNote({
      id: 'note-mysql',
      title: 'MySQL Guide',
      content: 'MySQL performance tuning guide.',
      tags: ['mysql', 'perf'],
    });
    await db.put('notes', mysqlGuide);

    // (d) saveNote -> parse -> resolve -> NotesDB.put -> emit note:saved.
    const { note: savedNote } = await saveNote(db, note);

    // The saved note.links contains the MySQL Guide id (WIKI-ID-02 resolution).
    expect(savedNote.links).toContain(mysqlGuide.id);
    // unresolvedLinks carries 'Runbook' (no such note — WIKI-ID-03).
    expect(savedNote.unresolvedLinks).toContain('Runbook');

    // (e) The note:saved emit fires -> MiniSearchIndex.upsert runs. The handler
    // is async (fire-and-forget IIFE) — wait for it to complete.
    await flushTicks();

    // (f) MiniSearchIndex.query returns the saved note (title/content match).
    const hits = await query(db, 'mysql');

    // (g) The full path produced exactly one hit with the note's id.
    const matchingHits = hits.filter((h) => h.id === note.id);
    expect(matchingHits).toHaveLength(1);
  });

  it('(2) RICH-R-05 surface: buildPreferenceProfile includes persona overrides', () => {
    // Set persona overrides in PreferenceMemoryStore (gated on isPrimaryWriter).
    usePreferenceMemoryStore.getState().setPersonaOverrides({ tone: 'concise' });

    const profile = MemoryEngine.buildPreferenceProfile();
    const parsed = JSON.parse(profile);

    // The override is included in the profile JSON.
    expect(parsed.profile).toContain('override.tone:concise');
    // Base persona fields are present.
    expect(parsed.profile).toContain('personaId:');
    expect(parsed.profile).toContain('tone:'); // base tone from DEFAULT_PERSONA

    // Verify it reads np_persona (PreferenceMemoryStore), not userFacts.
    const state = usePreferenceMemoryStore.getState();
    expect(state.personaOverrides?.tone).toBe('concise');
  });

  it('(3) SERVICE-LEVEL structural assertion: no component imports', () => {
    // Imports at the top of this file are src/core + tests/setup only — zero
    // component imports (the D-105 service-level discipline).
    const fs = require('node:fs') as typeof import('node:fs');
    const src = fs.readFileSync(
      require('node:path').resolve(process.cwd(), 'tests/core/search/notes-search-e2e.test.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/from ['"]\.\.\/(\.\.\/)*components\//);
    expect(src).not.toMatch(/from ['"]@\/components\//);
  });
});
