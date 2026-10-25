import type { ClassState, QuestStatus } from '../../domain/derive';
import type { Biome } from '../../domain/schema';
import type { TileName } from './atlas-index';
import type { MapLayout, Point } from './layout';

// Turns a layout + game state into draw operations. Pure, so the canvas renderer
// and tests share exactly the same picture.

export type DrawOp =
  | { kind: 'tile'; tile: TileName; x: number; y: number }
  | { kind: 'tint'; x0: number; x1: number; color: string }
  | { kind: 'marker'; x: number; y: number; status: QuestStatus; boss: boolean }
  | { kind: 'fog'; x0: number; x1: number };

export const BIOME_TINT: Record<Biome, string | null> = {
  meadow: null,
  forest: 'rgba(120, 60, 0, 0.10)',
  peaks: 'rgba(60, 110, 190, 0.22)',
  citadel: 'rgba(40, 20, 70, 0.18)',
  harbor: 'rgba(0, 120, 150, 0.12)',
};

const GROUND: Record<Biome, TileName> = {
  meadow: 'grass',
  forest: 'grass',
  peaks: 'grass',
  citadel: 'stoneFloor',
  harbor: 'sand',
};

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h % 1000) / 1000;
}

export function composeMap(layout: MapLayout, cls: ClassState): DrawOp[] {
  const ops: DrawOp[] = [];
  const biomeAt = (x: number) => layout.regions.find((r) => x >= r.x0 && x <= r.x1)?.biome ?? 'meadow';

  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const b = biomeAt(x);
      let tile = GROUND[b];
      if (tile === 'grass') {
        const h = hash(x, y);
        tile = h < 0.07 ? 'grassTuft' : h < 0.1 && b === 'meadow' ? 'grassFlower' : 'grass';
      }
      ops.push({ kind: 'tile', tile, x, y });
    }
  }
  for (const r of layout.regions) {
    const color = BIOME_TINT[r.biome];
    if (color) ops.push({ kind: 'tint', x0: r.x0, x1: r.x1 + 1, color });
  }
  for (const p of layout.road) ops.push({ kind: 'tile', tile: 'road', ...p });
  for (const p of layout.sideRoads) ops.push({ kind: 'tile', tile: 'road', ...p });
  for (const d of layout.decor) ops.push({ kind: 'tile', ...d });

  for (const s of layout.stops) {
    const q = cls.quests[s.questId];
    const status = q?.status ?? 'locked';
    if (s.boss) {
      ops.push(
        { kind: 'tile', tile: 'battlementL', x: s.x - 1, y: s.y - 2 },
        { kind: 'tile', tile: 'battlementM', x: s.x, y: s.y - 2 },
        { kind: 'tile', tile: 'battlementR', x: s.x + 1, y: s.y - 2 },
        { kind: 'tile', tile: 'gateTopL', x: s.x - 1, y: s.y - 1 },
        { kind: 'tile', tile: 'gateTopM', x: s.x, y: s.y - 1 },
        { kind: 'tile', tile: 'gateTopR', x: s.x + 1, y: s.y - 1 },
      );
      ops.push({ kind: 'marker', x: s.x, y: s.y, status, boss: true });
      ops.push(
        status === 'completed'
          ? { kind: 'tile', tile: 'banner', x: s.x, y: s.y - 3 }
          : { kind: 'tile', tile: s.bossSprite ?? 'boss1', x: s.x + 1, y: s.y },
      );
    } else if (s.side) {
      ops.push({ kind: 'marker', x: s.x, y: s.y, status, boss: false });
      ops.push({ kind: 'tile', tile: 'chest', x: s.x, y: s.y });
    } else {
      ops.push({ kind: 'marker', x: s.x, y: s.y, status, boss: false });
    }
  }

  for (const r of layout.regions) {
    if (cls.chapters[r.chapterId]?.fogged) ops.push({ kind: 'fog', x0: r.x0, x1: r.x1 + 1 });
  }
  return ops;
}

// Where the Warlock stands: walking from the previous main stop toward the current quest.
export function avatarPosition(layout: MapLayout, cls: ClassState): Point & { questId?: string } {
  const main = layout.stops.filter((s) => !s.side);
  const targetId = cls.nextQuestId;
  const target = layout.stops.find((s) => s.questId === targetId);
  if (!target) {
    const last = main[main.length - 1];
    return last ? { x: last.x, y: last.y } : { x: 0, y: 0 };
  }
  const progress = cls.quests[target.questId]?.mapProgress ?? 0;
  const prevIndex = main.findIndex((s) => s.questId === target.questId) - 1;
  const from = target.side ? target : prevIndex >= 0 ? main[prevIndex]! : { x: target.x - 3, y: target.y };
  return {
    questId: target.questId,
    x: from.x + (target.x - from.x) * Math.max(progress, target === from ? 1 : 0.15),
    y: from.y + (target.y - from.y) * Math.max(progress, target === from ? 1 : 0.15),
  };
}
