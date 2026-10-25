import type { GameEvent } from '../domain/schema';
import type { GameStore, SyncStatus } from './store';

// Remote side of sync. The Supabase adapter implements it; tests use an in-memory fake.
export interface RemoteEvents {
  push(events: readonly GameEvent[]): Promise<void>;
  pullAll(): Promise<GameEvent[]>;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: string;
  error?: string;
}

// Push local events not yet acknowledged, then pull everything and merge by id.
// Event ids make both steps idempotent, so a failed or repeated sync is always safe.
export class SyncEngine {
  private state: SyncState;
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private store: GameStore,
    private remote: RemoteEvents | null,
    private isOnline: () => boolean = () => true,
  ) {
    this.state = { status: remote ? 'pending' : 'local-only' };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  setRemote(remote: RemoteEvents | null, signedOutStatus: SyncStatus = 'signed-out') {
    this.remote = remote;
    this.set(remote ? { status: 'pending' } : { status: signedOutStatus });
  }

  async syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run().finally(() => {
      this.running = null;
    });
    await this.running;
    if (this.again) {
      this.again = false;
      await this.syncNow();
    }
  }

  private async run() {
    const remote = this.remote;
    if (!remote) return;
    if (!this.isOnline()) {
      this.set({ ...this.state, status: 'offline' });
      return;
    }
    this.set({ ...this.state, status: 'syncing', error: undefined });
    try {
      const pending = this.store.pendingEvents();
      if (pending.length) await remote.push(pending);
      const all = await remote.pullAll();
      this.store.markSynced(
        pending.map((e) => e.id),
        all,
      );
      const left = this.store.pendingEvents().length;
      this.set({ status: left ? 'pending' : 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (err) {
      this.set({ ...this.state, status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }

  private set(next: SyncState) {
    this.state = next;
    for (const fn of this.listeners) fn();
  }
}
