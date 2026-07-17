import { generateText } from 'ai';
import { debugLog } from '../utils/debugLog';
import { providerRegistry } from '../ai/providers/ProviderRegistry';
import { memoryEngine } from '../memory/MemoryEngine';
import type { Note } from './LinkParser';
import type { LinkParser } from './LinkParser';
import type { QAResult } from './noteTypes';

export const QA_PROMPT = `You are a note-based Q&A system. Answer the user's question based ONLY on the provided note snippets and user context.

Rules:
- Answer based ONLY on the provided notes and user context
- Cite sources inline using [Source: Note Title] after each claim
- Say "I don't have enough information" if notes are insufficient
- Output answer as plain markdown — no JSON wrapper`;

export class NoteQA {
  async ask(
    query: string,
    allNotes: Note[],
    linkParser: LinkParser,
  ): Promise<QAResult> {
    await providerRegistry.initialize();

    const models = providerRegistry.getModelsForTier('flash');
    if (models.length === 0) {
      debugLog('warn', '[NoteQA] no Flash-tier models available');
      return { answer: 'Unable to answer.', citations: [] };
    }

    const modelEntry = models[0];
    const provider = providerRegistry.getProvider(modelEntry.providerId);
    if (!provider) {
      debugLog('warn', '[NoteQA] provider unavailable for Flash-tier model');
      return { answer: 'Unable to answer.', citations: [] };
    }

    const model = (provider.instance as any)(modelEntry.modelId);

    const searchResults = linkParser.search(query);
    const top5 = allNotes
      .filter((n) => searchResults.some((r) => r.id === n.id))
      .slice(0, 5);

    const snippets = top5
      .map((n) => `[Source: ${n.title}]\n${(n.content || '').slice(0, 500)}`)
      .join('\n\n');

    let memoryContext = '';
    try {
      const memResult = await memoryEngine.assemble(
        `notes-rag-${Date.now()}`,
        query,
        'small',
      );
      const highScoreFacts = memResult.memory
        .filter((m) => m.score > 0.6)
        .map((m) => `- ${m.content}`);
      if (highScoreFacts.length > 0) {
        memoryContext = `User context:\n${highScoreFacts.join('\n')}`;
      }
    } catch (err) {
      debugLog('warn', '[NoteQA] MemoryEngine unavailable, continuing with notes only', {
        error: err,
      });
    }

    const prompt = `Question: ${query}\n\nNote snippets:\n${snippets}\n\n${memoryContext ? `${memoryContext}\n\n` : ''}Answer the question based on the provided information.`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { text } = await generateText({
          model: model as Parameters<typeof generateText>[0]['model'],
          system: QA_PROMPT,
          prompt,
        });

        const citationRegex = /\[Source:\s*([^\]]+)\]/g;
        const citations = [];
        let citeMatch;
        const seenTitles = new Set<string>();

        while ((citeMatch = citationRegex.exec(text)) !== null) {
          const title = citeMatch[1].trim();
          if (!seenTitles.has(title)) {
            seenTitles.add(title);
            const matchedNote = top5.find(
              (n) => n.title.toLowerCase() === title.toLowerCase(),
            );
            if (matchedNote) {
              citations.push({
                noteId: matchedNote.id,
                title: matchedNote.title,
                snippet: (matchedNote.content || '').slice(0, 100),
              });
            }
          }
        }

        return { answer: text, citations };
      } catch (err) {
        if (attempt === 1) {
          debugLog('warn', '[NoteQA] retrying after failure', { error: err });
        } else {
          debugLog('error', '[NoteQA] Q&A failed after retry', { error: err });
          return { answer: 'Unable to answer.', citations: [] };
        }
      }
    }

    return { answer: 'Unable to answer.', citations: [] };
  }
}

export const noteQA = new NoteQA();
