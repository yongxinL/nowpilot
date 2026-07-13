import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDB, mockDb } = vi.hoisted(() => {
  const mockIndex = vi.fn(() => ({
    getAll: vi.fn().mockResolvedValue([]),
  }));

  const mockStore = {
    index: mockIndex,
  };

  const mockTransaction = vi.fn(() => ({
    store: mockStore,
    done: Promise.resolve(undefined),
  }));

  const mockDbInstance = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    clear: vi.fn().mockResolvedValue(undefined),
    transaction: mockTransaction,
  };

  const mockGetDB = vi.fn().mockResolvedValue(mockDbInstance);

  return { mockGetDB, mockDb: mockDbInstance };
});

vi.mock('../../../src/core/storage/IndexedDBManager', () => ({
  getDB: mockGetDB,
}));

import { chatHistoryDB } from '../../../src/core/storage/stores/ChatHistoryDB';
import { notesDB } from '../../../src/core/storage/stores/NotesDB';
import { memoryDB } from '../../../src/core/storage/stores/MemoryDB';
import { errorStore } from '../../../src/core/storage/stores/ErrorStore';
import { aiTransactionLogDB } from '../../../src/core/storage/stores/AITransactionLogDB';
import { TraceVerbosity } from '../../../src/core/telemetry/types';
import type { AITransaction } from '../../../src/core/telemetry/types';

describe('Domain Stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ChatHistoryDB.createSession calls db.put with correct store', async () => {
    const mockSession = {
      id: 'session-1',
      title: 'Test Session',
      created: 1000,
      updated: 1000,
      starred: false,
      preview: 'Hello',
    };

    await chatHistoryDB.createSession(mockSession);

    expect(mockDb.put).toHaveBeenCalledWith('chat_history_sessions', mockSession);
  });

  it('NotesDB.createNote calls db.put with correct store', async () => {
    const mockNote = {
      id: 'note-1',
      title: 'Test Note',
      content: 'Note content',
      created: 1000,
      updated: 1000,
      tags: ['test'],
    };

    await notesDB.createNote(mockNote);

    expect(mockDb.put).toHaveBeenCalledWith('notes_notes', mockNote);
  });

  it('MemoryDB.putUserFact calls db.put with correct store', async () => {
    const mockFact = {
      id: 'fact-1',
      fact: 'User likes TypeScript',
      category: 'preference',
      confidence: 0.9,
      created: 1000,
      updated: 1000,
      source: 'chat',
    };

    await memoryDB.putUserFact(mockFact);

    expect(mockDb.put).toHaveBeenCalledWith('memory_userFacts', mockFact);
  });

  it('ErrorStore.logError calls db.put and enforces FIFO', async () => {
    const mockError = {
      id: 'error-new',
      timestamp: 2000,
      level: 'error',
      message: 'New error',
    };

    // Mock count to exceed MAX_ERRORS (100)
    mockDb.count.mockResolvedValue(101);

    // Mock getAll to return 101 existing errors sorted by timestamp
    const existingErrors = Array.from({ length: 101 }, (_, i) => ({
      id: `error-${i}`,
      timestamp: 1000 + i,
      level: 'error',
      message: `Error ${i}`,
    }));
    mockDb.getAll.mockResolvedValue(existingErrors);

    await errorStore.logError(mockError);

    // put was called with the new error
    expect(mockDb.put).toHaveBeenCalledWith('errors', mockError);

    // getAll was called to find oldest entries for eviction
    expect(mockDb.getAll).toHaveBeenCalledWith('errors');

    // The oldest entry (error-0 with lowest timestamp) should be deleted
    expect(mockDb.delete).toHaveBeenCalledWith('errors', 'error-0');
  });

  it('AITransactionLogDB.logTransaction calls db.put with correct store', async () => {
    const mockTx: AITransaction = {
      id: 'tx-1',
      sessionId: 'session-1',
      conversationId: 'conv-1',
      workspaceId: 'ws-1',
      activeSurface: 'sidepanel',
      userTurnId: 'turn-1',
      type: 'chat',
      status: 'completed',
      providerId: 'openai',
      model: 'gpt-4',
      startedAt: 1000,
      verbosity: TraceVerbosity.NORMAL,
      privacyMode: false,
    };

    await aiTransactionLogDB.logTransaction(mockTx);

    expect(mockDb.put).toHaveBeenCalledWith('transaction_log_transactions', mockTx);
  });
});
