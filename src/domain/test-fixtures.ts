import type { ClassDef, GameEvent } from './schema';

// Tiny class used by domain tests: two chapters, a fork, a side quest and bosses.
export const testClass: ClassDef = {
  id: 'test',
  name: 'Tester',
  icon: '🧪',
  xpPerLevel: 220,
  titles: [
    { level: 2, title: 'Novice' },
    { level: 3, title: 'Adept' },
  ],
  stats: [
    { id: 'CODE', name: 'Engineering', description: '' },
    { id: 'INT', name: 'Intelligence', description: '' },
    { id: 'OPS', name: 'Reliability', description: '' },
  ],
  chapters: [
    { id: 'ch1', name: 'One', subtitle: '', biome: 'meadow' },
    { id: 'ch2', name: 'Two', subtitle: '', biome: 'forest' },
  ],
  quests: [
    q('a', 'ch1', [], 'CODE', 100, false),
    q('b', 'ch1', ['a'], 'INT', 100, false),
    q('boss1', 'ch1', ['b'], 'CODE', 300, true),
    q('c', 'ch2', ['boss1'], 'OPS', 100, false),
    { ...q('side', 'ch2', ['boss1'], 'INT', 100, false), side: true },
  ],
};

function q(id: string, chapterId: string, prerequisites: string[], stat: string, xp: number, boss: boolean) {
  return {
    id,
    chapterId,
    title: `Quest ${id}`,
    stat,
    xp,
    boss,
    side: false,
    estimatedHours: 10,
    prerequisites,
    acceptance: 'Do it',
    evidenceHint: 'Link',
    resources: [],
  };
}

let clock = Date.parse('2026-10-20T10:00:00.000Z');
let counter = 0;
export function resetClock() {
  clock = Date.parse('2026-10-20T10:00:00.000Z');
  counter = 0;
}
export function tick(): { id: string; now: string } {
  clock += 60_000;
  counter += 1;
  return { id: `e${String(counter).padStart(4, '0')}`, now: new Date(clock).toISOString() };
}

export function must<T>(r: { ok: true; event: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.event;
}

export type Log = GameEvent[];
