import { useEffect, useMemo } from 'react';
import { useServices } from '../app/services';
import { Modal, Sprite } from './components';

export interface CelebrationData {
  questTitle: string;
  boss: boolean;
  xp: number;
  gold: number;
  stats: Record<string, number>;
  levelBefore: number;
  levelAfter: number;
  newTitle?: string;
  unlockedChapter?: string;
}

// Normal quests get a short reward card; bosses get the champion moment.
export function Celebration({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  const { reduceMotion } = useServices();
  const sparks = useMemo(
    () =>
      Array.from({ length: data.boss ? 48 : 18 }, (_, i) => {
        const angle = (i / (data.boss ? 48 : 18)) * Math.PI * 2;
        const dist = (data.boss ? 260 : 150) * (0.6 + ((i * 37) % 10) / 25);
        return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, color: i % 3 === 0 ? '#7ee06a' : '#ffd23f' };
      }),
    [data.boss],
  );
  useEffect(() => {
    if (data.boss) return;
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [data.boss, onClose]);

  const levelUp = data.levelAfter > data.levelBefore;
  return (
    <>
      {!reduceMotion &&
        sparks.map((s, i) => (
          <span key={i} className="spark" style={{ left: '50%', top: '45%', background: s.color, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px` }} />
        ))}
      <Modal onClose={onClose} className={`celebrate ${data.boss ? 'boss' : ''} pop`} labelledBy="celebrate-title">
        <Sprite name={data.boss ? 'banner' : 'chest'} scale={5} />
        <h2 id="celebrate-title" className="big">
          {data.boss ? 'BOSS DEFEATED' : 'Quest complete'}
        </h2>
        <p style={{ margin: 0 }}>{data.questTitle.replace(/^BOSS: /, '')}</p>
        <div className="rewards">
          <span>+{data.xp} XP</span>
          <span>+{data.gold} gold</span>
          {Object.entries(data.stats).map(([k, v]) => (
            <span key={k}>
              +{v} {k}
            </span>
          ))}
        </div>
        {levelUp && (
          <p className="display" style={{ margin: 0, color: 'var(--fel)', fontSize: 22 }}>
            ▲ Level {data.levelAfter}
            {data.newTitle ? ` — new title: ${data.newTitle}` : ''}
          </p>
        )}
        {data.unlockedChapter && <p style={{ margin: 0 }}>The fog lifts: {data.unlockedChapter} is open.</p>}
        <button className="btn btn-gold" onClick={onClose}>
          {data.boss ? 'Onward, champion' : 'Continue'}
        </button>
      </Modal>
    </>
  );
}
