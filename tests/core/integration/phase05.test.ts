import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { notesDb, resetNotesDb } from '../../../src/core/notes/NotesDB';
import { noteSearchIndex } from '../../../src/core/notes/MiniSearchNoteIndex';
import { NoteGraph, getNoteGraph } from '../../../src/core/notes/NoteGraph';
import type { Note } from '../../../src/core/notes/NoteSchema';
import { getMemoryEngine, resetMemoryEngine } from '../../../src/core/memory/MemoryEngine';
import {
  PreferenceMemoryStore,
  resetPreferenceMemoryDb,
} from '../../../src/core/memory/PreferenceMemoryStore';
import { resetUserMemoryDb } from '../../../src/core/memory/UserMemoryStore';
import { resetConversationMemoryDb } from '../../../src/core/memory/ConversationMemoryStore';
import { resetJournalDb, getEntriesByStatus } from '../../../src/core/storage/WriteJournal';
import { setPrimarySurfaceId } from '../../../src/core/runtime/BroadcastBus';
import { createAgentTurnInputWithMemory } from '../../../src/core/ai/AgentTurnInput';
import {
  loadPersonaFromMemory,
  inject,
} from '../../../src/core/ai/persona/PersonaInjector';

/**
 * Phase 5 end-to-end integration suite — imports REAL modules (only
 * IndexedDB is faked via tests/setup.ts). Proves the complete notes and
 * memory cycles the subsystem is built for: save→index→search→graph and
 * write→retrieve→score→tier-gate, plus the MemoryEngine→AI-pipeline feed.
 */

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: crypto.randomUUID(),
    title: 'Test Note',
    content: 'Plain content without links',
    tags: ['work'],
    categoryPath: '',
    createdAt: 1000,
    updatedAt: 1000,
    version: 1,
    provenance: { source: 'user-created' },
    links: [],
    unresolvedLinks: [],
    ...overrides,
  };
}

async function resetAllDbs(): Promise<void> {
  await Promise.all([
    resetNotesDb(),
    resetConversationMemoryDb(),
    resetUserMemoryDb(),
    resetPreferenceMemoryDb(),
  ]);
  await resetJournalDb();
  // the MiniSearch index singleton and NoteGraph hold in-memory state
  await noteSearchIndex.rebuild([]);
  NoteGraph.resetInstance();
}

