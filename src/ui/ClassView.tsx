import { useState } from 'react';
import { useGame, useServices } from '../app/services';
import { Celebration, type CelebrationData } from './Celebration';
import { SyncChip, XpBar } from './components';
import { WorldMap } from './map/WorldMap';
import { QuestDrawer } from './QuestDrawer';
import { navigate } from './router';

const STATUS_TEXT = { completed: '✓ Done', available: '● Available', in_progress: '▶ In progress', locked: '🔒 Locked' } as const;

export function ClassView({ classId, questId }: { classId: string; questId?: string }) {
  const { store } = useServices();
  const { game } = useGame();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const def = store.classDef(classId);
  const cls = game.classes[classId];
  if (!def || !cls) {
    return (
      <main className="shell">
        <p>This class does not exist.</p>
        <a href="#/">Back to the hub</a>
      </main>
    );
  }
  const open = (id: string) => navigate(`/class/${classId}/${id}`);
  const close = () => navigate(`/class/${classId}`);

  return (
    <>
      <header className="hud">
        <a className="btn btn-sm btn-ghost" href="#/">
          ⬅ Hub
        </a>
        <h1 style={{ fontSize: 20 }}>
          {def.icon} {def.name}
        </h1>
        <span className="level-badge">Lv {cls.level}</span>
        <XpBar into={cls.xpIntoLevel} of={cls.xpForNextLevel} label={cls.title ?? 'Apprentice'} />
        <span className="chip">🪙 {Math.floor(cls.gold)}</span>
        <SyncChip />
      </header>

      <WorldMap def={def} cls={cls} onOpen={open} />

      <div className="class-body">
        <p className="muted" style={{ margin: 0 }}>
          Click a stop on the map, or pick a quest from the journal below. Dates are only a guide: progress depends on quests, never on the calendar.
        </p>
        {def.chapters.map((ch) => {
          const st = cls.chapters[ch.id]!;
          return (
            <section key={ch.id} className="panel chapter-list" aria-labelledby={`ch-${ch.id}`}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 id={`ch-${ch.id}`} style={{ fontSize: 18 }}>
                  {st.fogged ? '🔒 ' : st.cleared ? '🏳 ' : ''}
                  {ch.name}
                </h2>
                <span className="muted">
                  {st.completed}/{st.total} · {ch.subtitle}
                </span>
              </div>
              {def.quests
                .filter((q) => q.chapterId === ch.id)
                .map((q) => {
                  const qs = cls.quests[q.id]!;
                  return (
                    <button key={q.id} className="quest-row" onClick={() => open(q.id)}>
                      <span className={`st st-${qs.status}`}>{STATUS_TEXT[qs.status]}</span>
                      <span style={{ flex: 1 }}>
                        {q.week ? `W${q.week} · ` : ''}
                        {q.title}
                      </span>
                      <span className="muted">{q.stat}</span>
                    </button>
                  );
                })}
            </section>
          );
        })}
      </div>

      {questId && def.quests.some((q) => q.id === questId) && <QuestDrawer key={questId} def={def} questId={questId} onClose={close} onCelebrate={setCelebration} />}
      {celebration && <Celebration data={celebration} onClose={() => setCelebration(null)} />}
    </>
  );
}
