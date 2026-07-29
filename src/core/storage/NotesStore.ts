import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface NotesState {
  ready: boolean;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    categoryPath: string[];
    createdAt: number;
    updatedAt: number;
  }>;
}

export const useNotesStore = create<NotesState>()(
  immer((_set, _get) => ({
    ready: false,
    notes: [],
  })),
);
