import type { Biome, ClassDef } from '../../domain/schema';
import type { TileName } from './atlas-index';

// Deterministic overworld layout generated from a class's chapters and quests,
// so every class (AI Engineer, Guitar, ...) gets its own map without hand-made art.

export interface Point {
  x: number;
  y: number;
}

export interface Stop extends Point {
  questId: string;
  chapterId: string;
  boss: boolean;
  side: boolean;
  bossSprite?: TileName;
}

export interface Region {
  chapterId: string;
  biome: Biome;
  x0: number;
  x1: number;
}

export interface Placed extends Point {
  tile: TileName;
}

export interface MapLayout {
  width: number;
  height: number;
  regions: Region[];
  stops: Stop[];
  road: Point[];
  sideRoads: Point[];
  decor: Placed[];
}

export const MAP_HEIGHT = 18;
const STOP_SPACING = 4;
const REGION_PADDING = 3;
const BOSS_SPRITES: TileName[] = ['boss1', 'boss2', 'boss3', 'boss4', 'boss5'];

function rng(seedText: string) {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  seed = seed % 2147483646 || 1;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

function pathBetween(a: Point, b: Point): Point[] {
  const out: Point[] = [];
  let { x, y } = a;
  while (x !== b.x) {
    out.push({ x, y });
    x += Math.sign(b.x - x);
  }
  while (y !== b.y) {
    out.push({ x, y });
    y += Math.sign(b.y - y);
  }
  return out;
}

export function buildLayout(def: ClassDef): MapLayout {
  const rand = rng(def.id);
  const regions: Region[] = [];
  const stops: Stop[] = [];
  let x = REGION_PADDING;
  let mainIndex = 0;

  def.chapters.forEach((ch, chapterIndex) => {
    const main = def.quests.filter((q) => q.chapterId === ch.id && !q.side);
    const x0 = x - REGION_PADDING + (chapterIndex === 0 ? 0 : 1);
    for (const q of main) {
      // Gentle serpentine: the road climbs and dips like an overworld trail.
      const y = Math.round(MAP_HEIGHT / 2 + 4 * Math.sin(mainIndex * 0.85));
      stops.push({
        questId: q.id,
        chapterId: ch.id,
        boss: q.boss,
        side: false,
        x,
        y,
        bossSprite: q.boss ? BOSS_SPRITES[chapterIndex % BOSS_SPRITES.length] : undefined,
      });
      x += STOP_SPACING;
      mainIndex += 1;
    }
    regions.push({ chapterId: ch.id, biome: ch.biome, x0, x1: x - STOP_SPACING + REGION_PADDING });
    x += 1;
  });

  // Regions tile the map without overlapping, so tints and fog never stack.
  for (let i = 0; i < regions.length - 1; i++) regions[i]!.x1 = regions[i + 1]!.x0 - 1;

  const road: Point[] = [];
  for (let i = 0; i < stops.length - 1; i++) road.push(...pathBetween(stops[i]!, stops[i + 1]!));
  if (stops.length) road.push(stops[stops.length - 1]!);

  // Side quests branch off their first prerequisite on a short trail to a chest.
  const sideRoads: Point[] = [];
  for (const q of def.quests.filter((qq) => qq.side)) {
    const anchor = stops.find((s) => s.questId === q.prerequisites[0]) ?? stops[0];
    if (!anchor) continue;
    const dy = anchor.y < MAP_HEIGHT / 2 ? 4 : -4;
    const used = stops.filter((s) => s.side && s.x === anchor.x + 2).length;
    const target = { x: anchor.x + 2 + used * 2, y: anchor.y + dy };
    sideRoads.push(...pathBetween({ x: anchor.x, y: anchor.y + Math.sign(dy) }, target), target);
    stops.push({ questId: q.id, chapterId: q.chapterId, boss: false, side: true, ...target });
  }

  const width = (regions[regions.length - 1]?.x1 ?? 10) + 1;
  const blocked = new Set<string>();
  const key = (p: Point) => `${p.x},${p.y}`;
  for (const p of [...road, ...sideRoads]) blocked.add(key(p));
  for (const s of stops) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -3; dy <= 1; dy++) blocked.add(key({ x: s.x + dx, y: s.y + dy }));
  }

  const decor: Placed[] = [];
  const free = (p: Point, w = 1, h = 1) => {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (blocked.has(key({ x: p.x + i, y: p.y + j }))) return false;
    return p.x >= 0 && p.y >= 1 && p.x + w <= width && p.y + h <= MAP_HEIGHT;
  };
  const put = (items: Placed[], w: number, h: number, at: Point) => {
    if (!free(at, w, h)) return;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) blocked.add(key({ x: at.x + i, y: at.y + j }));
    decor.push(...items);
  };

  for (const region of regions) {
    // A landmark per biome near the chapter entrance.
    const lx = region.x0 + 1;
    const ly = 2;
    if (region.biome === 'meadow') put(house(lx, ly, 'Red'), 3, 2, { x: lx, y: ly });
    if (region.biome === 'citadel' || region.biome === 'peaks') put(castle(lx, ly), 3, 3, { x: lx, y: ly });
    if (region.biome === 'harbor') put(house(lx, ly, 'Blue'), 3, 2, { x: lx, y: ly });

    const area = (region.x1 - region.x0) * MAP_HEIGHT;
    for (let n = 0; n < area * 0.35; n++) {
      const p = { x: region.x0 + Math.floor(rand() * (region.x1 - region.x0)), y: 1 + Math.floor(rand() * (MAP_HEIGHT - 2)) };
      const r = rand();
      const palette = BIOME_DECOR[region.biome];
      const pick = palette[Math.floor(r * palette.length)]!;
      if (pick === 'tallTree') {
        const autumn = region.biome === 'forest';
        put(
          [
            { tile: autumn ? 'treeAutumnTop' : 'treeGreenTop', ...p },
            { tile: autumn ? 'treeAutumnBottom' : 'treeGreenBottom', x: p.x, y: p.y + 1 },
          ],
          1,
          2,
          p,
        );
      } else if (pick !== 'none') {
        put([{ tile: pick, ...p }], 1, 1, p);
      }
    }
  }

  return { width, height: MAP_HEIGHT, regions, stops, road, sideRoads, decor };
}

