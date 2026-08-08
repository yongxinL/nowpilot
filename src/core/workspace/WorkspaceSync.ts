// src/core/workspace/WorkspaceSync.ts — Source: Appendix M.3 (lines 5961-5996) +
// D-17 + Flow 11 (line ~1710). Cross-surface workspace synchronization: live state
// (WORKSPACE_UPDATED with version-LWW adoption), heartbeats (WORKSPACE_HEARTBEAT
// via the bus — the only repeating timer, M.3; PING/PONG keepalives via the
// whitelisted bridge), the WORKSPACE_HANDOFF state machine (pending → complete on
// PONG from the target / electionFailed on timeout), and the WORKSPACE_MIRROR flow
// (snapshots published on store updates while a handoff is pending; mirror
// snapshots ride WORKSPACE_UPDATED with a mirror marker — WORKSPACE_MIRROR is NOT
// a message type in the canonical registry, so no new contract is invented,
// Pitfall 5). Every inbound message passes the MessageTypeValues whitelist before
// dispatch (Pitfall 5 / T-1-12); every catch calls debugLog with a canonical
// WORKSPACE_* code and never throws (Golden Rule 9). The handoff PONG wait is a
// single bounded setTimeout that is always cleared (T-1-14 — a missing PONG only
// transitions handoff state, no crash path).
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { broadcastBus } from '@/core/runtime/BroadcastBus';
import { MessageType, MessageTypeValues } from '@/core/runtime/MessageType';
import { MessageBusBridge } from '@/core/messaging/MessageBusBridge';
import { getEventBus } from '@/core/events/EventBusManager';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { ActiveSurface, WorkspaceState } from '@/types/workspace';

export type HandoffState = 'idle' | 'pending' | 'complete' | 'electionFailed';

/** PONG wait window for a requested handoff (T-1-14: bounded, always cleared). */
export const HANDOFF_TIMEOUT_MS = 5000;

interface InboundPayload {
  state?: WorkspaceState;
  target?: string;
  source?: string;
  workspaceId?: string;
  version?: number;
}

export class WorkspaceSync {
  private readonly surface: ActiveSurface;
  private readonly bridge: MessageBusBridge;
  private handoffState: HandoffState = 'idle';
  private pendingTarget: ActiveSurface | null = null;
  private mirroring = false;
  private stopped = true;
  private handoffTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private unsubscribeBus: (() => void) | null = null;
  private unsubscribeBridge: (() => void) | null = null;

  constructor(surface: ActiveSurface, bridge?: MessageBusBridge) {
    this.surface = surface;
    this.bridge = bridge ?? new MessageBusBridge();
  }

  /** Current handoff state machine position. */
  getHandoffState(): HandoffState {
    return this.handoffState;
  }

  /**
   * Start live sync: bus heartbeat, WORKSPACE_UPDATED LWW subscribe, bridge
   * inbound dispatch (whitelist-checked), and store-change snapshot publishing.
   */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;

    broadcastBus.startHeartbeat(() => {
      const ws = useWorkspaceStore.getState().workspace;
      return { workspaceId: ws.workspaceId, version: ws.version };
    });

    this.unsubscribeBus = broadcastBus.on(MessageType.WORKSPACE_UPDATED, (payload) => {
      this.handleRemoteUpdate(payload);
    });

    this.unsubscribeBridge = this.bridge.subscribe((message) => {
      this.handleInbound(message);
    });

