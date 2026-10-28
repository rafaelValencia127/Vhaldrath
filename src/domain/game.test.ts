import { beforeEach, describe, expect, it } from 'vitest';
import { addEvidence, completeQuest, logSession, removeEvidence, undoQuest, updateProfile } from './commands';
import { deriveGame } from './derive';
import { mergeEvents } from './events';
import { eventSchema } from './schema';
import { must, resetClock, testClass, tick, type Log } from './test-fixtures';

const classes = [testClass];

function play(log: Log, fn: (g: ReturnType<typeof deriveGame>) => Parameters<typeof log.push>[0]) {
  log.push(fn(deriveGame(classes, log)));
  return deriveGame(classes, log);
}

function completeWithEvidence(log: Log, questId: string) {
  play(log, (g) => must(addEvidence(g, 'test', questId, { kind: 'link', value: 'https://github.com/x/y/commit/1' }, tick())));
  return play(log, (g) => must(completeQuest(g, testClass, questId, undefined, tick())));
}

beforeEach(() => resetClock());

describe('quest availability', () => {
  it('starts with only root quests available and later chapters fogged', () => {
    const g = deriveGame(classes, []);
    const c = g.classes.test!;
    expect(c.quests.a!.status).toBe('available');
    expect(c.quests.b!.status).toBe('locked');
    expect(c.chapters.ch1!.fogged).toBe(false);
    expect(c.chapters.ch2!.fogged).toBe(true);
    expect(c.level).toBe(1);
    expect(c.xp).toBe(0);
  });

  it('unlocks dependents and clears the next chapter fog after the boss', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    completeWithEvidence(log, 'b');
    const g = completeWithEvidence(log, 'boss1');
    const c = g.classes.test!;
    expect(c.quests.c!.status).toBe('available');
    expect(c.quests.side!.status).toBe('available');
    expect(c.chapters.ch2!.fogged).toBe(false);
    expect(c.chapters.ch1!.cleared).toBe(true);
  });
});

describe('completing a quest', () => {
  it('requires evidence', () => {
    const g = deriveGame(classes, []);
    const r = completeQuest(g, testClass, 'a', undefined, tick());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/evidence/i);
  });

  it('rejects completing a locked quest', () => {
    const log: Log = [];
    play(log, (g) => must(addEvidence(g, 'test', 'b', { kind: 'text', value: 'notes' }, tick())));
    const r = completeQuest(deriveGame(classes, log), testClass, 'b', undefined, tick());
    expect(r.ok).toBe(false);
  });

  it('awards 60% of XP and gold plus +2 primary stat on completion', () => {
    const log: Log = [];
    const g = completeWithEvidence(log, 'a');
    const c = g.classes.test!;
    expect(c.quests.a!.status).toBe('completed');
    expect(c.xp).toBe(60);
    expect(c.gold).toBe(30);
    expect(c.stats).toEqual({ CODE: 2, INT: 0, OPS: 0 });
    expect(c.quests.a!.completedAt).toBeDefined();
  });

  it('awards boss bonus: +5 primary and +1 to every other stat', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    completeWithEvidence(log, 'b');
    const c = completeWithEvidence(log, 'boss1').classes.test!;
    expect(c.stats).toEqual({ CODE: 2 + 5, INT: 2 + 1, OPS: 1 });
    expect(c.xp).toBe(60 + 60 + 180);
  });

  it('never awards XP twice for the same quest, even with a duplicated event', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    expect(completeQuest(deriveGame(classes, log), testClass, 'a', undefined, tick()).ok).toBe(false);
    const dup = { ...log[log.length - 1]!, id: 'other-device-id' };
    const g = deriveGame(classes, [...log, dup]);
    expect(g.classes.test!.xp).toBe(60);
  });
});

