import { describe, expect, it } from 'vitest';
import { aiEngineerClass } from '../../content/ai-engineer';
import { testClass } from '../../domain/test-fixtures';
import { buildLayout, MAP_HEIGHT } from './layout';

describe('map layout', () => {
  it('places one stop per quest, in order, inside the map', () => {
    const l = buildLayout(aiEngineerClass);
    expect(l.stops).toHaveLength(36);
    expect(l.regions.map((r) => r.biome)).toEqual(['meadow', 'forest', 'peaks', 'citadel', 'harbor']);
    for (let i = 1; i < 36; i++) expect(l.stops[i]!.x).toBeGreaterThan(l.stops[i - 1]!.x);
    for (const s of l.stops) {
      expect(s.y).toBeGreaterThanOrEqual(1);
      expect(s.y).toBeLessThan(MAP_HEIGHT);
      expect(s.x).toBeLessThan(l.width);
    }
    expect(l.stops.filter((s) => s.boss)).toHaveLength(5);
    for (let i = 1; i < l.regions.length; i++) expect(l.regions[i]!.x0).toBe(l.regions[i - 1]!.x1 + 1);
  });

  it('is deterministic and keeps decorations off the road', () => {
    const a = buildLayout(aiEngineerClass);
    const b = buildLayout(aiEngineerClass);
    expect(a).toEqual(b);
    const road = new Set(a.road.map((p) => `${p.x},${p.y}`));
    for (const d of a.decor) expect(road.has(`${d.x},${d.y}`)).toBe(false);
  });

  it('branches side quests off their prerequisite', () => {
    const l = buildLayout(testClass);
    const side = l.stops.find((s) => s.questId === 'side')!;
    const boss = l.stops.find((s) => s.questId === 'boss1')!;
    expect(side.side).toBe(true);
    expect(Math.abs(side.y - boss.y)).toBe(4);
    expect(l.sideRoads.length).toBeGreaterThan(0);
  });
});
