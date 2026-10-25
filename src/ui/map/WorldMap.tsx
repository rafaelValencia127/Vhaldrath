import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClassState, QuestStatus } from '../../domain/derive';
import type { ClassDef } from '../../domain/schema';
import { ATLAS_COLUMNS, TILE, TILES } from './atlas-index';
import { avatarPosition, composeMap } from './compose';
import { buildLayout } from './layout';

const MARKER: Record<QuestStatus, string> = {
  completed: '#ffd23f',
  available: '#7ee06a',
  in_progress: '#7ee06a',
  locked: '#6b7891',
};

let atlasPromise: Promise<HTMLImageElement> | null = null;
function loadAtlas() {
  atlasPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load map tiles.'));
    img.src = '/tiles/atlas.png';
  });
  return atlasPromise;
}

function useScale() {
  const pick = () => (window.innerWidth < 640 ? 2 : 3);
  const [scale, setScale] = useState(pick);
  useEffect(() => {
    const onResize = () => setScale(pick());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

function shortTitle(title: string) {
  const t = title.replace(/^BOSS: /, '');
  return t.length > 30 ? `${t.slice(0, 28).trimEnd()}…` : t;
}

export function WorldMap({ def, cls, onOpen }: { def: ClassDef; cls: ClassState; onOpen: (questId: string) => void }) {
  const layout = useMemo(() => buildLayout(def), [def]);
  const scale = useScale();
  const px = TILE * scale;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const avatar = avatarPosition(layout, cls);

  useEffect(() => {
    let cancelled = false;
    loadAtlas()
      .then((atlas) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const drawTile = (name: keyof typeof TILES, x: number, y: number) => {
          const idx = TILES[name];
          ctx.drawImage(atlas, (idx % ATLAS_COLUMNS) * TILE, Math.floor(idx / ATLAS_COLUMNS) * TILE, TILE, TILE, Math.round(x * px), Math.round(y * px), px, px);
        };
        for (const op of composeMap(layout, cls)) {
          if (op.kind === 'tile') drawTile(op.tile, op.x, op.y);
          else if (op.kind === 'tint') {
            ctx.fillStyle = op.color;
            ctx.fillRect(op.x0 * px, 0, (op.x1 - op.x0) * px, layout.height * px);
          } else if (op.kind === 'fog') {
            ctx.fillStyle = 'rgba(14, 10, 28, 0.74)';
            ctx.fillRect(op.x0 * px, 0, (op.x1 - op.x0) * px, layout.height * px);
            // Drifting cloud puffs, drawn as chunky pixel blocks.
            ctx.fillStyle = 'rgba(165, 156, 201, 0.10)';
            for (let i = 0; i < (op.x1 - op.x0) * 2; i++) {
              const cx = op.x0 + ((i * 7.3) % (op.x1 - op.x0));
              const cy = (i * 3.7) % layout.height;
              ctx.fillRect(Math.round(cx * px), Math.round(cy * px), px * 2, px);
            }
          } else if (op.kind === 'marker') {
            const r = (op.boss ? 0.34 : 0.24) * px;
            const cx = (op.x + 0.5) * px;
            const cy = (op.y + 0.5) * px;
            ctx.fillStyle = '#140e1f';
            ctx.fillRect(cx - r - scale, cy - r - scale, 2 * (r + scale), 2 * (r + scale));
            ctx.fillStyle = MARKER[op.status];
            ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
          }
        }
        drawTile('warlock', avatar.x, avatar.y - 0.45);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [layout, cls, px, scale, avatar.x, avatar.y]);

  // Bring the Warlock into view when entering the map.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, avatar.x * px - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.id, px]);

  const questById = new Map(def.quests.map((q) => [q.id, q]));
  return (
    <div className="map-scroll" ref={scrollRef}>
      {error && <p className="muted" style={{ padding: 16 }}>{error}</p>}
      <div className="map-stage" style={{ width: layout.width * px, height: layout.height * px }}>
        <canvas ref={canvasRef} width={layout.width * px} height={layout.height * px} aria-hidden />
        {layout.regions.map((r) => {
          const ch = def.chapters.find((c) => c.id === r.chapterId)!;
          const st = cls.chapters[r.chapterId];
          return (
            <div key={r.chapterId} className={`chapter-label ${st?.fogged ? 'fogged' : ''}`} style={{ left: r.x0 * px + 12 }}>
              {st?.fogged ? '🔒 ' : ''}
              {ch.name}
              <small>
                {st?.fogged ? 'Defeat the previous boss to clear the fog' : `${st?.completed ?? 0} / ${st?.total ?? 0} quests${st?.cleared ? ' · cleared ✓' : ''}`}
              </small>
            </div>
          );
        })}
        {layout.stops.map((s) => {
          const q = questById.get(s.questId)!;
          const qs = cls.quests[s.questId]!;
          const current = cls.nextQuestId === s.questId;
          const fogged = cls.chapters[s.chapterId]?.fogged;
          const showName = current || s.boss || s.side;
          const prefix = q.week ? `W${q.week}` : '';
          return (
            <button
              key={s.questId}
              className="stop"
              style={{ left: (s.x + 0.5) * px, top: (s.y + 0.5) * px }}
              data-status={qs.status}
              data-boss={s.boss}
              data-current={current}
              onClick={() => onOpen(s.questId)}
              aria-label={`${prefix} ${q.title} — ${qs.status.replace('_', ' ')}`}
              title={q.title}
            >
              <span className="hit" style={{ width: px, height: px }} />
              {!fogged && (
                <span className="badge">
                  {current ? '▶ ' : ''}
                  {s.boss ? '💀 ' : s.side ? 'SIDE · ' : ''}
                  {showName ? `${prefix} ${shortTitle(q.title)}` : prefix || '•'}
                  {qs.status === 'completed' ? ' ✓' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