describe('time-based progress', () => {
  it('gives 40% of the value at the estimated hours and walks up to 90% on the map', () => {
    const log: Log = [];
    play(log, (g) => must(logSession(g, testClass, 'a', 4, 'read docs', tick())));
    let c = deriveGame(classes, log).classes.test!;
    expect(c.quests.a!.status).toBe('in_progress');
    expect(c.xp).toBeCloseTo(16);
    expect(c.quests.a!.mapProgress).toBeCloseTo(0.4);
    play(log, (g) => must(logSession(g, testClass, 'a', 6, undefined, tick())));
    c = deriveGame(classes, log).classes.test!;
    expect(c.xp).toBeCloseTo(40);
    expect(c.gold).toBeCloseTo(20);
    expect(c.quests.a!.mapProgress).toBeCloseTo(0.9);
    expect(c.stats.CODE).toBe(0);
  });

  it('counts hours only up to 1.5x the estimate (max +20% bonus)', () => {
    const log: Log = [];
    play(log, (g) => must(logSession(g, testClass, 'a', 12, undefined, tick())));
    play(log, (g) => must(logSession(g, testClass, 'a', 12, undefined, tick())));
    const c = deriveGame(classes, log).classes.test!;
    expect(c.quests.a!.hours).toBe(24);
    expect(c.xp).toBeCloseTo(60);
  });

  it('rejects invalid hours and sessions on locked quests', () => {
    const g = deriveGame(classes, []);
    expect(logSession(g, testClass, 'a', 0, undefined, tick()).ok).toBe(false);
    expect(logSession(g, testClass, 'a', 25, undefined, tick()).ok).toBe(false);
    expect(logSession(g, testClass, 'b', 1, undefined, tick()).ok).toBe(false);
  });
});

describe('undo', () => {
  it('reverts only completion rewards and keeps session rewards and evidence', () => {
    const log: Log = [];
    play(log, (g) => must(logSession(g, testClass, 'a', 5, undefined, tick())));
    completeWithEvidence(log, 'a');
    const g = play(log, (gg) => must(undoQuest(gg, 'test', 'a', tick())));
    const c = g.classes.test!;
    expect(c.quests.a!.status).toBe('in_progress');
    expect(c.xp).toBeCloseTo(20);
    expect(c.stats.CODE).toBe(0);
    expect(c.quests.a!.evidence).toHaveLength(1);
    expect(c.quests.b!.status).toBe('locked');
  });

  it('keeps completed dependents completed and flags their reopened prerequisite', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    completeWithEvidence(log, 'b');
    const c = play(log, (g) => must(undoQuest(g, 'test', 'a', tick()))).classes.test!;
    expect(c.quests.b!.status).toBe('completed');
    expect(c.quests.b!.prerequisiteReopened).toBe(true);
    expect(c.xp).toBe(60);
  });

  it('can complete again after undo without double counting', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    play(log, (g) => must(undoQuest(g, 'test', 'a', tick())));
    const c = play(log, (g) => must(completeQuest(g, testClass, 'a', undefined, tick()))).classes.test!;
    expect(c.xp).toBe(60);
  });

  it('rejects undo of a quest that is not completed', () => {
    expect(undoQuest(deriveGame(classes, []), 'test', 'a', tick()).ok).toBe(false);
  });
});

describe('evidence', () => {
  it('validates links and allows removing evidence', () => {
    const g = deriveGame(classes, []);
    expect(addEvidence(g, 'test', 'a', { kind: 'link', value: 'not a url' }, tick()).ok).toBe(false);
    expect(addEvidence(g, 'test', 'a', { kind: 'text', value: '   ' }, tick()).ok).toBe(false);
    const log: Log = [];
    const added = must(addEvidence(g, 'test', 'a', { kind: 'text', value: 'I learned pytest fixtures' }, tick()));
    log.push(added);
    const c = play(log, (gg) => must(removeEvidence(gg, 'test', 'a', added.id, tick()))).classes.test!;
    expect(c.quests.a!.evidence).toHaveLength(0);
  });
});

