import { deriveGame, type GameState } from '../domain/derive';
import { mergeEvents } from '../domain/events';
import type { ClassDef, GameEvent, SkillCatalog } from '../domain/schema';
import { emptyCatalog } from '../domain/skills';
import { loadSave, writeSave, type KeyValueStorage } from '../infra/local-save';

export type SyncStatus = 'local-only' | 'signed-out' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

export interface Snapshot {
  game: GameState;
  events: GameEvent[];
  pendingCount: number;
}

// Holds the event log, persists every change immediately and exposes derived state to React.
export class GameStore {
  private events: GameEvent[];
  private syncedIds: Set<string>;
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  readonly loadWarning?: string;

  constructor(
    readonly classes: readonly ClassDef[],
    private storage: KeyValueStorage,
    private catalog: SkillCatalog = emptyCatalog,
  ) {
    const { data, warning } = loadSave(storage);
    this.events = data.events;
    this.syncedIds = new Set(data.syncedIds);
    this.loadWarning = warning;
    this.snapshot = this.build();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  classDef(classId: string): ClassDef | undefined {
    return this.classes.find((c) => c.id === classId);
  }

  append(event: GameEvent) {
    this.replaceEvents(mergeEvents(this.events, [event]));
  }

  replaceEvents(events: GameEvent[]) {
    this.events = events;
    this.commit();
  }

  pendingEvents(): GameEvent[] {
    return this.events.filter((e) => !this.syncedIds.has(e.id));
  }

  // Called by the sync engine after a successful push/pull.
  markSynced(ids: readonly string[], remote: readonly GameEvent[] = []) {
    for (const id of ids) this.syncedIds.add(id);
    for (const e of remote) this.syncedIds.add(e.id);
    this.events = mergeEvents(this.events, remote);
    this.commit();
  }

  private commit() {
    writeSave(this.storage, { events: this.events, syncedIds: [...this.syncedIds] });
    this.snapshot = this.build();
    for (const fn of this.listeners) fn();
  }

  private build(): Snapshot {
    return {
      game: deriveGame(this.classes, this.events, this.catalog),
      events: this.events,
      pendingCount: this.events.filter((e) => !this.syncedIds.has(e.id)).length,
    };
  }
}

export function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
