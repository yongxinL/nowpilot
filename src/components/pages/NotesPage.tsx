// src/components/pages/NotesPage.tsx — Phase 5 (05-07, D-05-16/17, KNW-01/02/03,
// UI-SPEC Notes workspace contract): the E5 placeholder is REPLACED by the real
// Standalone Notes view — header (search + Notes|Graph Segmented + New-note-from-
// page + New note) over two panes: the list column (note cards sorted updated
// desc, star toggle, 2-line-clamp snippet, tag chips, relative time) and the
// editor column (title 20/600 borderless + star + Edit|Preview + dirty caption
// + Save Note + delete Popconfirm; tag chips; body TextArea with the '[['
// WikilinkAutocomplete / PortableMarkdown preview with wikilink resolution;
// BacklinksPanel below). The save pipeline runs D-05-15 VERBATIM:
// parseLinks → resolveLinks → putNote → EventBus 'note:saved' → MiniSearch
// incremental add + graph/backlinks re-derivation (write paths never throw —
// failures surface as STR.notes.saveFailed inline Retry with the draft
// retained, detected via post-condition re-read since the store never throws).
// Delete runs WIKI-ID-04 dangling-edge reconciliation; the dirty guard
// Popconfirms on selection/graph switches; star persists via
// WorkspaceStore.toggleSelectedNote (D-18 selectedNotes activation, no type
// widening). Every string comes from STR.notes.* (Golden Rule 2); every catch
// debugLogs a canonical code (Golden Rule 9); the body renders ONLY through
// PortableMarkdown/TextArea (never raw HTML injection, R-10/T-1-07).
// Standalone-only (R-3): no chrome.* calls here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Empty,
  Input,
  Popconfirm,
  Segmented,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import MiniSearch from 'minisearch';
import { BacklinksPanel } from '@/components/notes/BacklinksPanel';
import { NoteGraphView } from '@/components/notes/NoteGraphView';
import {
  WikilinkAutocomplete,
  buildAnchorA11y,
  type WikilinkAutocompleteHandle,
} from '@/components/notes/WikilinkAutocomplete';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { PortableMarkdown } from '@/core/components/PortableMarkdown';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { getEventBus } from '@/core/events/EventBusManager';
import { STR } from '@/core/i18n/strings';
import { parseLinks, promoteUnresolvedLinks, resolveLinks } from '@/core/notes/LinkParser';
import { resolveDanglingOnDelete } from '@/core/notes/NoteGraph';
import {
  addToNotesIndex,
  buildNotesIndex,
  docFor,
  removeFromNotesIndex,
  searchNotes,
  type NoteSearchDoc,
} from '@/core/search/MiniSearchIndex';
import {
  deleteNote,
  getNote,
  listNotes,
  openNotesDB,
  putNote,
  type Note,
  type NotesDBSchema,
} from '@/core/storage/NotesDB';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type { IDBPDatabase } from 'idb';

/** Fallback title on persist when the user leaves the title empty (UI-SPEC). */
const UNTITLED = 'Untitled';
/** Edit|Preview view-toggle labels (UI-SPEC L185 — no canonical STR keys exist). */
const MODE_OPTIONS = [
  { label: 'Edit', value: 'edit' as const },
  { label: 'Preview', value: 'preview' as const },
];
/** Stable listbox id shared by the TextArea anchor and the autocomplete. */
const WIKI_LIST_ID = 'np-notes-wikilink-list';

interface DraftState {
  title: string;
  content: string;
  tags: string[];
  source: Note['source'];
}

/** Title-only MiniSearch for the '[[ ' autocomplete (05-05 searchNotes seam). */
function buildTitleIndex(notes: readonly Note[]): MiniSearch<NoteSearchDoc> {
  const mini = new MiniSearch<NoteSearchDoc>({
    fields: ['title'],
    storeFields: ['title'],
    idField: 'id',
  });
  mini.addAll(notes.map(docFor));
  return mini;
}

