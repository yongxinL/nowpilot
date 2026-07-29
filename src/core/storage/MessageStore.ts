import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface MessageState {
  ready: boolean;
  messages: Array<{
    id: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: number;
  }>;
}

export const useMessageStore = create<MessageState>()(
  immer((_set, _get) => ({
    ready: false,
    messages: [],
  })),
);
