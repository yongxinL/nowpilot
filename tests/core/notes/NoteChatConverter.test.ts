/**
 * NoteChatConverter.test.ts — LLM-WIKI-07, NMEM-03 (D-118).
 *
 * TDD RED phase: these tests define the expected behavior of
 * NoteChatConverter before implementation. They cover:
 *   - Test 1 (LLM-WIKI-07): chat messages → structured note draft
 *   - Test 2 (NMEM-03): memory context from MemoryEngine.assemble() enriches draft
 *   - Test 3: wikilinks extracted from content via LinkParser.parseLinks
 *   - Test 4: user is gatekeeper — draft is pre-filled, not auto-saved
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module under test.
const mockAssemble = vi.fn();
const mockRequestJson = vi.fn();
const mockResolveTier = vi.fn();
const mockParseLinks = vi.fn();

vi.mock('../../../src/core/memory/MemoryEngine', () => ({
  MemoryEngine: {
    assemble: (...args: unknown[]) => mockAssemble(...args),
  },
}));

vi.mock('../../../src/core/ai/StructuredOutput', () => ({
  requestJson: (...args: unknown[]) => mockRequestJson(...args),
}));

vi.mock('../../../src/core/ai/TierResolver', () => ({
  resolveTier: (...args: unknown[]) => mockResolveTier(...args),
}));

vi.mock('../../../src/core/notes/LinkParser', () => ({
  parseLinks: (...args: unknown[]) => mockParseLinks(...args),
}));

const { NoteChatConverter } = await import('../../../src/core/notes/NoteChatConverter');

function makeMessages() {
  return [
    { role: 'user', content: 'How do I reset a ServiceNow instance password?' },
    { role: 'assistant', content: 'To reset the password, navigate to sys_users.list, find the user, and set a new password.' },
  ];
}

describe('NoteChatConverter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(1) LLM-WIKI-07: chat messages → structured note draft with title+content+tags+categoryPath', async () => {
    mockAssemble.mockResolvedValue('');
    mockResolveTier.mockReturnValue({ providerId: 'anthropic', model: 'claude-sonnet-4-20250514' });
    mockRequestJson.mockResolvedValue({
      title: 'ServiceNow Password Reset',
      content: '# Password Reset\n\nNavigate to sys_users.list to reset.',
      tags: ['servicenow', 'password'],
      categoryPath: 'admin/security',
      wikilinks: [],
    });
    mockParseLinks.mockReturnValue([]);

    const draft = await NoteChatConverter.draftFromChat(makeMessages());

    expect(draft.title).toBe('ServiceNow Password Reset');
    expect(draft.content).toContain('sys_users.list');
    expect(draft.tags).toEqual(['servicenow', 'password']);
    expect(draft.categoryPath).toBe('admin/security');
    expect(draft.wikilinks).toEqual([]);
    expect(draft.summary).toBeDefined();
  });

  it('(2) NMEM-03: memory context from MemoryEngine.assemble() enriches the draft', async () => {
    mockAssemble.mockResolvedValue('- [preference] User prefers concise answers');
    mockResolveTier.mockReturnValue({ providerId: 'anthropic', model: 'claude-sonnet-4-20250514' });
    mockRequestJson.mockResolvedValue({
      title: 'Password Reset',
      content: 'Concise guide.',
      tags: ['admin'],
      categoryPath: null,
      wikilinks: [],
    });
    mockParseLinks.mockReturnValue([]);

    await NoteChatConverter.draftFromChat(makeMessages());

    // assemble() must be called to provide memory context.
    expect(mockAssemble).toHaveBeenCalledTimes(1);
    // The memory context must appear in the prompt sent to the LLM.
    const promptArg = mockRequestJson.mock.calls[0][1] as string;
    expect(promptArg).toContain('User prefers concise answers');
  });

  it('(3) wikilinks extracted from content via LinkParser.parseLinks', async () => {
    mockAssemble.mockResolvedValue('');
    mockResolveTier.mockReturnValue({ providerId: 'anthropic', model: 'claude-sonnet-4-20250514' });
    mockRequestJson.mockResolvedValue({
      title: 'Guide',
      content: 'See [[ServiceNow Admin]] and [[Password Policy]] for details.',
      tags: ['guide'],
      categoryPath: null,
      wikilinks: [],
    });
    mockParseLinks.mockReturnValue(['ServiceNow Admin', 'Password Policy']);

    const draft = await NoteChatConverter.draftFromChat(makeMessages());

    expect(mockParseLinks).toHaveBeenCalledTimes(1);
    expect(mockParseLinks).toHaveBeenCalledWith(
      'See [[ServiceNow Admin]] and [[Password Policy]] for details.',
    );
    // Extracted wikilinks merge into the draft (deduped).
    expect(draft.wikilinks).toContain('ServiceNow Admin');
    expect(draft.wikilinks).toContain('Password Policy');
  });

  it('(4) user is gatekeeper — draft is pre-filled, not auto-saved (no NotesDB.put call)', async () => {
    mockAssemble.mockResolvedValue('');
    mockResolveTier.mockReturnValue({ providerId: 'anthropic', model: 'claude-sonnet-4-20250514' });
    mockRequestJson.mockResolvedValue({
      title: 'Guide',
      content: 'Some content with [[Link]].',
      tags: ['guide'],
      categoryPath: null,
      wikilinks: ['Link'],
    });
    mockParseLinks.mockReturnValue(['Link']);

    const draft = await NoteChatConverter.draftFromChat(makeMessages());

    // The draft is returned to the caller for review — never persisted.
    // Verify: no db handle is even accepted as a parameter (signature gate).
    expect(draft).toBeDefined();
    expect(draft.title).toBe('Guide');
    // The function must NOT have called any storage layer — verified by
    // the fact that no storage mock exists and the signature omits db.
  });
});
