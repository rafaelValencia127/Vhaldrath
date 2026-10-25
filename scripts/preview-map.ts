// Dev-only: renders the AI Engineer map to a PNG to eyeball the layout without a browser.
// Usage: npx vite-node scripts/preview-map.ts <out.png> [completedWeeks]
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { aiEngineerClass } from '../src/content/ai-engineer';
import { addEvidence, completeQuest, logSession } from '../src/domain/commands';
import { deriveGame } from '../src/domain/derive';
import type { GameEvent } from '../src/domain/schema';
import { ATLAS_COLUMNS, TILE, TILES } from '../src/ui/map/atlas-index';
import { avatarPosition, composeMap } from '../src/ui/map/compose';
import { buildLayout } from '../src/ui/map/layout';

const [out = 'map-preview.png', doneArg = '10'] = process.argv.slice(2);
const atlas = PNG.sync.read(fs.readFileSync('public/tiles/atlas.png'));
const events: GameEvent[] = [];
let n = 0;
const ctx = () => ({ id: `p${++n}`, now: new Date(Date.UTC(2026, 9, 1) + n * 60000).toISOString() });
const push = (r: { ok: boolean; event?: GameEvent; error?: string }) => {
  if (!r.ok || !r.event) throw new Error(r.error);
  events.push(r.event);
};
for (let w = 1; w <= Number(doneArg); w++) {
  const id = `week-${String(w).padStart(2, '0')}`;
  push(addEvidence(deriveGame([aiEngineerClass], events), 'ai-engineer', id, { kind: 'text', value: 'ok' }, ctx()));
  push(completeQuest(deriveGame([aiEngineerClass], events), aiEngineerClass, id, undefined, ctx()));
}
push(logSession(deriveGame([aiEngineerClass], events), aiEngineerClass, `week-${String(Number(doneArg) + 1).padStart(2, '0')}`, 5, undefined, ctx()));

const cls = deriveGame([aiEngineerClass], events).classes['ai-engineer']!;
const layout = buildLayout(aiEngineerClass);
const img = new PNG({ width: layout.width * TILE, height: layout.height * TILE });

function blend(px: number, py: number, rgb: number[], a: number) {
  if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
  const i = (py * img.width + px) * 4;
  for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(rgb[c]! * a + img.data[i + c]! * (1 - a));
  img.data[i + 3] = 255;
}
function tile(name: keyof typeof TILES, x: number, y: number) {
  const idx = TILES[name];
  const sx = (idx % ATLAS_COLUMNS) * TILE;
  const sy = Math.floor(idx / ATLAS_COLUMNS) * TILE;
  for (let j = 0; j < TILE; j++)
    for (let i = 0; i < TILE; i++) {
      const si = ((sy + j) * atlas.width + sx + i) * 4;
      const a = atlas.data[si + 3]! / 255;
      if (a) blend(Math.round(x * TILE) + i, Math.round(y * TILE) + j, [atlas.data[si]!, atlas.data[si + 1]!, atlas.data[si + 2]!], a);
    }
}
const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number);
for (const op of composeMap(layout, cls)) {
  if (op.kind === 'tile') tile(op.tile, op.x, op.y);
  else if (op.kind === 'tint' || op.kind === 'fog') {
    const [r, g, b, a] = op.kind === 'fog' ? [14, 12, 28, 0.72] : parse(op.color);
    for (let y = 0; y < img.height; y++) for (let x = op.x0 * TILE; x < op.x1 * TILE; x++) blend(x, y, [r!, g!, b!], a!);
  } else if (op.kind === 'marker') {
    const color = op.status === 'completed' ? [255, 210, 63] : op.status === 'locked' ? [107, 120, 145] : [126, 224, 106];
    const cx = op.x * TILE + 8;
    const cy = op.y * TILE + 8;
    const r = op.boss ? 6 : 4;
    for (let y = -r - 1; y <= r + 1; y++)
      for (let x = -r - 1; x <= r + 1; x++) {
        const d = Math.hypot(x, y);
        if (d <= r) blend(cx + x, cy + y, color, 1);
        else if (d <= r + 1.2) blend(cx + x, cy + y, [20, 14, 30], 1);
      }
  }
}
const av = avatarPosition(layout, cls);
tile('warlock', av.x, av.y - 0.4);
fs.writeFileSync(out, PNG.sync.write(img));
console.log(`map ${layout.width}x${layout.height} tiles -> ${out}`);
