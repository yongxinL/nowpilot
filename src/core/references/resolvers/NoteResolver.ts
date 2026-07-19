import { notesDB } from '../../storage/stores/NotesDB';
import { linkParser } from '../../notes/LinkParser';
import type { ReferenceToken } from '../ReferenceToken';
import type { AutocompleteResult, ReferenceResolver } from '../ReferenceResolver';

export class NoteResolver implements ReferenceResolver {
  getType(): string {
    return 'note';
  }

  async search(query: string): Promise<AutocompleteResult[]> {
    const results = linkParser.search(query);
    return results.slice(0, 10).map((r) => ({
      token: {
        type: 'note',
        id: r.id,
        title: r.title,
        displayLabel: `@note:${r.title}`,
      },
      icon: 'FileTextOutlined',
      color: 'colorPrimary',
      subtitle: r.snippet ? r.snippet.slice(0, 60) : undefined,
    }));
  }

  async validate(token: ReferenceToken): Promise<{ valid: boolean; reason?: string }> {
    const note = await notesDB.getNote(token.id);
    if (!note) return { valid: false, reason: 'Note not found or deleted' };
    return { valid: true };
  }

  async resolve(token: ReferenceToken): Promise<{ title: string; content: string } | null> {
    const note = await notesDB.getNote(token.id);
    if (!note) return null;
    return { title: note.title, content: note.content };
  }
}

export const noteResolver = new NoteResolver();
