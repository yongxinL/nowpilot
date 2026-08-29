// Minimal ambient declaration for turndown (7.x) — the published package ships
// no type definitions. Declares only the API surface DefuddleStrategy uses:
// the constructor options (headingStyle atx is the extraction convention) and
// turndown(html) → markdown. If a fuller surface is ever needed, adopt
// @types/turndown instead of widening this file.
declare module 'turndown' {
  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: string;
    codeBlockStyle?: 'indented' | 'fenced';
    fence?: string;
    emDelimiter?: string;
    strongDelimiter?: string;
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
    preformattedCode?: boolean;
  }

  class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(input: string | Node): string;
    use(plugin: unknown): this;
    addRule(key: string, rule: unknown): this;
    keep(filter: unknown): this;
    remove(filter: unknown): this;
  }

  export = TurndownService;
}