    this.unsubscribeStore = useWorkspaceStore.subscribe((state, prevState) => {
      if (state.workspace !== prevState.workspace) this.publishSnapshot();
    });
  }

  /** Stop live sync: stop the heartbeat and clear every subscription/timer. */
  stop(): void {
    broadcastBus.stopHeartbeat();
    if (this.unsubscribeBus !== null) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
    if (this.unsubscribeBridge !== null) {
      this.unsubscribeBridge();
      this.unsubscribeBridge = null;
    }
    if (this.unsubscribeStore !== null) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    if (this.handoffTimer !== null) {
      clearTimeout(this.handoffTimer);
      this.handoffTimer = null;
    }
    this.handoffState = 'idle';
    this.pendingTarget = null;
    this.mirroring = false;
    this.stopped = true;
  }

  /**
   * Request a workspace handoff to the other surface (Flow 11): publish
   * WORKSPACE_HANDOFF via the whitelisted bridge, then wait for the target's PONG.
   * On PONG → complete; on timeout → electionFailed (T-1-14).
   */
  async requestHandoff(target: ActiveSurface): Promise<void> {
    if (this.handoffState === 'pending') return;
    this.handoffState = 'pending';
    this.pendingTarget = target;

    getEventBus().emit('SHOW_HANDOFF_PENDING', { target, source: this.surface });
    this.bridge.publish(
      this.envelope(MessageType.WORKSPACE_HANDOFF, {
        state: useWorkspaceStore.getState().workspace,
        target,
        source: this.surface,
      }),
    );
    debugLog(ERROR_CODES.WORKSPACE_HANDOFF, `handoff requested to ${target}`, {
      silent: true,
      module: 'WorkspaceSync',
    });

    this.handoffTimer = setTimeout(() => {
      if (this.handoffState !== 'pending') return;
      this.handoffState = 'electionFailed';
      this.pendingTarget = null;
      getEventBus().emit('WORKSPACE_ELECTION_FAILED', { target, source: this.surface });
      debugLog(ERROR_CODES.WORKSPACE_HANDOFF, 'handoff election failed (PONG timeout)', {
        silent: true,
        module: 'WorkspaceSync',
      });
    }, HANDOFF_TIMEOUT_MS);
  }

  /**
   * Begin mirroring: snapshots are published on store updates while a handoff is
   * pending (WORKSPACE_MIRROR flow — Flow 11 "side panel demotes to read-only
   * mirror until refocused").
   */
  startMirroring(): void {
    this.mirroring = true;
    getEventBus().emit('WORKSPACE_MIRRORING_START', { source: this.surface });
    debugLog(ERROR_CODES.WORKSPACE_MIRROR, 'mirroring started', {
      silent: true,
      module: 'WorkspaceSync',
    });
  }

  /** Stop mirroring and emit WORKSPACE_MIRRORING_STOP. */
  stopMirroring(): void {
    if (!this.mirroring) return;
    this.mirroring = false;
    getEventBus().emit('WORKSPACE_MIRRORING_STOP', { source: this.surface });
    debugLog(ERROR_CODES.WORKSPACE_MIRROR, 'mirroring stopped', {
      silent: true,
      module: 'WorkspaceSync',
    });
  }

  // --- internals ---

  private envelope(type: RuntimeEnvelope['type'], payload: unknown): RuntimeEnvelope {
    return {
      id: crypto.randomUUID(),
      type,
      createdAt: Date.now(),
      source: this.surface,
      payload,
    };
  }

  /** Publish the current workspace snapshot (WORKSPACE_UPDATED, version-LWW). */
  private publishSnapshot(): void {
    const state = useWorkspaceStore.getState().workspace;
    broadcastBus.emit(MessageType.WORKSPACE_UPDATED, {
      state,
      from: this.surface,
      mirror: this.mirroring && this.handoffState === 'pending',
    });
    debugLog(ERROR_CODES.WORKSPACE_SNAPSHOT, 'workspace snapshot published', {
      silent: true,
      module: 'WorkspaceSync',
    });
  }

  /** LWW adoption (M.3): adopt only when remote.version > local.version. */
  private handleRemoteUpdate(payload: unknown): void {
    const incoming = payload as InboundPayload;
    if (typeof incoming?.state !== 'object' || incoming.state === null) return;
    const remoteVersion = incoming.state.version;
    const local = useWorkspaceStore.getState().workspace;
    if (typeof remoteVersion !== 'number' || remoteVersion <= local.version) {
      debugLog(ERROR_CODES.WORKSPACE_SYNC, 'remote update ignored (LWW)', {
        silent: true,
        module: 'WorkspaceSync',
      });
      return;
    }
    // Adopt the remote snapshot verbatim (M.3 setState pattern — version is kept
    // as the remote's so the echo is ignored by both sides).
    useWorkspaceStore.setState({ workspace: incoming.state });
    debugLog(ERROR_CODES.WORKSPACE_SYNC, 'remote update adopted (LWW)', {
      silent: true,
      module: 'WorkspaceSync',
    });
  }

  /** Whitelist-checked inbound dispatch (Pitfall 5 / T-1-12). */
  private handleInbound(message: RuntimeEnvelope<unknown>): void {
    if (!MessageTypeValues.includes(message.type)) return;
    if (message.type === MessageType.PONG) {
      this.handlePong(message);
      return;
    }
    if (message.type === MessageType.WORKSPACE_HANDOFF) {
      this.handleInboundHandoff(message);
      return;
    }
    if (message.type === MessageType.PING) {
      // Keepalive echo — respond so the probing surface knows we are alive.
      this.bridge.publish(
        this.envelope(MessageType.PONG, { source: this.surface, target: message.source }),
      );
    }
  }

  /** PONG from the target completes a pending handoff. */
  private handlePong(message: RuntimeEnvelope<unknown>): void {
    if (this.handoffState !== 'pending') return;
    const payload = message.payload as InboundPayload;
    if (this.pendingTarget !== null && payload.source !== this.pendingTarget) return;
    if (this.handoffTimer !== null) {
      clearTimeout(this.handoffTimer);
      this.handoffTimer = null;
    }
    this.handoffState = 'complete';
    this.pendingTarget = null;
    getEventBus().emit('SHOW_HANDOFF_COMPLETE', { source: message.source });
    debugLog(ERROR_CODES.WORKSPACE_HANDOFF, 'handoff completed (PONG received)', {
      silent: true,
      module: 'WorkspaceSync',
    });
  }

  /** A handoff request addressed to us is acknowledged with PONG. */
  private handleInboundHandoff(message: RuntimeEnvelope<unknown>): void {
    const payload = message.payload as InboundPayload;
    if (payload.target !== this.surface) return;
    this.bridge.publish(
      this.envelope(MessageType.PONG, { source: this.surface, target: payload.source }),
    );
    debugLog(ERROR_CODES.WORKSPACE_HANDOFF, 'handoff acknowledged (PONG sent)', {
      silent: true,
      module: 'WorkspaceSync',
    });
  }
}
