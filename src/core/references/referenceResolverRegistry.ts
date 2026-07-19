import type { ReferenceToken } from './ReferenceToken';
import type { AutocompleteResult, ReferenceResolver } from './ReferenceResolver';

export class ReferenceResolverRegistry {
  #resolvers = new Map<string, ReferenceResolver>();

  register(type: string, resolver: ReferenceResolver): void {
    if (this.#resolvers.has(type)) {
      throw new Error(`ReferenceResolver for type "${type}" already registered`);
    }
    this.#resolvers.set(type, resolver);
  }

  unregister(type: string): boolean {
    return this.#resolvers.delete(type);
  }

  async search(query: string): Promise<AutocompleteResult[]> {
    const results: AutocompleteResult[] = [];
    for (const resolver of this.#resolvers.values()) {
      try {
        const r = await resolver.search(query);
        results.push(...r);
      } catch {
        // Silently skip resolver errors
      }
    }
    return results;
  }

  async validate(token: ReferenceToken): Promise<{ valid: boolean; reason?: string }> {
    const resolver = this.#resolvers.get(token.type);
    if (!resolver) return { valid: false, reason: `Unknown reference type: ${token.type}` };
    try {
      return await resolver.validate(token);
    } catch {
      return { valid: false, reason: 'Validation error' };
    }
  }

  async resolve(token: ReferenceToken): Promise<{ title: string; content: string; metadata?: Record<string, unknown> } | null> {
    const resolver = this.#resolvers.get(token.type);
    if (!resolver) return null;
    try {
      return await resolver.resolve(token);
    } catch {
      return null;
    }
  }

  getTypes(): string[] {
    return Array.from(this.#resolvers.keys());
  }

  getResolverType(type: string): ReferenceResolver | undefined {
    return this.#resolvers.get(type);
  }
}

export const referenceResolver = new ReferenceResolverRegistry();
