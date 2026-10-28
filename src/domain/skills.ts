import type { SkillCatalog } from './schema';

// Uncapped skill curve: each level costs 30 XP more than the previous one, starting at 100.
const FIRST_LEVEL_COST = 100;
const COST_STEP = 30;

export const OTHER_AREA_ID = 'other';
const OTHER_AREA_NAME = 'Other';

export const emptyCatalog: SkillCatalog = { areas: [], skills: [], titles: [] };

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export interface SkillState extends LevelProgress {
  id: string;
  name: string;
  areaId: string;
  xp: number;
  title?: string;
}

export interface AreaState extends LevelProgress {
  id: string;
  name: string;
  xp: number;
  skillIds: string[];
}

export interface SkillLevelUp {
  skillId: string;
  name: string;
  level: number;
  title?: string;
}

export function xpToNextLevel(level: number): number {
  return FIRST_LEVEL_COST + COST_STEP * (level - 1);
}

export function xpAtLevel(level: number): number {
  const n = level - 1;
  return FIRST_LEVEL_COST * n + (COST_STEP * n * (n - 1)) / 2;
}

export function skillLevelFor(xp: number): LevelProgress {
  const whole = Number.isFinite(xp) && xp > 0 ? Math.floor(xp + 1e-9) : 0;
  // Solve xpAtLevel(L) <= whole for the largest L, then correct for float rounding.
  const a = COST_STEP / 2;
  const b = FIRST_LEVEL_COST - COST_STEP / 2;
  let level = 1 + Math.floor((-b + Math.sqrt(b * b + 4 * a * whole)) / (2 * a));
  while (level > 1 && xpAtLevel(level) > whole) level--;
  while (xpAtLevel(level + 1) <= whole) level++;
  return { level, xpIntoLevel: whole - xpAtLevel(level), xpForNextLevel: xpToNextLevel(level) };
}

export function buildSkills(
  catalog: SkillCatalog,
  xpBySkill: ReadonlyMap<string, number>,
): { skills: Record<string, SkillState>; areas: Record<string, AreaState> } {
  const skillDefs = new Map(catalog.skills.map((s) => [s.id, s]));
  const areaNames = new Map(catalog.areas.map((a) => [a.id, a.name]));
  const skills: Record<string, SkillState> = {};
  for (const [id, raw] of xpBySkill) {
    const xp = Number.isFinite(raw) ? raw : 0;
    if (xp <= 0) continue;
    const def = skillDefs.get(id);
    const lv = skillLevelFor(xp);
    const title = catalog.titles
      .filter((t) => t.skillId === id && t.level <= lv.level)
      .sort((x, y) => y.level - x.level)[0]?.title;
    skills[id] = { id, name: def?.name ?? id, areaId: def?.areaId ?? OTHER_AREA_ID, xp, ...lv, ...(title ? { title } : {}) };
  }

  const areas: Record<string, AreaState> = {};
  const byXp = Object.values(skills).sort((x, y) => y.xp - x.xp || (x.id < y.id ? -1 : 1));
  for (const s of byXp) {
    const area = (areas[s.areaId] ??= {
      id: s.areaId,
      name: areaNames.get(s.areaId) ?? (s.areaId === OTHER_AREA_ID ? OTHER_AREA_NAME : s.areaId),
      xp: 0,
      skillIds: [],
      ...skillLevelFor(0),
    });
    area.xp += s.xp;
    area.skillIds.push(s.id);
  }
  for (const area of Object.values(areas)) Object.assign(area, skillLevelFor(area.xp));
  return { skills, areas };
}

export function levelUps(
  before: { skills: Record<string, SkillState> },
  after: { skills: Record<string, SkillState> },
): SkillLevelUp[] {
  const ups: SkillLevelUp[] = [];
  for (const s of Object.values(after.skills)) {
    const prev = before.skills[s.id];
    if (s.level <= (prev?.level ?? 1)) continue;
    ups.push({ skillId: s.id, name: s.name, level: s.level, ...(s.title && s.title !== prev?.title ? { title: s.title } : {}) });
  }
  return ups;
}
