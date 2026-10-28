import { describe, expect, it } from 'vitest';
import { deriveGame } from '../domain/derive';
import { xpAtLevel } from '../domain/skills';
import { aiEngineerClass } from './ai-engineer';
import { builtInCatalog } from './skills';

describe('AI Engineer seed', () => {
  it('has exactly the 36 roadmap quests with bosses at 9, 18, 26, 34 and 36', () => {
    expect(aiEngineerClass.quests).toHaveLength(36);
    expect(aiEngineerClass.quests.filter((q) => q.boss).map((q) => q.week)).toEqual([9, 18, 26, 34, 36]);
    expect(aiEngineerClass.quests[0]!.title).toBe('Set up Python, uv or venv, Git repo and pytest; run green sample tests.');
    expect(aiEngineerClass.quests[35]!.prerequisites).toEqual(['week-35']);
  });

  it('totals 4,600 XP so every title is reachable (max level 21)', () => {
    const total = aiEngineerClass.quests.reduce((s, q) => s + q.xp, 0);
    expect(total).toBe(4600);
    expect(1 + Math.floor(total / aiEngineerClass.xpPerLevel)).toBe(21);
    expect(Math.max(...aiEngineerClass.titles.map((t) => t.level))).toBeLessThanOrEqual(21);
  });

  it('only links to the official library', () => {
    const allowed = /^(https:\/\/(cs50\.harvard\.edu|www\.kaggle\.com|developers\.google\.com|huggingface\.co|fullstackdeeplearning\.com|fastapi\.tiangolo\.com|docs\.docker\.com|developer\.hashicorp\.com|skillbuilder\.aws|github\.com\/DataTalksClub|aws\.amazon\.com)\/)/;
    for (const q of aiEngineerClass.quests) for (const r of q.resources) expect(r.url).toMatch(allowed);
  });

  it('every quest has at least one tag and every tag is in the catalog', () => {
    const known = new Set(builtInCatalog.skills.map((s) => s.id));
    for (const q of aiEngineerClass.quests) {
      expect(q.skills.length).toBeGreaterThan(0);
      for (const tag of q.skills) expect(known.has(tag)).toBe(true);
    }
  });

  it('every catalog title points to an existing skill and every skill to an existing area', () => {
    const skills = new Set(builtInCatalog.skills.map((s) => s.id));
    const areas = new Set(builtInCatalog.areas.map((a) => a.id));
    for (const t of builtInCatalog.titles) expect(skills.has(t.skillId)).toBe(true);
    for (const s of builtInCatalog.skills) expect(areas.has(s.areaId)).toBe(true);
  });

  it('each title is reachable from the roadmap alone', () => {
    const xpFor = (tag: string) => aiEngineerClass.quests.filter((q) => q.skills.includes(tag)).reduce((s, q) => s + q.xp, 0);
    expect(['python', 'llm', 'cloud', 'mlops'].map(xpFor)).toEqual([800, 1000, 800, 1000]);
    for (const t of builtInCatalog.titles) expect(xpFor(t.skillId)).toBeGreaterThanOrEqual(xpAtLevel(t.level));
  });

  it('week 1 and week 36 tags', () => {
    expect(aiEngineerClass.quests[0]!.skills).toEqual(['python', 'testing']);
    expect(aiEngineerClass.quests[35]!.skills).toEqual(['english']);
  });

  it('starts with week 1 available and chapter 2 under fog', () => {
    const c = deriveGame([aiEngineerClass], []).classes['ai-engineer']!;
    expect(c.nextQuestId).toBe('week-01');
    expect(c.chapters['ch2-llm-artificer']!.fogged).toBe(true);
  });
});
