import type { ReferenceToken } from './ReferenceToken';

export interface AutocompleteResult {
  token: ReferenceToken;
  icon: string;
  color: string;
  subtitle?: string;
}

export interface ReferenceResolver {
  search(query: string): Promise<AutocompleteResult[]>;
  validate(token: ReferenceToken): Promise<{ valid: boolean; reason?: string }>;
  resolve(token: ReferenceToken): Promise<{ title: string; content: string; metadata?: Record<string, unknown> } | null>;
  getType(): string;
}
