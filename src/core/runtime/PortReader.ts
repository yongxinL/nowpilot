export class PortReader {
  private port: chrome.runtime.Port | null = null;
  private listeners: Array<(message: unknown) => void> = [];
  private disconnectListeners: Array<() => void> = [];

  connect(name: string): void {
    this.port = chrome.runtime.connect({ name });
    this.port.onMessage.addListener((message) => {
      this.listeners.forEach((fn) => {
        try {
          fn(message);
        } catch {
          // swallow
        }
      });
    });
    this.port.onDisconnect.addListener(() => {
      this.disconnectListeners.forEach((fn) => {
        try {
          fn();
        } catch {
          // swallow
        }
      });
      this.port = null;
    });
  }

  onMessage(fn: (message: unknown) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  onDisconnect(fn: () => void): () => void {
    this.disconnectListeners.push(fn);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((l) => l !== fn);
    };
  }

  postMessage(message: unknown): void {
    if (this.port) {
      this.port.postMessage(message);
    }
  }

  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }

  get isConnected(): boolean {
    return this.port !== null;
  }
}
