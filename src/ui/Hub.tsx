import { useGame, useServices } from '../app/services';
import { navigate } from './router';
import { Sprite, SyncChip, XpBar } from './components';

const WELCOME_BACK_DAYS = 7;

export function Hub() {
  const { store, session, signIn, cloudAvailable } = useServices();
  const { game, events } = useGame();
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const monthHours = events.filter((e) => e.type === 'session_logged' && e.at >= monthStart).reduce((s, e) => s + (e.type === 'session_logged' ? e.hours : 0), 0);
  const awayDays = game.lastActivityAt ? Math.floor((now - Date.parse(game.lastActivityAt)) / 86_400_000) : 0;

  return (
    <main className="shell">
      <div className="topbar">
        <span className="display muted">My Life as RPG</span>
        <span className="spacer" />
        <SyncChip />
        {cloudAvailable && !session && (
          <button className="btn btn-sm btn-fel" onClick={signIn}>
            Sign in with Google
          </button>
        )}
        <a className="btn btn-sm btn-ghost" href="#/settings">
          ⚙ Settings
        </a>
      </div>

      <section className="hero">
        <div className="panel" style={{ padding: 8, background: 'radial-gradient(circle, #2f6b2a55, transparent 70%), var(--night)' }}>
          <Sprite name="warlock" scale={7} label="Your Warlock" />
        </div>
        <div>
          <p className="label muted" style={{ margin: 0 }}>
            Warlock
          </p>
          <h1 className="hero-name">{game.profile.name}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            This month: {Math.round(monthHours * 10) / 10} h studied ·{' '}
            {Object.values(game.classes).reduce((s, c) => s + Object.values(c.quests).filter((q) => q.completedAt && q.completedAt >= monthStart).length, 0)} quests completed
          </p>
        </div>
      </section>

      {awayDays >= WELCOME_BACK_DAYS && (
        <div className="panel welcome" style={{ marginTop: 16 }}>
          <h2>Welcome back.</h2>
          <p style={{ margin: '6px 0 0' }}>Your progress is right where you left it. One small step is enough today: open your next quest and log even 30 minutes.</p>
        </div>
      )}

      <div className="hub-grid">
        {store.classes.map((def) => {
          const c = game.classes[def.id]!;
          const next = def.quests.find((q) => q.id === c.nextQuestId);
          const maxStat = Math.max(10, ...Object.values(c.stats));
          return (
            <article key={def.id} className="panel class-card">
              <header>
                <span style={{ fontSize: 32 }} aria-hidden>
                  {def.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <h2>{def.name}</h2>
                  <span className="muted">{c.title ?? 'Apprentice'}</span>
                </div>
                <span className="level-badge">Lv {c.level}</span>
              </header>
              <XpBar into={c.xpIntoLevel} of={c.xpForNextLevel} label={`To level ${c.level + 1}`} />
              <div className="row muted" style={{ fontSize: 14 }}>
                <span>
                  {Math.floor(c.xp)} XP total · 🪙 {Math.floor(c.gold)} gold · {c.completedCount}/{def.quests.length} quests
                </span>
              </div>
              <div className="stats">
                {def.stats.map((s) => (
                  <div key={s.id} style={{ display: 'contents' }} title={`${s.name}: ${s.description}`}>
                    <b>{s.id}</b>
                    <div className="bar stat">
                      <span style={{ width: `${(c.stats[s.id]! / maxStat) * 100}%` }} />
                    </div>
                    <span>{c.stats[s.id]}</span>
                  </div>
                ))}
              </div>
              {next ? (
                <div className="next">
                  <span className="label" style={{ color: 'var(--fel)' }}>
                    Next quest
                  </span>
                  <p style={{ margin: '2px 0 8px' }}>
                    {next.week ? `Week ${next.week} · ` : ''}
                    {next.title}
                  </p>
                  <button className="btn btn-fel" onClick={() => navigate(`/class/${def.id}/${next.id}`)}>
                    Continue quest
                  </button>
                </div>
              ) : (
                <p className="next">Every quest is complete. Legendary.</p>
              )}
              <button className="btn" onClick={() => navigate(`/class/${def.id}`)}>
                Open world map
              </button>
            </article>
          );
        })}
        <article className="panel upcoming">
          <h2>More classes</h2>
          <p style={{ margin: '6px 0 0' }}>English, Guitar, Singing, Dance and Web Design arrive in v2, generated from a class file you create with any LLM.</p>
        </article>
      </div>
    </main>
  );
}