describe('Phase 5 integration', () => {
  let engine: ReturnType<typeof getMemoryEngine>;
  let prefStore: PreferenceMemoryStore;

  beforeEach(async () => {
    await resetAllDbs();
    resetMemoryEngine();
    (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ =
      'test-surface';
    setPrimarySurfaceId('test-surface');
    engine = getMemoryEngine();
    prefStore = new PreferenceMemoryStore();
  });

  afterEach(() => {
    delete (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__;
    setPrimarySurfaceId(null);
  });

  it('full notes lifecycle: save [[wikilink]] → search finds it → backlinks work → retrieve complete note', async () => {
    const target = makeNote({
      id: crypto.randomUUID(),
      title: 'Linked Note',
      content: 'Deep notes about linked topics',
    });
    const targetSave = await notesDb.save(target);
    expect(targetSave.success).toBe(true);

    const source = makeNote({
      id: crypto.randomUUID(),
      title: 'Source Note',
      content: 'See [[Linked Note]] for context',
    });
    const sourceSave = await notesDb.save(source);
    expect(sourceSave.success).toBe(true);

    // MiniSearch index finds the note by title/content (BM25, title boost)
    const results = noteSearchIndex.search('Linked');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.noteId === target.id)).toBe(true);

    // NoteGraph derives backlinks from links[] — never stored (D-01)
    const allNotes = await notesDb.getAll();
    const backlinks = getNoteGraph().getBacklinks(target.id, allNotes);
    expect(backlinks).toContain(source.id);

    // retrieve the complete note with resolved link IDs
    const found = await notesDb.get(source.id);
    expect(found.success).toBe(true);
    if (found.success) {
      expect(found.note.links).toEqual([target.id]);
      expect(found.note.unresolvedLinks).toEqual([]);
      expect(found.note.content).toContain('[[Linked Note]]');
    }
  });

  it('full memory lifecycle: write user fact → retrieve as ContextItem → scored → tier-gated', async () => {
    const write = await engine.write(
      {
        content: 'prefers dark mode for the editor',
        memoryType: 'semantic',
        tags: ['preferences'],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );
    expect(write.success).toBe(true);

    const retrieved = await engine.retrieve({
      conversationId: 'c1',
      query: 'dark mode',
      tier: 'small',
    });
    expect(retrieved.success).toBe(true);
    if (!retrieved.success) return;
    const factItem = retrieved.items.find((i) => i.sourceId.startsWith('memory.user.fact.'));
    expect(factItem).toBeDefined();
    if (!factItem) return;
    expect(factItem.kind).toBe('memory');
    expect(factItem.text).toContain('dark mode');
    expect(factItem.relevance).toBeGreaterThanOrEqual(0.3); // D-09 MIN_SCORE floor
    expect(factItem.trust).toBe(1.0); // explicit-user confidence (D-07)
    expect(factItem.sensitivity).toBe('private');
    expect(factItem.instructionAuthority).toBe('data');
  });

  it('tier-gating integration: tiny ≤3 facts, small ≤5 facts, all scores ≥0.30 (D-09)', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await engine.write(
        {
          content: `theme planning notes ${i}`,
          memoryType: 'semantic',
          tags: ['preferences'],
          sensitivity: 'private',
          source: 'explicit-user',
        },
        'user-action',
      );
      expect(res.success).toBe(true);
    }

    const tiny = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'tiny' });
    const small = await engine.retrieve({ conversationId: 'c1', query: 'theme', tier: 'small' });
    expect(tiny.success).toBe(true);
    expect(small.success).toBe(true);
    if (!tiny.success || !small.success) return;

    const tinyFacts = tiny.items.filter((i) => i.sourceId.startsWith('memory.user.fact.'));
    const smallFacts = small.items.filter((i) => i.sourceId.startsWith('memory.user.fact.'));
    expect(tinyFacts.length).toBeLessThanOrEqual(3);
    expect(smallFacts.length).toBeLessThanOrEqual(5);
    for (const f of smallFacts) {
      expect(f.relevance).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('write-journal integration: note save journals save-note-with-links with write-note + update-index steps', async () => {
    const note = makeNote({ id: crypto.randomUUID(), title: 'Journaled Note' });
    const res = await notesDb.save(note);
    expect(res.success).toBe(true);

    const completed = await getEntriesByStatus('completed');
    const entry = completed.find((e) => e.operation === 'save-note-with-links');
    expect(entry).toBeDefined();
    if (entry) {
      expect(entry.status).toBe('completed');
      const stepNames = entry.steps.map((s) => s.name);
      expect(stepNames).toContain('write-note');
      expect(stepNames).toContain('update-index');
    }
  });

  it('persona-integration: np_persona flows MemoryEngine → loadPersonaFromMemory → PersonaInjector', async () => {
    await prefStore.set('np_persona', {
      id: 'p1',
      name: 'Ada',
      tone: 'formal',
      brevity: 'concise',
      coreValues: ['Precision'],
      languageStyle: 'Technical',
    });

    const persona = await loadPersonaFromMemory();
    expect(persona.name).toBe('Ada');
    expect(persona.tone).toBe('formal');

    const rendered = inject('renderer', 'base system prompt', { profile: persona });
    expect(rendered).toContain('Name: Ada');
    expect(rendered).toContain('base system prompt');
  });

  it('createAgentTurnInputWithMemory populates memoryHints, preferences, and personaBehavior from MemoryEngine', async () => {
    await prefStore.set('np_persona', {
      id: 'p2',
      name: 'Bella',
      tone: 'friendly',
      brevity: 'balanced',
      coreValues: ['Clarity'],
    });
    const fact = await engine.write(
      {
        content: 'user prefers the light theme',
        memoryType: 'semantic',
        tags: [],
        sensitivity: 'private',
        source: 'explicit-user',
      },
      'user-action',
    );
    expect(fact.success).toBe(true);

    const input = await createAgentTurnInputWithMemory(
      {
        userInput: 'theme',
        conversationId: 'c1',
        workspaceId: 'w1',
        model: 'gpt-4o-mini',
        modelContextWindow: 128000,
        activeSurface: 'sidepanel',
        providerId: 'openai',
        tier: 'FAST',
      },
      'c1',
      'small',
    );

    // memory context from MemoryEngine flows into the turn (must_have)
    expect(input.memoryHints.length).toBeGreaterThan(0);
    const factHint = input.memoryHints.find((h) =>
      String((h as { sourceId?: string }).sourceId ?? '').startsWith('memory.user.fact.'),
    );
    expect(factHint).toBeDefined();
    expect((input.preferences as Record<string, unknown>).np_persona).toBeDefined();
    expect(input.personaBehavior).not.toBeNull();
  });
});
