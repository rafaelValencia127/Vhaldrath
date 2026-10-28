import { levelFor, MAP_PROGRESS_CAP } from './economy';
import { sortEvents } from './events';
import type { ClassDef, Evidence, GameEvent, QuestDef, SkillCatalog } from './schema';
import { buildSkills, emptyCatalog, type AreaState, type SkillState } from './skills';

export type QuestStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface EvidenceItem extends Evidence {
  id: string;
  at: string;
}

export interface SessionItem {
  id: string;
  at: string;
  hours: number;
  note?: string;
}

export interface QuestState {
  id: string;
  status: QuestStatus;
  hours: number;
  sessions: SessionItem[];
  evidence: EvidenceItem[];
  completedAt?: string;
  notes?: string;
  everCompleted: boolean;
  prerequisiteReopened: boolean;
  mapProgress: number;
}

export interface ChapterState {
  id: string;
  fogged: boolean;
  cleared: boolean;
  completed: number;
  total: number;
}

export interface ClassState {
  id: string;
  xp: number;
  gold: number;
  level: number;
  title?: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  stats: Record<string, number>;
  quests: Record<string, QuestState>;
  chapters: Record<string, ChapterState>;
  nextQuestId?: string;
  lastActivityAt?: string;
  completedCount: number;
}

export interface GameState {
  profile: { name: string };
  classes: Record<string, ClassState>;
  skills: Record<string, SkillState>;
  areas: Record<string, AreaState>;
  lastActivityAt?: string;
}

export const DEFAULT_NAME = 'Adventurer';

interface Working {
  hours: number;
  creditedHours: number;
  sessions: SessionItem[];
  evidence: EvidenceItem[];
  completion?: { at: string; xp: number; gold: number; stats: Record<string, number>; notes?: string; skills: string[] };
  everCompleted: boolean;
}

interface ClassWorking {
  quests: Map<string, Working>;
  timeXp: number;
  timeGold: number;
  lastActivityAt?: string;
}

function working(cw: ClassWorking, questId: string): Working {
  let w = cw.quests.get(questId);
  if (!w) {
    w = { hours: 0, creditedHours: 0, sessions: [], evidence: [], everCompleted: false };
    cw.quests.set(questId, w);
  }
  return w;
}

// Replays the event log against the class definitions. Invalid events (e.g. a duplicate
// completion from another device) are skipped, so the result is always consistent.
export function deriveGame(classes: readonly ClassDef[], events: readonly GameEvent[], catalog: SkillCatalog = emptyCatalog): GameState {
  const defs = new Map(classes.map((c) => [c.id, c]));
  const work = new Map<string, ClassWorking>();
  const profile = { name: DEFAULT_NAME };
  let lastActivityAt: string | undefined;
  // Session XP per skill is permanent; completion XP is added after the replay so undo removes it.
  const skillXp = new Map<string, number>();
  const credit = (tags: readonly string[], xp: number) => {
    for (const tag of tags) skillXp.set(tag, (skillXp.get(tag) ?? 0) + xp);
  };
  // Events recorded before skills existed carry no snapshot: use the quest's current tags.
  const tagsOf = (e: { classId: string; questId: string; skills?: string[] }) =>
    e.skills ?? defs.get(e.classId)?.quests.find((q) => q.id === e.questId)?.skills ?? [];

  const cwFor = (classId: string) => {
    let cw = work.get(classId);
    if (!cw) {
      cw = { quests: new Map(), timeXp: 0, timeGold: 0 };
      work.set(classId, cw);
    }
    return cw;
  };
  const isCompleted = (cw: ClassWorking, questId: string) => !!cw.quests.get(questId)?.completion;

  for (const e of sortEvents(events)) {
    if (e.type === 'profile_updated') {
      profile.name = e.name;
      continue;
    }
    const cw = cwFor(e.classId);
    cw.lastActivityAt = e.at;
    lastActivityAt = e.at;
    const w = working(cw, e.questId);
    switch (e.type) {
      case 'session_logged': {
        const credited = Math.max(0, Math.min(e.hours, e.hourCap - w.creditedHours));
        w.creditedHours += credited;
        w.hours += e.hours;
        cw.timeXp += credited * e.xpPerHour;
        cw.timeGold += credited * e.goldPerHour;
        credit(tagsOf(e), credited * e.xpPerHour);
        w.sessions.push({ id: e.id, at: e.at, hours: e.hours, note: e.note });
        break;
      }
      case 'evidence_added':
        w.evidence.push({ ...e.evidence, id: e.id, at: e.at });
        break;
      case 'evidence_removed':
        w.evidence = w.evidence.filter((x) => x.id !== e.evidenceId);
        break;
      case 'quest_completed': {
        if (w.completion || w.evidence.length === 0) break;
        const quest = defs.get(e.classId)?.quests.find((q) => q.id === e.questId);
        if (quest && !quest.prerequisites.every((p) => isCompleted(cw, p))) break;
        w.completion = { at: e.at, xp: e.xp, gold: e.gold, stats: e.stats, notes: e.notes, skills: tagsOf(e) };
        w.everCompleted = true;
        break;
      }
      case 'quest_undone':
        w.completion = undefined;
        break;
    }
  }

  const result: Record<string, ClassState> = {};
  for (const def of classes) result[def.id] = buildClass(def, cwFor(def.id));
  // Iterate the working state, not the definitions, so XP from removed classes survives.
  for (const cw of work.values()) for (const w of cw.quests.values()) if (w.completion) credit(w.completion.skills, w.completion.xp);
  return { profile, classes: result, ...buildSkills(catalog, skillXp), lastActivityAt };
}

