import { describe, expect, it } from 'vitest';
import type { SkillCatalog } from './schema';
import { buildSkills, levelUps, skillLevelFor, xpAtLevel, xpToNextLevel, type SkillState } from './skills';

const catalog: SkillCatalog = {
  areas: [{ id: 'eng', name: 'Engineering' }],
  skills: [
    { id: 'python', name: 'Python', areaId: 'eng' },
    { id: 'ml', name: 'Machine Learning', areaId: 'eng' },
  ],
  titles: [{ skillId: 'python', level: 2, title: 'Pythonista' }],
};

const sheet = (xp: Record<string, number>) => buildSkills(catalog, new Map(Object.entries(xp)));

describe('skill level curve', () => {
  it('curve costs', () => {
    expect(xpToNextLevel(1)).toBe(100);
    expect(xpToNextLevel(2)).toBe(130);
    expect(xpToNextLevel(10)).toBe(370);
    expect(xpAtLevel(1)).toBe(0);
    expect(xpAtLevel(2)).toBe(100);
    expect(xpAtLevel(5)).toBe(580);
    for (let n = 1; n <= 60; n++) expect(xpToNextLevel(n + 1)).toBeGreaterThan(xpToNextLevel(n));
  });

  it('skillLevelFor boundaries', () => {
    expect(skillLevelFor(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(skillLevelFor(99.9).level).toBe(1);
    expect(skillLevelFor(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 130 });
    expect(skillLevelFor(229).level).toBe(2);
    expect(skillLevelFor(230).level).toBe(3);
  });

  it('no cap and bad input', () => {
    const big = skillLevelFor(1e9).level;
    expect(Number.isFinite(big)).toBe(true);
    expect(big).toBeGreaterThan(1000);
    for (const bad of [-5, NaN, Infinity]) expect(skillLevelFor(bad)).toEqual(skillLevelFor(0));
  });
});

describe('buildSkills', () => {
  it('levels skills, sums areas and picks titles', () => {
    const { skills, areas } = sheet({ python: 120, ml: 60 });
    expect(skills.python!.level).toBe(2);
    expect(skills.python!.title).toBe('Pythonista');
    expect(skills.ml!.level).toBe(1);
    expect(skills.ml!.title).toBeUndefined();
    expect(areas.eng!.xp).toBe(180);
    expect(areas.eng!.skillIds).toEqual(['python', 'ml']);
  });

  it('omits skills and areas without XP', () => {
    const { skills, areas } = sheet({ python: 0 });
    expect(skills).toEqual({});
    expect(areas).toEqual({});
  });

  it('puts unknown skill ids under Other', () => {
    const { skills, areas } = sheet({ zig: 50 });
    expect(skills.zig).toMatchObject({ name: 'zig', areaId: 'other' });
    expect(areas.other!.name).toBe('Other');
  });
});

describe('levelUps', () => {
  const state = (xp: Record<string, number>): { skills: Record<string, SkillState> } => ({ skills: sheet(xp).skills });

  it('reports a skill whose level rose', () => {
    expect(levelUps(state({ python: 90 }), state({ python: 100 }))).toEqual([{ skillId: 'python', name: 'Python', level: 2, title: 'Pythonista' }]);
    expect(levelUps(state({ ml: 90 }), state({ ml: 100 }))).toEqual([{ skillId: 'ml', name: 'Machine Learning', level: 2 }]);
  });

  it('ignores a new skill that is still level 1', () => {
    expect(levelUps(state({}), state({ ml: 60 }))).toEqual([]);
  });
});
