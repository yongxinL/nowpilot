// tests/components/pages/NotesPage.test.tsx — Phase 5 (05-07, D-05-15/16/17,
// KNW-01/03, SC#5): the E5 placeholder is replaced by the real Notes workspace.
// Contract per the UI-SPEC NotesPage rows: empty state, New note draft, the
// D-05-15 save pipeline (parseLinks → resolveLinks → putNote → 'note:saved' →
// index add), unresolved links + WIKI-ID-03 promotion on save, delete +
// WIKI-ID-04 reconciliation (+ failure toast), star via WorkspaceStore
// selectedNotes (D-18), dirty guard, MiniSearch search filtering, and
// New-note-from-page (D-05-13). NotesDB runs REAL over fake-indexeddb (fresh
// factory per test — NotesDB.test.ts pattern); the EventBus is the real
// singleton with an in-test subscriber.
import { App as AntdApp } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPDatabase } from 'idb';

import { NotesPage } from '@/components/pages/NotesPage';
import { getEventBus } from '@/core/events/EventBusManager';
import { STR } from '@/core/i18n/strings';
import {
  getNote,
  listNotes,
  openNotesDB,
  putNote,
  type Note,
  type NotesDBSchema,
} from '@/core/storage/NotesDB';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import type { WorkspaceState } from '@/types/workspace';
import * as NotesDB from '@/core/storage/NotesDB';

// jsdom lacks ResizeObserver/IntersectionObserver — antd Badge/Popconfirm rely
// on them; minimal no-op stubs keep the real components alive (ChatPage
// precedent).
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
class NoopIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [];
}

function freshWorkspace(): WorkspaceState {
  return {
    workspaceId: 'ws-test',
    conversationId: 'conv-test',
    pinnedTabs: [],
    selectedNotes: [],
    activeSurface: 'standalone',
    version: 0,
    updatedAt: 0,
  };
}

