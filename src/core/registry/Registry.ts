export class Registry<T> {
  private items = new Map<string, T>();

  register(id: string, item: T): void {
    if (this.items.has(id)) {
      throw new Error(`Registry item already registered: ${id}`);
    }
    this.items.set(id, item);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return [...this.items.values()];
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  unregister(id: string): void {
    this.items.delete(id);
  }

  list(): string[] {
    return [...this.items.keys()];
  }

  clear(): void {
    this.items.clear();
  }
}
