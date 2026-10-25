import type { GameEvent } from './schema';

export interface EventContext {
  id: string;
  now: string;
}

export function newEventContext(): EventContext {
  return { id: crypto.randomUUID(), now: new Date().toISOString() };
}

// Deterministic replay order on every device: by timestamp, then id.
export function compareEvents(a: GameEvent, b: GameEvent): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortEvents(events: readonly GameEvent[]): GameEvent[] {
  return [...events].sort(compareEvents);
}

// Union by id. Same id means same event, so the first copy wins.
export function mergeEvents(...logs: readonly (readonly GameEvent[])[]): GameEvent[] {
  const byId = new Map<string, GameEvent>();
  for (const log of logs) for (const e of log) if (!byId.has(e.id)) byId.set(e.id, e);
  return sortEvents([...byId.values()]);
}