/** Relative-time caption ("10m ago" — UI-SPEC planner discretion). */
function relativeTime(ts: number, now: number): string {
  const diff = now - ts;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diff < 60_000) return rtf.format(-Math.max(1, Math.round(diff / 1000)), 'second');
  if (diff < 3_600_000) return rtf.format(-Math.round(diff / 60_000), 'minute');
  if (diff < 86_400_000) return rtf.format(-Math.round(diff / 3_600_000), 'hour');
  if (diff < 604_800_000) return rtf.format(-Math.round(diff / 86_400_000), 'day');
  return rtf.format(-Math.round(diff / 604_800_000), 'week');
}

/** UI-SPEC [Retry] token convention: the canonical string keeps its action
    token; the UI renders the prefix text + a Retry button (ChatPage precedent). */
function stripActionToken(copy: string): string {
  return copy.split(' [')[0];
}

export function NotesPage() {
  const { token } = theme.useToken();
  const { notification } = App.useApp();

  // --- Workspace D-18 fields (star set + page-context gate) ---
  const selectedNotes = useWorkspaceStore((s) => s.workspace.selectedNotes);
  const currentPageContext = useWorkspaceStore((s) => s.workspace.currentPageContext);

  // --- Data + list state ---
  const dbRef = useRef<IDBPDatabase<NotesDBSchema> | null>(null);
  const indexRef = useRef<MiniSearch<NoteSearchDoc> | null>(null);
  const titleIndexRef = useRef<MiniSearch<NoteSearchDoc> | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');

  // --- Editor state ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveError, setSaveError] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  // --- View + search state ---
  const [view, setView] = useState<'notes' | 'graph'>('notes');
  const [query, setQuery] = useState('');

  // --- Wikilink autocomplete state (Open Q5 — page owns the trigger) ---
  const bodyRef = useRef<TextAreaRef | null>(null);
  const caretRef = useRef(0);
  const wikiRef = useRef<WikilinkAutocompleteHandle | null>(null);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiHighlighted, setWikiHighlighted] = useState(0);
  const [wikiAnnouncement, setWikiAnnouncement] = useState('');

  const loadNotes = useCallback(async () => {
    setListState('loading');
    try {
      dbRef.current = await openNotesDB();
      const notes = await listNotes(dbRef.current);
      indexRef.current = buildNotesIndex(notes);
      titleIndexRef.current = buildTitleIndex(notes);
      setAllNotes(notes);
      setListState('ready');
    } catch (err) {
      debugLog(ERROR_CODES.STORE_READ, 'notes mount failed', {
        error: err instanceof Error ? err : undefined,
        module: 'NotesPage',
      });
      setListState('error');
    }
  }, []);

  // note:saved handler — T-05-25: the payload noteId is re-validated (string)
  // before the index/state are touched; index adds are incremental (D-05-12).
  const onNoteSaved = useCallback((data: unknown) => {
    const payload = data as { noteId?: unknown };
    if (typeof payload?.noteId !== 'string' || payload.noteId.length === 0) return;
    const noteId = payload.noteId;
    void (async () => {
      try {
        const db = dbRef.current;
        if (!db) return;
        const note = await getNote(db, noteId);
        if (note) {
          if (indexRef.current) addToNotesIndex(indexRef.current, note);
          titleIndexRef.current?.add(docFor(note));
        }
        setAllNotes(await listNotes(db));
      } catch (err) {
        debugLog(ERROR_CODES.STORE_READ, 'note:saved refresh failed', {
          error: err instanceof Error ? err : undefined,
          module: 'NotesPage',
        });
      }
    })();
  }, []);

  useEffect(() => {
    const bus = getEventBus();
    bus.subscribe('note:saved', onNoteSaved);
    void loadNotes();
    return () => {
      bus.unsubscribe('note:saved', onNoteSaved);
    };
  }, [onNoteSaved, loadNotes]);

  // --- Selection + draft transitions ---
  const applySelect = useCallback((noteId: string) => {
    setAllNotes((current) => {
      const note = current.find((n) => n.id === noteId);
      if (note) {
        setSelectedId(noteId);
        setDraft({
          title: note.title,
          content: note.content,
          tags: note.tags,
          source: note.source,
        });
        setDirty(false);
        setMode('edit');
        setSaveError(false);
      }
      return current;
    });
  }, []);

  const handleOpenNote = useCallback(
    (noteId: string) => {
      // Single navigation contract (D-05-17): select it + switch to Notes view.
      applySelect(noteId);
      setView('notes');
    },
    [applySelect],
  );

  // Graph-node navigation (05-08): the SAME single navigation contract — a
  // node click selects the note + switches to the Notes view. With a dirty
  // draft the discard Popconfirm (wrapped around the graph pane below) gates
  // the switch: the pending note id applies only on Discard; Keep editing
  // stays in the Graph view (05-07 dirty-guard contract).
  const pendingGraphOpenRef = useRef<string | null>(null);
  const [graphDiscardPending, setGraphDiscardPending] = useState(false);
  const handleGraphOpen = useCallback(
    (noteId: string) => {
      if (dirty) {
        pendingGraphOpenRef.current = noteId;
        setGraphDiscardPending(true);
        return;
      }
      applySelect(noteId);
      setView('notes');
    },
    [applySelect, dirty],
  );

  // --- Save pipeline (D-05-15 VERBATIM: parse → resolve → put → note:saved
  //     → incremental index add + re-derivation; never throws) ---
  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaveError(false);
    try {
      const targets = parseLinks(draft.content);
      const { links, unresolvedLinks } = resolveLinks(targets, allNotes);
      const existing = selectedId !== null ? allNotes.find((n) => n.id === selectedId) : undefined;
      const now = Date.now();
      const note: Note = {
        // crypto.randomUUID() assigned at FIRST save — no empty rows in the list.
        id: existing?.id ?? crypto.randomUUID(),
        title: draft.title.trim() || UNTITLED,
        content: draft.content,
        created: existing?.created ?? now,
        updated: now,
        tags: draft.tags,
        links,
        unresolvedLinks,
        source: draft.source,
        aiMeta: { suggestedLinks: [], concepts: [] },
        version: (existing?.version ?? 0) + 1,
      };
      await putNote(dbRef.current!, note);
      // The store never throws — detect failure by post-condition re-read
      // (Rule 2: the never-throw contract still needs a visible failure path).
      const persisted = await getNote(dbRef.current!, note.id);
      if (persisted === undefined) {
        setSaveError(true);
        return;
      }
      getEventBus().emit('note:saved', { noteId: note.id });
      setSelectedId(note.id);
      setDraft({ title: note.title, content: note.content, tags: note.tags, source: note.source });
      setDirty(false);
      // WIKI-ID-03 save-time reconciliation — fire-and-forget, never blocks save.
      void reconcileAfterSave(note);
    } catch (err) {
      debugLog(ERROR_CODES.NOTE_LINK_PARSE_FAILED, 'note save failed', {
        error: err instanceof Error ? err : undefined,
        module: 'NotesPage',
      });
      setSaveError(true);
    }
  }, [draft, selectedId, allNotes]);

  // WIKI-ID-03 / D-05-14: after a successful save, promote matching
  // unresolvedLinks[] on the other notes (bounded — the exact candidate set;
  // primary surface only; NEVER blocks the save). The candidate set is read
  // from the DB fresh — the closure's allNotes may predate the note:saved
  // refresh of the just-saved note (stale-closure race, Rule 1).
  const reconcileAfterSave = useCallback(async (newNote: Note) => {
    try {
      const db = dbRef.current;
      if (!db) return;
      const fresh = await listNotes(db);
      const referencing = fresh.filter(
        (n) => n.id !== newNote.id && n.unresolvedLinks.includes(newNote.title),
      );
      const affected = promoteUnresolvedLinks(referencing, {
        id: newNote.id,
        title: newNote.title,
      });
      for (const { noteId, promoted, remaining } of affected) {
        const other = await getNote(db, noteId);
        if (!other) continue;
        const updated: Note = {
          ...other,
          links: [
            ...other.links.filter((id) => id !== newNote.id),
            ...promoted.map(() => newNote.id),
          ],
          unresolvedLinks: remaining,
          updated: Date.now(),
          version: other.version + 1,
        };
        await putNote(db, updated);
        if (indexRef.current) addToNotesIndex(indexRef.current, updated);
        getEventBus().emit('note:saved', { noteId: updated.id });
      }
    } catch (err) {
      debugLog(ERROR_CODES.NOTE_LINK_PARSE_FAILED, 'save-time reconciliation failed', {
        error: err instanceof Error ? err : undefined,
        module: 'NotesPage',
      });
    }
  }, []);

  // Cmd/Ctrl+S saves (component-local keydown; no global shortcut system).
  const saveRef = useRef<() => void>(() => {});
  const dirtyRef = useRef(false);
  useEffect(() => {
    saveRef.current = () => void handleSave();
  }, [handleSave]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirtyRef.current) saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- Delete pipeline (WIKI-ID-04: dangling edges move back into
  //     unresolvedLinks[] via the title lookup; index rebuilt) ---
  const handleDelete = useCallback(async () => {
    if (selectedId === null) return;
    const db = dbRef.current;
    if (!db) return;
    const deleted = allNotes.find((n) => n.id === selectedId);
    try {
      await deleteNote(db, selectedId);
      // Post-condition check (never-throw contract): the row must be gone.
      const stillThere = await getNote(db, selectedId);
      if (stillThere !== undefined) {
        notification.error({ message: STR.notes.deleteFailed, duration: 0 });
        return;
      }
      if (indexRef.current) removeFromNotesIndex(indexRef.current, selectedId);
      const dangling = resolveDanglingOnDelete(allNotes, selectedId);
      for (const { noteId, remaining } of dangling) {
        const other = await getNote(db, noteId);
        if (!other) continue;
        const updated: Note = {
          ...other,
          links: remaining,
          unresolvedLinks: other.unresolvedLinks.includes(deleted?.title ?? '')
            ? other.unresolvedLinks
            : [...other.unresolvedLinks, deleted?.title ?? ''],
          updated: Date.now(),
          version: other.version + 1,
        };
        await putNote(db, updated);
        if (indexRef.current) addToNotesIndex(indexRef.current, updated);
        getEventBus().emit('note:saved', { noteId: updated.id });
      }
      const fresh = await listNotes(db);
      setAllNotes(fresh);
      indexRef.current = buildNotesIndex(fresh);
      titleIndexRef.current = buildTitleIndex(fresh);
      setSelectedId(null);
      setDraft(null);
      setDirty(false);
    } catch (err) {
      debugLog(ERROR_CODES.STORE_WRITE, 'note delete failed', {
        error: err instanceof Error ? err : undefined,
        module: 'NotesPage',
      });
      notification.error({ message: STR.notes.deleteFailed, duration: 0 });
    }
  }, [selectedId, allNotes, notification]);

  // --- Create flows ---
  const handleNewNote = useCallback(() => {
    setDraft({ title: '', content: '', tags: [], source: { kind: 'manual' } });
    setSelectedId(null);
    // A fully-empty draft is not dirty — Save stays disabled until the user
    // types (plan contract: New note → empty draft, Save disabled).
    setDirty(false);
    setMode('edit');
    setSaveError(false);
  }, []);

  const handleNewNoteFromPage = useCallback(() => {
    const ctx = useWorkspaceStore.getState().workspace.currentPageContext;
    if (!ctx) return;
    // D-05-13 / SC#5: Page → PageContentService → Note (source.kind 'page-export').
    setDraft({
      title: ctx.title,
      content: ctx.markdown ?? '',
      tags: [],
      source: { kind: 'page-export' },
    });
    setSelectedId(null);
    setDirty(true);
    setMode('edit');
    setSaveError(false);
  }, []);

  // --- Star (D-18 selectedNotes activated as the favorites set) ---
  const toggleStar = useCallback((noteId: string) => {
    useWorkspaceStore.getState().toggleSelectedNote(noteId);
  }, []);
  const isStarred = (noteId: string): boolean => selectedNotes.includes(noteId);

  // --- Search + autocomplete (both consume the mounted 05-05 index) ---
  const filtered = useMemo(() => {
    const index = indexRef.current;
    if (!query || query.trim().length === 0) {
      return [...allNotes].sort((a, b) => b.updated - a.updated);
    }
    if (!index) return [];
    const results = searchNotes(index, query, { limit: 50 });
    const byId = new Map(allNotes.map((n) => [n.id, n]));
    return results.map((r) => byId.get(r.id)).filter((n): n is Note => n !== undefined);
  }, [query, allNotes]);

  const wikiMatches = useMemo(() => {
    const index = titleIndexRef.current;
    if (!wikiQuery || wikiQuery.trim().length === 0 || !index) return [];
    return searchNotes(index, wikiQuery, { limit: 8 }).map((r) => ({
      id: r.id,
      title: allNotes.find((n) => n.id === r.id)?.title ?? r.id,
    }));
  }, [wikiQuery, allNotes]);

  const effectiveWikiOpen = wikiOpen && wikiMatches.length > 0;

  const updateWikiState = useCallback((value: string, caret: number) => {
    const before = value.slice(0, caret);
    const lastBracket = before.lastIndexOf('[[');
    if (lastBracket >= 0) {
      const q = before.slice(lastBracket + 2);
      if (q.length >= 1) {
        setWikiQuery(q);
        setWikiHighlighted(0);
        setWikiOpen(true);
        return;
      }
    }
    setWikiQuery('');
    setWikiOpen(false);
  }, []);

  const handleBodyChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      caretRef.current = event.target.selectionStart ?? value.length;
      setDraft((d) => (d ? { ...d, content: value } : d));
      setDirty(true);
      updateWikiState(value, caretRef.current);
    },
    [updateWikiState],
  );

  const handleBodyKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (effectiveWikiOpen) {
        wikiRef.current?.handleKeyDown(event);
      }
    },
    [effectiveWikiOpen],
  );

  const handleWikiInsert = useCallback((title: string) => {
    let insertEnd = 0;
    setDraft((d) => {
      if (!d) return d;
      const caret = caretRef.current;
      const before = d.content.slice(0, caret);
      const lastBracket = before.lastIndexOf('[[');
      const start = lastBracket >= 0 ? lastBracket : caret;
      insertEnd = start + title.length + 4;
      return { ...d, content: d.content.slice(0, start) + `[[${title}]]` + d.content.slice(caret) };
    });
    setDirty(true);
    setWikiOpen(false);
    setWikiQuery('');
    setWikiAnnouncement(`[[${title}]]`);
    requestAnimationFrame(() => {
      const ta = bodyRef.current;
      const native = ta?.nativeElement as HTMLTextAreaElement | null;
      if (native) {
        native.focus();
        native.setSelectionRange(insertEnd, insertEnd);
      }
    });
  }, []);

  // The TextArea anchor announces the combobox relationship (UI-SPEC L250).
  const wikiAnchorA11y = buildAnchorA11y(
    effectiveWikiOpen,
    WIKI_LIST_ID,
    effectiveWikiOpen && wikiHighlighted >= 0
      ? `${WIKI_LIST_ID}-option-${wikiHighlighted}`
      : undefined,
  );

  const starLabel = (noteId: string): string =>
    isStarred(noteId) ? STR.notes.unstar : STR.notes.star;

  // --- Dirty guard (Popconfirm on selection / graph switches) ---
  const renderCard = (note: Note) => {
    const card = (
      <div
        data-np-note-card={note.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!dirty) applySelect(note.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !dirty) applySelect(note.id);
        }}
        style={{
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          marginBottom: 8,
          background: note.id === selectedId ? token.colorPrimaryBg : 'transparent',
          border:
            note.id === selectedId ? `1px solid ${token.colorPrimary}` : '1px solid transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Typography.Text
            strong
            ellipsis
            style={{
              flex: 1,
              fontSize: 14,
              color: note.id === selectedId ? token.colorPrimary : token.colorText,
            }}
          >
            {note.title}
          </Typography.Text>
          <Tooltip title={starLabel(note.id)}>
            <Button
              type="text"
              size="small"
              aria-label={starLabel(note.id)}
              icon={
                isStarred(note.id) ? (
                  <StarFilled style={{ color: token.colorWarning }} />
                ) : (
                  <StarOutlined />
                )
              }
              onClick={(event) => {
                event.stopPropagation();
                toggleStar(note.id);
              }}
              style={{ minWidth: 36, minHeight: 36 }}
            />
          </Tooltip>
        </div>
        <Typography.Paragraph
          type="secondary"
          style={{
            fontSize: 14,
            margin: '4px 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          ellipsis={{ rows: 2 }}
        >
          {note.content}
        </Typography.Paragraph>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {note.tags.slice(0, 3).map((tag) => (
            <Tag key={tag} style={{ fontSize: 12, marginInlineEnd: 0 }}>
              {tag}
            </Tag>
          ))}
          {note.tags.length > 3 && (
            <Typography.Text style={{ fontSize: 12 }} type="secondary">
              +{note.tags.length - 3}
            </Typography.Text>
          )}
          <Typography.Text
            style={{ fontSize: 12, marginLeft: 'auto', color: token.colorTextTertiary }}
          >
            {relativeTime(note.updated, Date.now())}
          </Typography.Text>
        </div>
      </div>
    );
    if (dirty) {
      // Dirty guard: switching selection with a dirty draft → Popconfirm.
      return (
        <Popconfirm
          key={note.id}
          title={STR.notes.discard}
          okButtonProps={{ danger: true }}
          onConfirm={() => applySelect(note.id)}
        >
          {card}
        </Popconfirm>
      );
    }
    return <div key={note.id}>{card}</div>;
  };

  const graphToggle = (
    <Segmented
      data-np-view-toggle="1"
      value={view}
      onChange={(value) => {
        const next = value as 'notes' | 'graph';
        // Dirty guard: the Graph switch with a dirty draft is Popconfirm-gated
        // (the wrapped Popconfirm's OK performs the switch).
        if (next === 'graph' && dirty) return;
        setView(next);
      }}
      options={[
        { label: STR.notes.viewNotes, value: 'notes' },
        { label: STR.notes.viewGraph, value: 'graph' },
      ]}
    />
  );

  // Graph pane (05-08): the d3-force view derives edges from allNotes on
  // demand (D-05-17 — no graph store; the note:saved list refresh re-derives
  // via the prop change). Loading/error/retry SHARE the list's state — the
  // copy lives inside NoteGraphView, no duplicate error state here.
  const graphPane = (
    <NoteGraphView
      notes={allNotes}
      selectedNoteId={selectedId ?? undefined}
      onOpenNote={handleGraphOpen}
      loading={listState === 'loading'}
      error={listState === 'error'}
      onRetry={() => void loadNotes()}
    />
  );

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Page header (hairline-bottom) */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            paddingBottom: 12,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Input
            data-np-search-input="1"
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            placeholder={STR.notes.searchPlaceholder}
            allowClear
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ flexGrow: 1, maxWidth: 360 }}
          />
          {dirty && view === 'notes' ? (
            <Popconfirm
              title={STR.notes.discard}
              okButtonProps={{ danger: true }}
              onConfirm={() => setView('graph')}
            >
              {graphToggle}
            </Popconfirm>
          ) : (
            graphToggle
          )}
          {currentPageContext !== undefined && (
            <Button ghost data-np-new-from-page="1" onClick={handleNewNoteFromPage}>
              {STR.notes.newNoteFromPage}
            </Button>
          )}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            data-np-new-note="1"
            onClick={handleNewNote}
          >
            {STR.notes.newNote}
          </Button>
        </div>

        {view === 'graph' ? (
          // NoteGraphView full-pane (UI-SPEC Graph visual contract: padding
          // lg + colorBgBase — the graph is a full-pane alternative view, not
          // a widget on the editor). With a dirty draft the pane is wrapped in
          // the discard Popconfirm (05-07 dirty-guard contract, now covering
          // the graph-node click): Discard opens the pending note, Keep
          // editing stays in the Graph view.
          <div
            data-np-graph-pane="1"
            style={{ flex: 1, minHeight: 0, padding: 24, background: token.colorBgBase }}
          >
            {dirty ? (
              <Popconfirm
                title={STR.notes.discard}
                okButtonProps={{ danger: true }}
                open={graphDiscardPending}
                onOpenChange={(open) => {
                  if (!open) {
                    pendingGraphOpenRef.current = null;
                    setGraphDiscardPending(false);
                  }
                }}
                onConfirm={() => {
                  const pending = pendingGraphOpenRef.current;
                  pendingGraphOpenRef.current = null;
                  setGraphDiscardPending(false);
                  if (pending) {
                    applySelect(pending);
                    setView('notes');
                  }
                }}
                onCancel={() => {
                  pendingGraphOpenRef.current = null;
                  setGraphDiscardPending(false);
                }}
              >
                {graphPane}
              </Popconfirm>
            ) : (
              graphPane
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 16, paddingTop: 12 }}>
            {/* List column (~300px, own scroll) */}
            <div
              data-np-note-list="1"
              style={{ width: 300, flexShrink: 0, overflowY: 'auto', paddingRight: 8 }}
            >
              {listState === 'loading' && (
                <div>
                  <Typography.Text type="secondary">{STR.notes.loading}</Typography.Text>
                  <Skeleton active paragraph={{ rows: 3 }} />
                </div>
              )}
              {listState === 'error' && (
                <Empty
                  description={stripActionToken(STR.notes.loadFailed)}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button size="small" onClick={() => void loadNotes()}>
                    {STR.chat.retry}
                  </Button>
                </Empty>
              )}
              {listState === 'ready' &&
                (filtered.length === 0 ? (
                  query.trim().length > 0 ? (
                    <Typography.Text type="secondary">{STR.notes.searchEmpty}</Typography.Text>
                  ) : (
                    <Empty description={STR.notes.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )
                ) : (
                  <div>
                    {filtered.map((note) => renderCard(note))}
                    {query.trim().length > 0 && (
                      <div
                        data-np-results-count="1"
                        style={{ fontSize: 12, color: token.colorTextTertiary, paddingTop: 4 }}
                      >
                        {STR.notes.resultsCount.replace('[n]', String(filtered.length))}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Editor column */}
            <div data-np-editor="1" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              {draft === null ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography.Text type="secondary">{STR.notes.selectNote}</Typography.Text>
                </div>
              ) : (
                <div>
                  {/* Editor header */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <Input
                      data-np-note-title="1"
                      variant="borderless"
                      value={draft.title}
                      onChange={(event) => {
                        setDraft((d) => (d ? { ...d, title: event.target.value } : d));
                        setDirty(true);
                      }}
                      style={{ fontSize: 20, fontWeight: 600, flex: 1 }}
                    />
                    {selectedId !== null && (
                      <Tooltip title={starLabel(selectedId)}>
                        <Button
                          type="text"
                          aria-label={starLabel(selectedId)}
                          icon={
                            isStarred(selectedId) ? (
                              <StarFilled style={{ color: token.colorWarning }} />
                            ) : (
                              <StarOutlined />
                            )
                          }
                          onClick={() => toggleStar(selectedId)}
                          style={{ minWidth: 36, minHeight: 36 }}
                        />
                      </Tooltip>
                    )}
                    <Segmented
                      data-np-mode-toggle="1"
                      value={mode}
                      onChange={(value) => setMode(value as 'edit' | 'preview')}
                      options={MODE_OPTIONS}
                    />
                    {dirty && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Badge status="warning" />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {STR.notes.unsaved}
                        </Typography.Text>
                      </span>
                    )}
                    <Button
                      type="primary"
                      data-np-save-note="1"
                      disabled={!dirty}
                      onClick={() => void handleSave()}
                      style={{ marginLeft: 'auto' }}
                    >
                      {STR.notes.save}
                    </Button>
                    {selectedId !== null && (
                      <Popconfirm
                        title={STR.notes.deleteConfirm.replace('[title]', draft.title || UNTITLED)}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => void handleDelete()}
                      >
                        <Tooltip
                          title={STR.notes.deleteConfirm.replace(
                            '[title]',
                            draft.title || UNTITLED,
                          )}
                        >
                          <Button
                            type="text"
                            danger
                            aria-label={STR.notes.deleteConfirm.replace(
                              '[title]',
                              draft.title || UNTITLED,
                            )}
                            icon={<DeleteOutlined />}
                            style={{ minWidth: 36, minHeight: 36 }}
                          />
                        </Tooltip>
                      </Popconfirm>
                    )}
                  </div>

                  {saveError && (
                    <div
                      data-np-save-error="1"
                      style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      <Typography.Text type="danger">
                        {stripActionToken(STR.notes.saveFailed)}
                      </Typography.Text>
                      <Button size="small" onClick={() => void handleSave()}>
                        {STR.chat.retry}
                      </Button>
                    </div>
                  )}

                  {/* Tag chips row */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginBottom: 8,
                      alignItems: 'center',
                    }}
                  >
                    {draft.tags.map((tag) => (
                      <Tag
                        key={tag}
                        closable
                        onClose={() => {
                          setDraft((d) =>
                            d ? { ...d, tags: d.tags.filter((t) => t !== tag) } : d,
                          );
                          setDirty(true);
                        }}
                      >
                        {tag}
                      </Tag>
                    ))}
                    <Input
                      data-np-add-tag="1"
                      size="small"
                      placeholder={STR.notes.addTag}
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                      onPressEnter={() => {
                        const next = tagDraft.trim();
                        if (next) {
                          setDraft((d) =>
                            d
                              ? { ...d, tags: d.tags.includes(next) ? d.tags : [...d.tags, next] }
                              : d,
                          );
                          setDirty(true);
                        }
                        setTagDraft('');
                      }}
                      style={{ width: 120 }}
                    />
                  </div>

                  {/* Body: TextArea (Edit, '[[ ' autocomplete) / PortableMarkdown (Preview) */}
                  <div style={{ position: 'relative' }}>
                    {mode === 'edit' ? (
                      <>
                        <Input.TextArea
                          ref={bodyRef}
                          data-np-note-body="1"
                          value={draft.content}
                          onChange={handleBodyChange}
                          onKeyDown={handleBodyKeyDown}
                          autoSize={{ minRows: 8, maxRows: 24 }}
                          {...wikiAnchorA11y}
                        />
                        <WikilinkAutocomplete
                          ref={wikiRef}
                          open={effectiveWikiOpen}
                          onOpenChange={setWikiOpen}
                          query={wikiQuery}
                          onQueryChange={(q) => {
                            setWikiQuery(q);
                            setWikiHighlighted(0);
                          }}
                          matches={wikiMatches}
                          onInsert={handleWikiInsert}
                          highlighted={wikiHighlighted}
                          onHighlightChange={setWikiHighlighted}
                          announcement={wikiAnnouncement}
                          listId={WIKI_LIST_ID}
                        />
                      </>
                    ) : (
                      <PortableMarkdown
                        content={draft.content}
                        wikilinks={{
                          resolve: (title) => {
                            const match = allNotes.find((n) => n.title === title);
                            return match ? { id: match.id } : null;
                          },
                          onOpen: handleOpenNote,
                          onCreate: (title) => {
                            // WIKI-ID-03: draft a new note titled Title.
                            setDraft({ title, content: '', tags: [], source: { kind: 'manual' } });
                            setSelectedId(null);
                            setDirty(true);
                            setMode('edit');
                            setSaveError(false);
                          },
                        }}
                      />
                    )}
                  </div>

                  {/* Backlinks section (below the body, collapsible) */}
                  {selectedId !== null && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <BacklinksPanel
                        noteId={selectedId}
                        notes={allNotes}
                        onOpenNote={handleOpenNote}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