function buildClass(def: ClassDef, cw: ClassWorking): ClassState {
  const stats: Record<string, number> = Object.fromEntries(def.stats.map((s) => [s.id, 0]));
  let xp = cw.timeXp;
  let gold = cw.timeGold;
  for (const w of cw.quests.values()) {
    if (!w.completion) continue;
    xp += w.completion.xp;
    gold += w.completion.gold;
    for (const [k, v] of Object.entries(w.completion.stats)) stats[k] = (stats[k] ?? 0) + v;
  }

  const completed = (id: string) => !!cw.quests.get(id)?.completion;
  const quests: Record<string, QuestState> = {};
  for (const q of def.quests) quests[q.id] = buildQuest(q, cw.quests.get(q.id), completed);

  const chapters: Record<string, ChapterState> = {};
  for (const ch of def.chapters) {
    const list = def.quests.filter((q) => q.chapterId === ch.id);
    const bosses = list.filter((q) => q.boss);
    const goal = bosses.length > 0 ? bosses : list.filter((q) => !q.side);
    chapters[ch.id] = {
      id: ch.id,
      fogged: list.length > 0 && list.every((q) => quests[q.id]!.status === 'locked'),
      cleared: goal.length > 0 && goal.every((q) => quests[q.id]!.status === 'completed'),
      completed: list.filter((q) => quests[q.id]!.status === 'completed').length,
      total: list.length,
    };
  }

  const lv = levelFor(xp, def.xpPerLevel);
  const title = [...def.titles].sort((a, b) => b.level - a.level).find((t) => t.level <= lv.level)?.title;
  const order = def.quests;
  const nextQuestId =
    order.find((q) => quests[q.id]!.status === 'in_progress')?.id ??
    order.find((q) => !q.side && quests[q.id]!.status === 'available')?.id ??
    order.find((q) => quests[q.id]!.status === 'available')?.id;

  return {
    id: def.id,
    xp,
    gold: Math.max(0, gold),
    ...lv,
    title,
    stats,
    quests,
    chapters,
    nextQuestId,
    lastActivityAt: cw.lastActivityAt,
    completedCount: Object.values(quests).filter((q) => q.status === 'completed').length,
  };
}

function buildQuest(q: QuestDef, w: Working | undefined, completed: (id: string) => boolean): QuestState {
  const prereqsMet = q.prerequisites.every(completed);
  const isDone = !!w?.completion;
  let status: QuestStatus;
  if (isDone) status = 'completed';
  else if (!prereqsMet) status = 'locked';
  else if ((w?.hours ?? 0) > 0 || w?.everCompleted) status = 'in_progress';
  else status = 'available';
  return {
    id: q.id,
    status,
    hours: w?.hours ?? 0,
    sessions: w?.sessions ?? [],
    evidence: w?.evidence ?? [],
    completedAt: w?.completion?.at,
    notes: w?.completion?.notes,
    everCompleted: w?.everCompleted ?? false,
    prerequisiteReopened: isDone && !prereqsMet,
    mapProgress: isDone ? 1 : Math.min((w?.hours ?? 0) / q.estimatedHours, MAP_PROGRESS_CAP),
  };
}