function makeNote(id: string, title: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    title,
    content: `content of ${title}`,
    created: 1,
    updated: 2,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

const PAGE_CONTEXT = {
  url: 'https://example.com/article',
  origin: 'https://example.com',
  hostname: 'example.com',
  title: 'Page Title',
  markdown: '# Page Body',
  meta: {},
  extractedAt: 1,
};

describe('NotesPage — real Notes workspace (05-07)', () => {
  let db: IDBPDatabase<NotesDBSchema>;
  const events: unknown[] = [];
  const handler = (data: unknown): void => {
    events.push(data);
  };

  async function seed(notes: Note[]): Promise<void> {
    db = await openNotesDB();
    for (const note of notes) await putNote(db, note);
  }

  beforeEach(() => {
    indexedDB = new IDBFactory();
    events.length = 0;
    useWorkspaceStore.setState({ workspace: freshWorkspace(), isReady: true });
    getEventBus().subscribe('note:saved', handler);
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    vi.stubGlobal('IntersectionObserver', NoopIntersectionObserver);
  });

  afterEach(() => {
    getEventBus().unsubscribe('note:saved', handler);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderPage() {
    return render(
      <AntdApp>
        <NotesPage />
      </AntdApp>,
    );
  }

  function cardOf(noteId: string): HTMLElement | null {
    return document.querySelector(`[data-np-note-card="${noteId}"]`);
  }

  it('empty state: no notes → STR.notes.empty rendered, header CTAs visible', async () => {
    await seed([]);
    renderPage();
    expect(await screen.findByText(STR.notes.empty)).toBeTruthy();
    expect(screen.getByText(STR.notes.newNote)).toBeTruthy();
    expect(screen.getByPlaceholderText(STR.notes.searchPlaceholder)).toBeTruthy();
    // New note from page is hidden without a currentPageContext (D-05-13).
    expect(screen.queryByText(STR.notes.newNoteFromPage)).toBeNull();
    // Editor shows the no-selection copy.
    expect(screen.getByText(STR.notes.selectNote)).toBeTruthy();
  });

  it('new note: click STR.notes.newNote → empty draft, selectNote copy gone, Save disabled', async () => {
    await seed([]);
    renderPage();
    await screen.findByText(STR.notes.empty);
    fireEvent.click(screen.getByText(STR.notes.newNote));
    expect(screen.queryByText(STR.notes.selectNote)).toBeNull();
    const title = document.querySelector('[data-np-note-title="1"]') as HTMLInputElement;
    expect(title).not.toBeNull();
    expect(title.value).toBe('');
    // Save is disabled until the draft is dirty.
    expect(screen.getByText(STR.notes.save).closest('button')).toBeDisabled();
  });

  it('save pipeline: [[Alpha]] resolves to Alpha id, note:saved emitted with { noteId }', async () => {
    await seed([makeNote('alpha', 'Alpha')]);
    renderPage();
    // Select Alpha from the list.
    await waitFor(() => expect(cardOf('alpha')).not.toBeNull());
    fireEvent.click(cardOf('alpha')!);
    await waitFor(() => expect(screen.getByText(STR.notes.save)).toBeTruthy());

    const title = document.querySelector('[data-np-note-title="1"]') as HTMLInputElement;
    const body = document.querySelector('[data-np-note-body="1"]') as HTMLTextAreaElement;
    fireEvent.change(title, { target: { value: 'My Note' } });
    fireEvent.change(body, { target: { value: 'See [[Alpha]]' } });

    fireEvent.click(screen.getByText(STR.notes.save));
    await waitFor(() => expect(events.length).toBeGreaterThanOrEqual(1));
    const savedId = (events[0] as { noteId: string }).noteId;
    expect(typeof savedId).toBe('string');
    const saved = await getNote(db, savedId);
    expect(saved).toBeDefined();
    expect(saved!.title).toBe('My Note');
    // Resolved at save time — links[] carries Alpha's id (WIKI-ID-02).
    expect(saved!.links).toEqual(['alpha']);
    expect(saved!.unresolvedLinks).toEqual([]);
  });

  it('unresolved [[Ghost]] persists in unresolvedLinks; creating note Ghost promotes it (WIKI-ID-03)', async () => {
    await seed([makeNote('alpha', 'Alpha')]);
    renderPage();
    await waitFor(() => expect(cardOf('alpha')).not.toBeNull());
    fireEvent.click(cardOf('alpha')!);
    await waitFor(() => expect(screen.getByText(STR.notes.save)).toBeTruthy());

    const title = document.querySelector('[data-np-note-title="1"]') as HTMLInputElement;
    const body = document.querySelector('[data-np-note-body="1"]') as HTMLTextAreaElement;
    fireEvent.change(title, { target: { value: 'Note A' } });
    fireEvent.change(body, { target: { value: 'See [[Ghost]]' } });
    fireEvent.click(screen.getByText(STR.notes.save));
    await waitFor(() => expect(events.length).toBeGreaterThanOrEqual(1));
    const noteAId = (events[0] as { noteId: string }).noteId;
    const noteA = await getNote(db, noteAId);
    expect(noteA!.unresolvedLinks).toEqual(['Ghost']);

    // Create the 'Ghost' note → save-time reconciliation promotes the earlier
    // note's unresolvedLinks[] into links[] (D-05-14).
    fireEvent.click(screen.getByText(STR.notes.newNote));
    const title2 = document.querySelector('[data-np-note-title="1"]') as HTMLInputElement;
    fireEvent.change(title2, { target: { value: 'Ghost' } });
    fireEvent.click(screen.getByText(STR.notes.save));
    await waitFor(() => expect(events.length).toBeGreaterThanOrEqual(2));
    const ghostId = (events[1] as { noteId: string }).noteId;

    // The reconciliation is fire-and-forget — wait for the persisted update.
    await waitFor(async () => {
      const updated = await getNote(db, noteAId);
      expect(updated!.links).toContain(ghostId);
      expect(updated!.unresolvedLinks).toEqual([]);
    });
  });

  it('delete: Popconfirm → deleteNote → list refreshes; failure → STR.notes.deleteFailed toast', async () => {
    await seed([makeNote('n1', 'Note One'), makeNote('n2', 'Note Two')]);
    renderPage();
    await waitFor(() => expect(cardOf('n1')).not.toBeNull());
    fireEvent.click(cardOf('n1')!);
    await waitFor(() => expect(screen.getByText(STR.notes.save)).toBeTruthy());

    // Delete via the editor-header delete affordance (Popconfirm).
    const deleteBtn = document.querySelector('[aria-label*="Delete"]') as HTMLElement;
    fireEvent.click(deleteBtn);
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    await waitFor(async () => {
      const remaining = await listNotes(db);
      expect(remaining.map((n) => n.id)).not.toContain('n1');
    });
    // Sync with the delete handler's tail state updates (selectedId/draft
    // cleared) — otherwise they race the next selection below.
    await waitFor(() => expect(screen.getByText(STR.notes.selectNote)).toBeTruthy());

    // Failure path: deleteNote is a no-op → the post-condition check surfaces
    // the STR.notes.deleteFailed toast (never-throw contract).
    vi.spyOn(NotesDB, 'deleteNote').mockImplementation(async () => undefined);
    fireEvent.click(cardOf('n2')!);
    await waitFor(() => expect(document.querySelector('[aria-label*="Delete"]')).not.toBeNull());
    const deleteBtn2 = document.querySelector('[aria-label*="Delete"]') as HTMLElement;
    fireEvent.click(deleteBtn2);
    const ok2 = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok2);
    expect(await screen.findByText(STR.notes.deleteFailed)).toBeTruthy();
  });

  it('star: toggle → WorkspaceStore.selectedNotes contains the id; unstar removes it (D-18)', async () => {
    await seed([makeNote('n1', 'Note One')]);
    renderPage();
    await waitFor(() => expect(cardOf('n1')).not.toBeNull());
    // Star from the list card.
    fireEvent.click(screen.getByRole('button', { name: STR.notes.star }));
    await waitFor(() =>
      expect(useWorkspaceStore.getState().workspace.selectedNotes).toContain('n1'),
    );
    // Unstar removes it.
    fireEvent.click(screen.getByRole('button', { name: STR.notes.unstar }));
    await waitFor(() =>
      expect(useWorkspaceStore.getState().workspace.selectedNotes).not.toContain('n1'),
    );
  });

  it('dirty guard: dirty draft + switch note → STR.notes.discard Popconfirm appears', async () => {
    await seed([makeNote('n1', 'Note One'), makeNote('n2', 'Note Two')]);
    renderPage();
    await waitFor(() => expect(cardOf('n1')).not.toBeNull());
    fireEvent.click(cardOf('n1')!);
    await waitFor(() => expect(screen.getByText(STR.notes.save)).toBeTruthy());
    // Make the draft dirty.
    const body = document.querySelector('[data-np-note-body="1"]') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'unsaved edit' } });

    // Switching to another note while dirty → discard Popconfirm, selection blocked.
    fireEvent.click(cardOf('n2')!);
    expect(await screen.findByText(STR.notes.discard)).toBeTruthy();
    const title = document.querySelector('[data-np-note-title="1"]') as HTMLInputElement;
    expect(title.value).toBe('Note One');
    // OK (Discard) proceeds with the switch.
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(title.value).toBe('Note Two'));
  });

  it('search: query filters the list via searchNotes; zero hits → STR.notes.searchEmpty', async () => {
    await seed([makeNote('alpha', 'Alpha Note'), makeNote('beta', 'Beta Note')]);
    renderPage();
    await waitFor(() => expect(cardOf('alpha')).not.toBeNull());
    const search = document.querySelector('[data-np-search-input="1"]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Alp' } });
    await waitFor(() => expect(cardOf('alpha')).not.toBeNull());
    expect(cardOf('beta')).toBeNull();
    // Results count line is visible for a non-empty query.
    expect(document.querySelector('[data-np-results-count="1"]')?.textContent).toContain('1');
    // Zero hits → searchEmpty. ('xyzzy' — no token prefix-matches the seeded
    // titles/content, unlike e.g. 'no' → 'note'.)
    fireEvent.change(search, { target: { value: 'xyzzy' } });
    expect(await screen.findByText(STR.notes.searchEmpty)).toBeTruthy();
  });

  it('new note from page: ghost CTA renders only with currentPageContext and pre-fills a page-export draft (D-05-13/SC#5)', async () => {
    await seed([]);
    // Without context → hidden.
    renderPage();
    await screen.findByText(STR.notes.empty);
    expect(screen.queryByText(STR.notes.newNoteFromPage)).toBeNull();
    cleanupDom();

    // With context → visible; clicking drafts title=page title, body=page
    // markdown; saving persists source.kind 'page-export'.
    useWorkspaceStore.setState({
      workspace: { ...freshWorkspace(), currentPageContext: PAGE_CONTEXT },
    });
    renderPage();
    const ghost = await screen.findByText(STR.notes.newNoteFromPage);
    fireEvent.click(ghost);
    const title = document.querySelector('[data-np-note-title="1"]') as HTMLInputElement;
    const body = document.querySelector('[data-np-note-body="1"]') as HTMLTextAreaElement;
    expect(title.value).toBe('Page Title');
    expect(body.value).toBe('# Page Body');
    fireEvent.click(screen.getByText(STR.notes.save));
    await waitFor(() => expect(events.length).toBeGreaterThanOrEqual(1));
    const savedId = (events[0] as { noteId: string }).noteId;
    const saved = await getNote(db, savedId);
    expect(saved!.source).toEqual({ kind: 'page-export' });
    expect(saved!.title).toBe('Page Title');
  });
});

/** Render cleanup between two renders inside one test (RTL cleanup is per-test). */
function cleanupDom(): void {
  document.body.innerHTML = '';
}
