export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderCircuit {
  state: CircuitState;
  failures: number[]; // timestamps
  openedAt: number | null;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  failureWindowMs: number;
  cooldownMs: number;
}

export class CircuitBreaker {
  private circuits = new Map<string, ProviderCircuit>();
  private readonly failureThreshold: number;
  private readonly failureWindowMs: number;
  private readonly cooldownMs: number;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.failureThreshold = config?.failureThreshold ?? 3;
    this.failureWindowMs = config?.failureWindowMs ?? 60_000;
    this.cooldownMs = config?.cooldownMs ?? 5 * 60_000;
  }

  isOpen(providerId: string): boolean {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return false;

    if (circuit.state === 'OPEN') {
      // Check if cooldown has elapsed → transition to HALF_OPEN
      if (circuit.openedAt && Date.now() - circuit.openedAt >= this.cooldownMs) {
        circuit.state = 'HALF_OPEN';
        return false; // Allow probe
      }
      return true; // Still blocking
    }

    return false;
  }

  recordFailure(providerId: string): void {
    const circuit = this.getOrCreate(providerId);
    const now = Date.now();

    if (circuit.state === 'HALF_OPEN') {
      // Probe failed → back to OPEN
      circuit.state = 'OPEN';
      circuit.openedAt = now;
      return;
    }

    // CLOSED: add failure timestamp, prune old ones
    circuit.failures.push(now);
    circuit.failures = circuit.failures.filter(t => now - t < this.failureWindowMs);

    if (circuit.failures.length >= this.failureThreshold) {
      circuit.state = 'OPEN';
      circuit.openedAt = now;
    }
  }

  recordSuccess(providerId: string): void {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return;

    if (circuit.state === 'HALF_OPEN') {
      // Probe succeeded → close circuit
      circuit.state = 'CLOSED';
      circuit.failures = [];
      return;
    }

    // CLOSED: reset failure window on success
    if (circuit.state === 'CLOSED') {
      circuit.failures = [];
    }
  }

  getState(providerId: string): CircuitState {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return 'CLOSED';
    return circuit.state;
  }

  reset(providerId: string): void {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return;
    circuit.state = 'CLOSED';
    circuit.failures = [];
    circuit.openedAt = null;
  }

  private getOrCreate(providerId: string): ProviderCircuit {
    if (!this.circuits.has(providerId)) {
      this.circuits.set(providerId, { state: 'CLOSED', failures: [], openedAt: null });
    }
    return this.circuits.get(providerId)!;
  }
}
