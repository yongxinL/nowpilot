// src/components/pages/NotesPage.tsx — §18 canonical page (W-6 flat name).
// Renders the UI-SPEC E5 Notes empty state — verbatim copy 'Notes live here
// once you save your first one.' — with a 'New note' CTA Button (enabled but
// no-op per D-15: the CTA exists per UI-SPEC E5 but performs no stub action;
// clicking logs debugLog COMPONENT_RENDER silent:true — the real note editor
// lands in the notes phase). Wrapped in ErrorBoundary. No chrome API calls
// (Pitfall 4).
import { Button, Card, Empty } from 'antd';
import { WorkspacePageSkeleton } from '@/components/pages/standalone/WorkspacePageSkeleton';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

// UI-SPEC Copywriting Contract — E5 Notes empty state (verbatim).
const NOTES_EMPTY_COPY = 'Notes live here once you save your first one.';
// UI-SPEC Copywriting Contract — E5 Notes CTA label (verbatim; STR.notes.newNote).
const NEW_NOTE_LABEL = 'New note';

export function NotesPage() {
  const handleNewNote = (): void => {
    // D-15: the CTA exists per UI-SPEC E5 line 113/148 but performs no stub
    // action this phase — clicking only records the interaction.
    debugLog(ERROR_CODES.COMPONENT_RENDER, 'NotesPage: New note CTA clicked (no-op this phase)', {
      silent: true,
      module: 'NotesPage',
    });
  };

  return (
    <ErrorBoundary>
      <Card>
        <WorkspacePageSkeleton />
        <Empty description={NOTES_EMPTY_COPY}>
          <Button type="primary" onClick={handleNewNote}>
            {NEW_NOTE_LABEL}
          </Button>
        </Empty>
      </Card>
    </ErrorBoundary>
  );
}
