import { describe, expect, it } from 'vitest';
import { aiEngineerClass } from '../content/ai-engineer';
import { addEvidence, completeQuest, logSession } from '../domain/commands';
import { exportBackup, importBackup, SAVE_KEY } from '../infra/local-save';
import { builtInCatalog } from '../content/skills';
import { memoryStorage, GameStore } from './store';

const ctx = (n: number) => ({ id: `id-${n}`, now: new Date(Date.UTC(2026, 9, 20, 10, n)).toISOString() });

function must<T>(r: { ok: true; event: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.event;
}

describe('demo: completing a quest end to end', () => {
  it('updates XP, level, stat, unlocks the next quest and survives a reload', () => {
    const storage = memoryStorage();
    const store = new GameStore([aiEngineerClass], storage);
    const g0 = store.getSnapshot().game;
    store.append(must(logSession(g0, aiEngineerClass, 'week-01', 10, 'set up uv + pytest', ctx(1))));
    store.append(must(addEvidence(store.getSnapshot().game, 'ai-engineer', 'week-01', { kind: 'link', value: 'https://github.com/rafael/quest/commit/abc' }, ctx(2))));
    store.append(must(completeQuest(store.getSnapshot().game, aiEngineerClass, 'week-01', 'green tests', ctx(3))));

    const after = store.getSnapshot().game.classes['ai-engineer']!;
    expect(after.xp).toBe(100);
    expect(after.gold).toBe(50);
    expect(after.stats.CODE).toBe(2);
    expect(after.quests['week-01']!.status).toBe('completed');
    expect(after.quests['week-02']!.status).toBe('available');

    const reloaded = new GameStore([aiEngineerClass], storage).getSnapshot().game.classes['ai-engineer']!;
    expect(reloaded.xp).toBe(100);
    expect(reloaded.quests['week-01']!.status).toBe('completed');
    expect(reloaded.quests['week-02']!.status).toBe('available');
    expect(reloaded.level).toBe(1);
  });
});

describe('local save integrity', () => {
  it('recovers from a corrupt save without losing the raw data', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    const store = new GameStore([aiEngineerClass], storage);
    expect(store.loadWarning).toMatch(/could not be read/);
    expect(store.getSnapshot().events).toHaveLength(0);
    expect([...storage.data.keys()].some((k) => k.startsWith(`${SAVE_KEY}:backup:`))).toBe(true);
  });

  it('skips individual invalid events and keeps the valid ones', () => {
    const storage = memoryStorage();
    const good = { id: 'p1', at: '2026-10-20T10:00:00.000Z', type: 'profile_updated', name: 'Rafael' };
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, events: [good, { type: 'bogus' }], syncedIds: [] }));
    const store = new GameStore([aiEngineerClass], storage);
    expect(store.getSnapshot().game.profile.name).toBe('Rafael');
    expect(store.loadWarning).toMatch(/1 unreadable/);
  });

  it('tracks which events still need to be synced', () => {
    const store = new GameStore([aiEngineerClass], memoryStorage());
    store.append(must(logSession(store.getSnapshot().game, aiEngineerClass, 'week-01', 1, undefined, ctx(1))));
    expect(store.getSnapshot().pendingCount).toBe(1);
    store.markSynced(['id-1']);
    expect(store.getSnapshot().pendingCount).toBe(0);
  });
});

describe('JSON backup', () => {
  it('round-trips and never duplicates XP on re-import', () => {
    const store = new GameStore([aiEngineerClass], memoryStorage());
    store.append(must(addEvidence(store.getSnapshot().game, 'ai-engineer', 'week-01', { kind: 'text', value: 'done' }, ctx(1))));
    store.append(must(completeQuest(store.getSnapshot().game, aiEngineerClass, 'week-01', undefined, ctx(2))));
    const text = exportBackup(store.getSnapshot().events);
    const r = importBackup(text, store.getSnapshot().events);
    expect(r.ok && r.added).toBe(0);
    if (r.ok) store.replaceEvents(r.events);
    expect(store.getSnapshot().game.classes['ai-engineer']!.xp).toBe(60);
  });

  it('skips imported link evidence that is not http(s)', () => {
    const bad = { id: 'x1', at: '2026-10-20T10:00:00.000Z', type: 'evidence_added', classId: 'ai-engineer', questId: 'week-01', evidence: { kind: 'link', value: 'javascript:alert(1)' } };
    const r = importBackup(JSON.stringify({ app: 'my-life-as-rpg', version: 1, events: [bad] }), []);
    expect(r.ok && r.added).toBe(0);
    expect(r.ok && r.skipped).toBe(1);
  });

  it('rejects files that are not backups', () => {
    expect(importBackup('nope', []).ok).toBe(false);
    const r = importBackup(JSON.stringify({ app: 'other', version: 1, events: [] }), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a My Life as RPG backup/);
  });
});

describe('skills through the store', () => {
  it('derives skill XP with the catalog and keeps it after a reload', () => {
    const storage = memoryStorage();
    const store = new GameStore([aiEngineerClass], storage, builtInCatalog);
    store.append(must(addEvidence(store.getSnapshot().game, 'ai-engineer', 'week-01', { kind: 'text', value: 'pytest green' }, ctx(1))));
    store.append(must(completeQuest(store.getSnapshot().game, aiEngineerClass, 'week-01', undefined, ctx(2))));
    for (const game of [store.getSnapshot().game, new GameStore([aiEngineerClass], storage, builtInCatalog).getSnapshot().game]) {
      expect(game.skills.python!.xp).toBe(60);
      expect(game.skills.testing!.xp).toBe(60);
      expect(game.areas.engineering!.xp).toBe(120);
    }
  });
});