describe('levels and titles', () => {
  it('uses level = 1 + floor(xp / xpPerLevel) and the highest reached title', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    completeWithEvidence(log, 'b');
    let c = completeWithEvidence(log, 'boss1').classes.test!;
    expect(c.xp).toBe(300);
    expect(c.level).toBe(2);
    expect(c.title).toBe('Novice');
    expect(c.xpIntoLevel).toBe(80);
    expect(c.xpForNextLevel).toBe(220);
    play(log, (g) => must(logSession(g, testClass, 'c', 15, undefined, tick())));
    c = completeWithEvidence(log, 'c').classes.test!;
    expect(c.xp).toBe(300 + 60 + 60);
    expect(c.level).toBe(2);
  });
});

describe('next quest and profile', () => {
  it('recommends in-progress first, then main quests before side quests', () => {
    const log: Log = [];
    expect(deriveGame(classes, log).classes.test!.nextQuestId).toBe('a');
    completeWithEvidence(log, 'a');
    completeWithEvidence(log, 'b');
    completeWithEvidence(log, 'boss1');
    expect(deriveGame(classes, log).classes.test!.nextQuestId).toBe('c');
    play(log, (g) => must(logSession(g, testClass, 'side', 1, undefined, tick())));
    expect(deriveGame(classes, log).classes.test!.nextQuestId).toBe('side');
  });

  it('stores the display name without touching progress', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    const g = play(log, () => must(updateProfile('Rafael', tick())));
    expect(g.profile.name).toBe('Rafael');
    expect(g.classes.test!.xp).toBe(60);
  });
});

describe('XP permanence', () => {
  it('keeps XP from quests removed from the class definition', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    const trimmed = { ...testClass, quests: testClass.quests.filter((q) => q.id !== 'a').map((q) => ({ ...q, prerequisites: q.prerequisites.filter((p) => p !== 'a') })) };
    const c = deriveGame([trimmed], log).classes.test!;
    expect(c.xp).toBe(60);
    expect(c.stats.CODE).toBe(2);
  });
});

describe('merging devices', () => {
  it('unions events by id and produces the same state in any order', () => {
    const shared: Log = [];
    completeWithEvidence(shared, 'a');
    const pc1 = [...shared];
    const pc2 = [...shared];
    play(pc1, (g) => must(logSession(g, testClass, 'b', 2, 'pc1', tick())));
    play(pc2, (g) => must(logSession(g, testClass, 'b', 3, 'pc2', tick())));
    const m1 = mergeEvents(pc1, pc2);
    const m2 = mergeEvents(pc2, pc1);
    expect(m1.map((e) => e.id)).toEqual(m2.map((e) => e.id));
    expect(m1).toHaveLength(shared.length + 2);
    expect(deriveGame(classes, m1).classes.test!.quests.b!.hours).toBe(5);
  });
});

describe('skill snapshots', () => {
  it('logSession snapshots the quest tags', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    const ev = must(logSession(deriveGame(classes, log), testClass, 'b', 2, undefined, tick()));
    expect(ev.skills).toEqual(['python', 'ml']);
  });

  it('completeQuest snapshots the quest tags', () => {
    const log: Log = [];
    completeWithEvidence(log, 'a');
    completeWithEvidence(log, 'b');
    completeWithEvidence(log, 'boss1');
    const done = log.filter((e) => e.type === 'quest_completed').at(-1)!;
    expect(done.type === 'quest_completed' && done.skills).toEqual(['ml']);
  });

  it('quests without tags leave the field out', () => {
    const untagged = { ...testClass, quests: testClass.quests.map((q) => (q.id === 'a' ? { ...q, skills: [] } : q)) };
    const ev = must(logSession(deriveGame([untagged], []), untagged, 'a', 1, undefined, tick()));
    expect('skills' in ev).toBe(false);
  });

  it('old events still validate', () => {
    const old = { id: 'x1', at: '2026-10-20T10:00:00.000Z', type: 'quest_completed', classId: 'test', questId: 'a', xp: 60, gold: 30, stats: {} };
    expect(eventSchema.safeParse(old).success).toBe(true);
    expect(eventSchema.safeParse({ ...old, skills: [''] }).success).toBe(false);
  });
});
