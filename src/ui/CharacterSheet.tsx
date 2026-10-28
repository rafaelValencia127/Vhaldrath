import { useGame } from '../app/services';
import { XpBar } from './components';

// Global growth: areas (broad stats) holding the skills that have earned XP.
export function CharacterSheet() {
  const { game } = useGame();
  const areas = Object.values(game.areas).sort((a, b) => b.xp - a.xp || (a.id < b.id ? -1 : 1));

  return (
    <section className="panel sheet" aria-labelledby="sheet-title">
      <h2 id="sheet-title">Character sheet</h2>
      {areas.length === 0 ? (
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Complete your first quest to start growing skills.
        </p>
      ) : (
        <div className="sheet-areas">
          {areas.map((area) => (
            <div key={area.id} className="sheet-area">
              <h3>
                {area.name} · Lv {area.level}
              </h3>
              {area.skillIds.map((id) => {
                const s = game.skills[id]!;
                return (
                  <div key={id} className="sheet-skill">
                    <span className="sheet-skill-name">{s.name}</span>
                    <span className="sheet-skill-level">Lv {s.level}</span>
                    <XpBar into={s.xpIntoLevel} of={s.xpForNextLevel} label={`${s.name} to level ${s.level + 1}`} />
                    {s.title && <span className="chip">{s.title}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