type DecorPick = TileName | 'tallTree' | 'none';
const BIOME_DECOR: Record<Biome, DecorPick[]> = {
  meadow: ['tallTree', 'tallTree', 'bush', 'grassFlower', 'smallGreen', 'none', 'none'],
  forest: ['tallTree', 'tallTree', 'tallTree', 'smallAutumn', 'mushroom', 'none'],
  peaks: ['tallTree', 'smallGreen', 'cobble', 'cobble', 'none', 'none'],
  citadel: ['cobble', 'barrel', 'smallGreen', 'none', 'none', 'none'],
  harbor: ['barrel', 'sign', 'bush', 'none', 'none', 'none'],
};

function house(x: number, y: number, color: 'Red' | 'Blue'): Placed[] {
  return [
    { tile: `roof${color}L`, x, y },
    { tile: `roof${color}M`, x: x + 1, y },
    { tile: `roof${color}Gable`, x: x + 2, y },
    { tile: 'wall', x, y: y + 1 },
    { tile: 'door', x: x + 1, y: y + 1 },
    { tile: 'window', x: x + 2, y: y + 1 },
  ];
}

function castle(x: number, y: number): Placed[] {
  return [
    { tile: 'battlementL', x, y },
    { tile: 'battlementM', x: x + 1, y },
    { tile: 'battlementR', x: x + 2, y },
    { tile: 'gateTopL', x, y: y + 1 },
    { tile: 'gateTopM', x: x + 1, y: y + 1 },
    { tile: 'gateTopR', x: x + 2, y: y + 1 },
    { tile: 'gateBottomL', x, y: y + 2 },
    { tile: 'gateBottomM', x: x + 1, y: y + 2 },
    { tile: 'gateBottomR', x: x + 2, y: y + 2 },
  ];
}
