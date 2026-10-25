import { describe, expect, it } from 'vitest';
import { aiEngineerClass } from '../content/ai-engineer';
import { addEvidence, completeQuest, logSession } from '../domain/commands';
import { mergeEvents } from '../domain/events';
import type { GameEvent } from '../domain/schema';
import { GameStore, memoryStorage } from './store';
import { SyncEngine, type RemoteEvents } from './sync-engine';

function fakeRemote() {
  let rows: GameEvent[] = [];
  let failNext = false;
  const remote: RemoteEvents & { rows: () => GameEvent[]; fail: () => void } = {
    rows: () => rows,
    fail: () => void (failNext = true),
    async push(events) {
      if (failNext) {
        failNext = false;
        throw new Error('network down');
      }
      rows = mergeEvents(rows, events);
    },
    async pullAll() {
      return rows;
    },
  };
  return remote;
}

let n = 0;
const ctx = () => ({ id: `ev-${++n}`, now: new Date(Date.UTC(2026, 9, 20, 10, 0, n)).toISOString() });
function must<T>(r: { ok: true; event: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.event;
}

describe('sync between two devices', () => {
  it('brings progress from PC 1 to PC 2 without duplicating XP', async () => {
    const remote = fakeRemote();
    const pc1 = new GameStore([aiEngineerClass], memoryStorage());
    const pc2 = new GameStore([aiEngineerClass], memoryStorage());
    const s1 = new SyncEngine(pc1, remote);
    const s2 = new SyncEngine(pc2, remote);

    pc1.append(must(addEvidence(pc1.getSnapshot().game, 'ai-engineer', 'week-01', { kind: 'text', value: 'done' }, ctx())));
    pc1.append(must(completeQuest(pc1.getSnapshot().game, aiEngineerClass, 'week-01', undefined, ctx())));
    pc2.append(must(logSession(pc2.getSnapshot().game, aiEngineerClass, 'week-01', 2, 'offline on pc2', ctx())));

    await s1.syncNow();
    await s2.syncNow();
    await s1.syncNow();
    await s2.syncNow();

    for (const pc of [pc1, pc2]) {
      const c = pc.getSnapshot().game.classes['ai-engineer']!;
      expect(c.xp).toBeCloseTo(60 + 8);
      expect(c.quests['week-01']!.status).toBe('completed');
      expect(pc.getSnapshot().pendingCount).toBe(0);
    }
    expect(s1.getState().status).toBe('synced');
    expect(remote.rows()).toHaveLength(3);
  });

  it('keeps changes pending when offline or on error, and recovers later', async () => {
    const remote = fakeRemote();
    const store = new GameStore([aiEngineerClass], memoryStorage());
    let online = false;
    const engine = new SyncEngine(store, remote, () => online);
    store.append(must(logSession(store.getSnapshot().game, aiEngineerClass, 'week-01', 1, undefined, ctx())));

    await engine.syncNow();
    expect(engine.getState().status).toBe('offline');
    expect(store.getSnapshot().pendingCount).toBe(1);

    online = true;
    remote.fail();
    await engine.syncNow();
    expect(engine.getState().status).toBe('error');
    expect(store.getSnapshot().pendingCount).toBe(1);

    await engine.syncNow();
    expect(engine.getState().status).toBe('synced');
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('runs in local-only mode without a remote', async () => {
    const engine = new SyncEngine(new GameStore([aiEngineerClass], memoryStorage()), null);
    await engine.syncNow();
    expect(engine.getState().status).toBe('local-only');
  });
});
