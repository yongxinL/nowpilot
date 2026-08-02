import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { SidePanelShell } from '../../src/components/sidepanel/SidePanelShell';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore } from '../../src/core/theme/ThemeStore';
import { pageContentService } from '../../src/core/extraction/PageContentService';
import { getNoteFileSync } from '../../src/core/notes/NoteFileSync';
import { getNotesDb } from '../../src/core/notes/NotesDB';
import '../../src/index.css';

if (import.meta.env.DEV) {
  const db = getNotesDb();
  (window as any).__nowpilot = {
    init: () => getNoteFileSync().initNoteFileSync(),
    backup: () => getNoteFileSync().setBackupFolder(),
    status: () => getNoteFileSync().getSyncStatus(),
    sync: (noteId: string) => getNoteFileSync().syncNote(noteId),
    saveNote: (title: string, content: string) => {
      const now = Date.now();
      return db.save({
        id: crypto.randomUUID(),
        title,
        content,
        tags: [],
        categoryPath: '',
        createdAt: now,
        updatedAt: now,
        version: 1,
        provenance: { source: 'user-created' },
        links: [],
        unresolvedLinks: [],
      });
    },
    list: () => db.getAll(),
  };
}

// Initialize page content service listeners (SPA_NAVIGATION, tabs.onUpdated,
// tabs.onRemoved) for per-tab cache invalidation and MiniSearch index
// lifecycle. Safe to call multiple times — subsequent calls are no-ops
// (init() has idempotent guard).
pageContentService.init();

const SidepanelApp = () => {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = useMemo(() => getAppTheme(isDark), [isDark]);

  return (
    <ConfigProvider theme={theme}>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <SidePanelShell />
      </AntdApp>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
