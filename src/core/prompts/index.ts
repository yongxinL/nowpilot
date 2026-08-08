// src/core/prompts/index.ts — Source: Appendix A (verbatim, lines 4063-4121)
// Do NOT hard-code persona text into these constants — the persona block is
// prepended by PersonaInjector.inject() at request time in Phase 3; keep these
// byte-stable for prompt caching (§1.3, Appendix A note).
export const PROMPTS = {
  planner: {
    system:
      'Select exactly one action: answer, run_tool, or ask_clarification. Return JSON only. Do not explain.',
    cacheable: true,
    tier: 'haiku',
  },
  renderer: {
    system:
      'Answer using only the provided context and tool result. Be concise. If data is missing, say what is missing. Do not invent facts.',
    cacheable: true,
    tier: 'flash',
  },
  memoryExtractor: {
    system:
      'Extract durable user memory. Store only stable facts, preferences, or repeated patterns. Do not store secrets or raw customer data. Return JSON only.',
    cacheable: true,
    tier: 'haiku',
  },
  conversationSummarizer: {
    system:
      'Summarise prior conversation into compact durable context. Preserve decisions, preferences, open tasks, and unresolved questions. Return plain text summary only.',
    cacheable: true,
    tier: 'haiku',
  },
  repairJson: {
    system:
      'Repair the previous output into valid JSON matching the provided schema. Return JSON only.',
    cacheable: true,
    tier: 'haiku',
  },
  titleGen: {
    system: 'Summarize this message as a 3-6 word title. Reply with the title only, no quotes.',
    cacheable: false,
    tier: 'haiku',
  },
  // --- LLM-Wiki (§27) ---
  noteTagger: {
    system:
      'Analyze the note title and content. Return JSON only: {tags:[{value:string,confidence:number}], categoryPath:string|null, summary:string, memoryFacts:[{content:string,confidence:number}]}. Each confidence is your own 0..1 estimate; the client discards items below its display threshold (LLM-WIKI-11). categoryPath uses "/" separators and should reuse an existing path when suitable. Do not invent facts. Do not include secrets.',
    cacheable: true,
    tier: 'haiku',
  },
  noteQA: {
    system:
      'Answer the question using ONLY the provided note snippets and user memory facts. Cite each statement with its source note title. If the notes do not contain the answer, say so. Return concise markdown with inline citations.',
    cacheable: true,
    tier: 'flash',
  },
  noteChatConvert: {
    system:
      'Convert the conversation excerpt into a structured knowledge note. Return JSON only: {title:string, content:string(markdown), tags:string[<=5], categoryPath:string|null, wikilinks:string[]}. Extract durable knowledge; omit chit-chat. Do not include secrets.',
    cacheable: true,
    tier: 'haiku',
  },
  // --- RICH (§17.7) ---
  clarify: {
    system:
      'The user request is ambiguous. Ask ONE focused clarifying question, then list 2-4 concrete options. Return JSON only: {question:string, options:string[]}. Do not answer the request yet.',
    cacheable: true,
    tier: 'haiku',
  },
  followUpSuggest: {
    system:
      'Given the assistant answer, propose 1-3 short next-step suggestions the user might tap. Return JSON only: {suggestions:string[]}. Each <= 6 words. If none are useful, return {suggestions:[]}.',
    cacheable: true,
    tier: 'haiku',
  },
} as const;
