import { z } from 'zod';
import { mergeEvents } from '../domain/events';
import { eventSchema, type GameEvent } from '../domain/schema';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'mlar:save';
export const SAVE_VERSION = 1;

export interface SaveData {
  events: GameEvent[];
  syncedIds: string[];
}

export interface LoadResult {
  data: SaveData;
  warning?: string;
}

const envelopeSchema = z.object({
  version: z.literal(SAVE_VERSION),
  events: z.array(z.unknown()),
  syncedIds: z.array(z.string()).default([]),
});

// Keeps every valid event; anything unreadable is backed up, never silently discarded.
function parseEvents(raw: unknown[]): { events: GameEvent[]; dropped: number } {
  const events: GameEvent[] = [];
  let dropped = 0;
  for (const item of raw) {
    const r = eventSchema.safeParse(item);
    if (r.success) events.push(r.data);
    else dropped += 1;
  }
  return { events, dropped };
}

export function loadSave(storage: KeyValueStorage): LoadResult {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return { data: { events: [], syncedIds: [] } };
  try {
    const env = envelopeSchema.parse(JSON.parse(raw));
    const { events, dropped } = parseEvents(env.events);
    if (dropped > 0) storage.setItem(`${SAVE_KEY}:backup:${Date.now()}`, raw);
    return {
      data: { events: mergeEvents(events), syncedIds: env.syncedIds },
      warning: dropped > 0 ? `${dropped} unreadable entries were skipped. A backup copy was kept in this browser.` : undefined,
    };
  } catch {
    storage.setItem(`${SAVE_KEY}:backup:${Date.now()}`, raw);
    return {
      data: { events: [], syncedIds: [] },
      warning: 'The saved game in this browser could not be read. A backup copy was kept; sign in or import a JSON backup to restore progress.',
    };
  }
}

export function writeSave(storage: KeyValueStorage, data: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...data }));
}

export const EXPORT_APP = 'my-life-as-rpg';

export function exportBackup(events: readonly GameEvent[], now = new Date()): string {
  return JSON.stringify({ app: EXPORT_APP, version: SAVE_VERSION, exportedAt: now.toISOString(), events }, null, 2);
}

const backupSchema = z.object({
  app: z.literal(EXPORT_APP),
  version: z.literal(SAVE_VERSION),
  events: z.array(z.unknown()),
});

export type ImportResult =
  | { ok: true; events: GameEvent[]; added: number; skipped: number }
  | { ok: false; error: string };

// Imports merge as events (union by id), so re-importing the same backup never duplicates XP.
export function importBackup(text: string, current: readonly GameEvent[]): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const env = backupSchema.safeParse(json);
  if (!env.success) return { ok: false, error: 'This file is not a My Life as RPG backup (version 1).' };
  const { events, dropped } = parseEvents(env.data.events);
  const known = new Set(current.map((e) => e.id));
  const added = events.filter((e) => !known.has(e.id)).length;
  return { ok: true, events: mergeEvents(current, events), added, skipped: dropped };
}
