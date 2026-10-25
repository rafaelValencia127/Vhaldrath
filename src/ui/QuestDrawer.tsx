import { useEffect, useRef, useState } from 'react';
import { useGame, useServices } from '../app/services';
import { addEvidence, completeQuest, logSession, removeEvidence, undoQuest } from '../domain/commands';
import { completionReward, questGold, timeRates } from '../domain/economy';
import type { ClassDef } from '../domain/schema';
import { validateEvidenceFile } from '../infra/supabase';
import { Confirm } from './components';
import type { CelebrationData } from './Celebration';

const TIMER_KEY = 'mlar:timer';
interface RunningTimer {
  classId: string;
  questId: string;
  startedAt: number;
}

function readTimer(): RunningTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? (JSON.parse(raw) as RunningTimer) : null;
  } catch {
    return null;
  }
}
function writeTimer(t: RunningTimer | null) {
  try {
    if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t));
    else localStorage.removeItem(TIMER_KEY);
  } catch {
    // Timer just won't survive a reload.
  }
}

function formatHours(h: number) {
  const mins = Math.round(h * 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

type EvidenceTab = 'link' | 'text' | 'file';

export function QuestDrawer({ def, questId, onClose, onCelebrate }: { def: ClassDef; questId: string; onClose: () => void; onCelebrate: (c: CelebrationData) => void }) {
  const { store, run, toast, uploadFile, openFile, session, cloudAvailable } = useServices();
  const { game } = useGame();
  const quest = def.quests.find((q) => q.id === questId)!;
  const cls = game.classes[def.id]!;
  const qs = cls.quests[questId]!;
  const chapter = def.chapters.find((c) => c.id === quest.chapterId)!;
  const rates = timeRates(quest);
  const reward = completionReward(quest, def.stats.map((s) => s.id));
  const prereqNames = quest.prerequisites.map((p) => def.quests.find((q) => q.id === p)).filter(Boolean);

  const [manualHours, setManualHours] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [tab, setTab] = useState<EvidenceTab>('link');
  const [evidenceValue, setEvidenceValue] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<'complete' | 'undo' | null>(null);
  const [timer, setTimer] = useState<RunningTimer | null>(readTimer);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const timerHere = timer && timer.classId === def.id && timer.questId === questId;
  useEffect(() => {
    if (!timerHere) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timerHere]);
  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirm && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirm]);

  const locked = qs.status === 'locked';
  const completed = qs.status === 'completed';
  const credited = Math.min(qs.hours, rates.hourCap);

  const log = (hours: number) => {
    const ev = run((ctx) => logSession(store.getSnapshot().game, def, questId, hours, sessionNote, ctx));
    if (ev) {
      toast('success', `+${formatHours(ev.hours)} logged · the Warlock walks on`);
      setManualHours('');
      setSessionNote('');
    }
  };

  const startTimer = () => {
    const t = { classId: def.id, questId, startedAt: Date.now() };
    writeTimer(t);
    setTimer(t);
  };
  const stopTimer = () => {
    if (!timer) return;
    const hours = Math.min(24, (Date.now() - timer.startedAt) / 3_600_000);
    writeTimer(null);
    setTimer(null);
    if (hours < 1 / 60) return toast('info', 'Timer stopped before a full minute, nothing logged.');
    log(Math.round(hours * 100) / 100);
  };

  const submitEvidence = async () => {
    if (tab === 'file') {
      const file = fileRef.current?.files?.[0];
      if (!file) return toast('error', 'Choose a file first.');
      const problem = validateEvidenceFile(file);
      if (problem) return toast('error', problem);
      setUploading(true);
      try {
        const path = await uploadFile(file);
        run((ctx) => addEvidence(store.getSnapshot().game, def.id, questId, { kind: 'file', value: path, name: file.name }, ctx), 'File attached');
        if (fileRef.current) fileRef.current.value = '';
      } catch (e) {
        toast('error', (e as Error).message);
      } finally {
        setUploading(false);
      }
      return;
    }
    const ev = run((ctx) => addEvidence(store.getSnapshot().game, def.id, questId, { kind: tab, value: evidenceValue }, ctx), 'Evidence added');
    if (ev) setEvidenceValue('');
  };

  const doComplete = () => {
    setConfirm(null);
    const before = store.getSnapshot().game.classes[def.id]!;
    const ev = run((ctx) => completeQuest(store.getSnapshot().game, def, questId, notes, ctx));
    if (!ev) return;
    const after = store.getSnapshot().game.classes[def.id]!;
    const nextChapter = def.chapters[def.chapters.findIndex((c) => c.id === chapter.id) + 1];
    onCelebrate({
      questTitle: quest.title,
      boss: quest.boss,
      xp: ev.xp,
      gold: ev.gold,
      stats: ev.stats,
      levelBefore: before.level,
      levelAfter: after.level,
      newTitle: after.title !== before.title ? after.title : undefined,
      unlockedChapter: quest.boss && nextChapter && before.chapters[nextChapter.id]?.fogged && !after.chapters[nextChapter.id]?.fogged ? nextChapter.name : undefined,
    });
    onClose();
  };

  const doUndo = () => {
    setConfirm(null);
    run((ctx) => undoQuest(store.getSnapshot().game, def.id, questId, ctx), 'Completion undone. Your study time and evidence were kept.');
  };

  const elapsed = timerHere ? (Date.now() - timer.startedAt) / 3_600_000 : 0;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer parchment" role="dialog" aria-modal="true" aria-labelledby="quest-title">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">
            {chapter.name}
            {quest.week ? ` · Week ${quest.week}` : ''}
          </span>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close quest">
            ✕
          </button>
        </div>
        <h2 id="quest-title" ref={titleRef} tabIndex={-1}>
          {quest.boss && '💀 '}
          {quest.title}
        </h2>
        <div className="meta">
          <span className="tag">{qs.status.replace('_', ' ')}</span>
          <span className="tag">{quest.stat}</span>
          <span className="tag">{quest.xp} XP</span>
          <span className="tag">{questGold(quest)} gold</span>
          <span className="tag">~{quest.estimatedHours} h</span>
        </div>

        {qs.prerequisiteReopened && (
          <p className="warn-box">Its prerequisite is open again. This quest stays completed and keeps its XP.</p>
        )}
        {locked && (
          <p className="warn-box">
            Locked. Complete first: {prereqNames.map((p) => (p!.week ? `Week ${p!.week}` : p!.title)).join(', ')}.
          </p>
        )}

        <section>
          <span className="label">Acceptance criterion</span>
          <p className="accept">{quest.acceptance}</p>
          <p style={{ margin: 0 }}>
            <b>Evidence:</b> {quest.evidenceHint}
          </p>
        </section>

        {quest.resources.length > 0 && (
          <section>
            <span className="label">Courses</span>
            {quest.resources.map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
                Open course: {r.title} ↗
              </a>
            ))}
          </section>
        )}

        <section>
          <span className="label">Study sessions</span>
          <p className="progress-walk" style={{ margin: 0 }}>
            {formatHours(qs.hours)} logged of ~{quest.estimatedHours} h · earns {Math.round(rates.xpPerHour * 10) / 10} XP per hour, counted up to {rates.hourCap} h
            {qs.hours > rates.hourCap ? ` (extra ${formatHours(qs.hours - credited)} recorded without XP)` : ''}.
          </p>
          {!locked && (
            <>
              <div className="row">
                {timerHere ? (
                  <button className="btn btn-fel" onClick={stopTimer}>
                    ■ Stop timer · {formatHours(elapsed)}
                  </button>
                ) : (
                  <button className="btn" onClick={startTimer} disabled={!!timer}>
                    ▶ Start timer
                  </button>
                )}
                {timer && !timerHere && <span>A timer is running on another quest.</span>}
              </div>
              <div className="row">
                <input className="input" style={{ width: 110 }} inputMode="decimal" placeholder="Hours" aria-label="Hours studied" value={manualHours} onChange={(e) => setManualHours(e.target.value)} />
                <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="What did you do? (optional)" aria-label="Session note" value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} />
                <button className="btn btn-sm" onClick={() => log(Number(manualHours.replace(',', '.')))} disabled={!manualHours}>
                  Log hours
                </button>
              </div>
            </>
          )}
          {qs.sessions.length > 0 && (
            <ul className="ev-list">
              {[...qs.sessions].reverse().slice(0, 6).map((s) => (
                <li key={s.id}>
                  <div>
                    <b>{formatHours(s.hours)}</b> · {new Date(s.at).toLocaleDateString()}
                    {s.note ? ` — ${s.note}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <span className="label">Evidence ({qs.evidence.length})</span>
          {qs.evidence.length > 0 && (
            <ul className="ev-list">
              {qs.evidence.map((e) => (
                <li key={e.id}>
                  <div>
                    {e.kind === 'link' && (
                      <a href={e.value} target="_blank" rel="noopener noreferrer">
                        {e.value}
                      </a>
                    )}
                    {e.kind === 'text' && <span>{e.value}</span>}
                    {e.kind === 'file' && (
                      <button className="btn btn-sm" onClick={() => openFile(e.value)}>
                        📎 {e.name ?? 'Attached file'}
                      </button>
                    )}
                  </div>
                  {!completed && (
                    <button className="btn btn-ghost btn-sm" aria-label="Remove evidence" onClick={() => run((ctx) => removeEvidence(store.getSnapshot().game, def.id, questId, e.id, ctx), 'Evidence removed')}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!completed && (
            <>
              <div className="tabs" role="group" aria-label="Evidence type">
                {(['link', 'text', 'file'] as const).map((t) => (
                  <button key={t} className="btn btn-sm btn-ghost" aria-pressed={tab === t} onClick={() => setTab(t)}>
                    {t === 'link' ? 'Link' : t === 'text' ? 'Reflection' : 'File'}
                  </button>
                ))}
              </div>
              {tab === 'link' && <input className="input" placeholder="https://github.com/…/commit/…" aria-label="Evidence link" value={evidenceValue} onChange={(e) => setEvidenceValue(e.target.value)} />}
              {tab === 'text' && <textarea className="input" rows={3} placeholder="What you built or learned, in your own words" aria-label="Written reflection" value={evidenceValue} onChange={(e) => setEvidenceValue(e.target.value)} />}
              {tab === 'file' &&
                (cloudAvailable && session ? (
                  <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" aria-label="Evidence file" />
                ) : (
                  <p style={{ margin: 0 }}>Sign in with Google (Settings) to attach files such as a diploma PDF. Links and reflections work without an account.</p>
                ))}
              <div>
                <button className="btn btn-sm" onClick={submitEvidence} disabled={uploading || (tab === 'file' && !(cloudAvailable && session))}>
                  {uploading ? 'Uploading…' : 'Add evidence'}
                </button>
              </div>
            </>
          )}
        </section>

        {completed ? (
          <section>
            <p style={{ margin: 0 }}>
              ✓ Completed {qs.completedAt ? new Date(qs.completedAt).toLocaleDateString() : ''}
              {qs.notes ? ` — ${qs.notes}` : ''}
            </p>
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm('undo')}>
                Undo completion
              </button>
            </div>
          </section>
        ) : (
          !locked && (
            <section>
              <div className="field">
                <label htmlFor="completion-notes">Notes (optional)</label>
                <input id="completion-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <button className="btn btn-gold" onClick={() => setConfirm('complete')} disabled={qs.evidence.length === 0}>
                Complete quest · +{reward.xp} XP
              </button>
              {qs.evidence.length === 0 && <span>Add at least one piece of evidence to complete this quest.</span>}
            </section>
          )
        )}
      </aside>

      {confirm === 'complete' && (
        <Confirm
          title="Complete this quest?"
          body={
            <>
              <p>Confirm that you met the acceptance criterion:</p>
              <p className="muted">{quest.acceptance}</p>
              <p>
                You will earn {reward.xp} XP, {reward.gold} gold and {Object.entries(reward.stats).map(([k, v]) => `+${v} ${k}`).join(', ')}.
              </p>
            </>
          }
          confirmLabel="Complete quest"
          onConfirm={doComplete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'undo' && (
        <Confirm
          title="Undo completion?"
          body={<p>This removes the completion reward ({reward.xp} XP, {reward.gold} gold, stats). Your study hours, their XP and your evidence stay.</p>}
          confirmLabel="Undo completion"
          danger
          onConfirm={doUndo}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
