/**
 * Canonical prompt constants — Appendix A, verbatim (PRODUCT_SPEC_v0_1.md
 * 4092-4153).
 *
 * These strings are byte-stable and persona-free: the persona block
 * (RICH-R-02) is prepended by PersonaInjector at request time via the
 * PromptCacheManager choke-point (D-59, plan 03-04) — never hard-coded here.
 * Stage strings must not interpolate volatile values or caching breaks (§1.3).
 */
export const PROMPTS = {
  planner: {
    system: 'Select exactly one action: answer, run_tool, or ask_clarification. Return JSON only. Do not explain.',
    cacheable: true,
    tier: 'fast',
  },
  renderer: {
    system: 'Answer using only the provided context and tool result. Be concise. If data is missing, say what is missing. Do not invent facts.',
    cacheable: true,
    // IN-02: 'fast' — D-55 maps the renderer stage to the fast tier
    // (AgentOrchestrator hardcodes the renderer to 'fast').
    tier: 'fast',
  },
  memoryExtractor: {
    system: 'Extract durable user memory. Store only stable facts, preferences, or repeated patterns. Do not store secrets or raw customer data. Return JSON only.',
    cacheable: true,
    tier: 'fast',
  },
  conversationSummarizer: {
    system: 'Summarise prior conversation into compact durable context. Preserve decisions, preferences, open tasks, and unresolved questions. Return plain text summary only.',
    cacheable: true,
    tier: 'fast',
  },
  repairJson: {
    system: 'Repair the previous output into valid JSON matching the provided schema. Return JSON only.',
    cacheable: true,
    tier: 'fast',
  },
  titleGen: {
    system: 'Summarize this message as a 3-6 word title. Reply with the title only, no quotes.',
    cacheable: false,
    tier: 'fast',
  },
  // --- LLM-Wiki (§27) ---
  noteTagger: {
    system: 'Analyze the note title and content. Return JSON only: {tags:[{value:string,confidence:number}], categoryPath:string|null, summary:string, memoryFacts:[{content:string,confidence:number}]}. Each confidence is your own 0..1 estimate; the client discards items below its display threshold (LLM-WIKI-11). categoryPath uses "/" separators and should reuse an existing path when suitable. Do not invent facts. Do not include secrets.',
    cacheable: true,
    tier: 'fast',
  },
  noteQA: {
    system: 'Answer the question using ONLY the provided note snippets and user memory facts. Cite each statement with its source note title. If the notes do not contain the answer, say so. Return concise markdown with inline citations.',
    cacheable: true,
    tier: 'balanced',
  },
  noteChatConvert: {
    system: 'Convert the conversation excerpt into a structured knowledge note. Return JSON only: {title:string, content:string(markdown), tags:string[<=5], categoryPath:string|null, wikilinks:string[]}. Extract durable knowledge; omit chit-chat. Do not include secrets.',
    cacheable: true,
    tier: 'fast',
  },
  // --- RICH (§17.7) ---
  clarify: {
    system: 'The user request is ambiguous. Ask ONE focused clarifying question, then list 2-4 concrete options. Return JSON only: {question:string, options:string[]}. Do not answer the request yet.',
    cacheable: true,
    tier: 'fast',
  },
  followUpSuggest: {
    system: 'Given the assistant answer, propose 1-3 short next-step suggestions the user might tap. Return JSON only: {suggestions:string[]}. Each <= 6 words. If none are useful, return {suggestions:[]}.',
    cacheable: true,
    tier: 'fast',
  },
} as const;