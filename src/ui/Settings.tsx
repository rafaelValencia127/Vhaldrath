import { useRef, useState } from 'react';
import { useGame, useServices, useSyncState } from '../app/services';
import { updateProfile } from '../domain/commands';
import { exportBackup, importBackup } from '../infra/local-save';
import { SyncChip } from './components';

export function Settings() {
  const { store, run, toast, session, signIn, signOut, cloudAvailable, sync, reduceMotion, setReduceMotion } = useServices();
  const { game, events, pendingCount } = useGame();
  const syncState = useSyncState();
  const [name, setName] = useState(game.profile.name);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([exportBackup(events)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-life-as-rpg-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('success', 'Backup downloaded');
  };

  const doImport = async (file: File) => {
    const r = importBackup(await file.text(), store.getSnapshot().events);
    if (!r.ok) return toast('error', r.error);
    store.replaceEvents(r.events);
    toast('success', `Backup imported: ${r.added} new entries merged${r.skipped ? `, ${r.skipped} unreadable skipped` : ''}. Nothing was duplicated.`);
  };

  return (
    <main className="shell settings">
      <div className="topbar">
        <a className="btn btn-sm btn-ghost" href="#/">
          ⬅ Hub
        </a>
        <h1>Settings</h1>
      </div>

      <section className="panel">
        <h2>Character</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            run((ctx) => updateProfile(name, ctx), 'Name saved');
          }}
        >
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="name">Display name</label>
            <input id="name" className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn" type="submit" style={{ alignSelf: 'end' }}>
            Save name
          </button>
        </form>
        <p className="muted" style={{ marginBottom: 0 }}>
          Changing your name never changes your progress.
        </p>
      </section>

      <section className="panel">
        <h2>Account & sync</h2>
        <div className="row">
          <SyncChip />
          <span className="muted">{pendingCount} change(s) waiting to sync</span>
        </div>
        {!cloudAvailable && <p style={{ margin: 0 }}>Cloud sync is not configured, so progress is saved in this browser only. The README explains how to connect Supabase with Google login.</p>}
        {cloudAvailable && !session && (
          <div className="row">
            <button className="btn btn-fel" onClick={signIn}>
              Sign in with Google
            </button>
            <span className="muted">Progress made before signing in is uploaded to your account.</span>
          </div>
        )}
        {session && (
          <div className="row">
            <span>Signed in as {session.user.email}</span>
            <button className="btn btn-sm" onClick={() => void sync.syncNow()} disabled={syncState.status === 'syncing'}>
              Sync now
            </button>
            <button className="btn btn-sm btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
        {syncState.error && <p className="muted" style={{ margin: 0 }}>Last error: {syncState.error}</p>}
      </section>

      <section className="panel">
        <h2>Backup</h2>
        <p style={{ margin: 0 }}>An extra copy of your progress as a JSON file. Importing merges entries, so it never duplicates XP.</p>
        <div className="row">
          <button className="btn" onClick={doExport}>
            Download backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="panel">
        <h2>Accessibility</h2>
        <label className="row">
          <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
          Reduce motion (celebrations become a summary card)
        </label>
      </section>

      <section className="panel">
        <h2>Credits</h2>
        <p style={{ margin: 0 }}>
          Pixel tiles: “Tiny Town” and “Tiny Dungeon” by{' '}
          <a href="https://kenney.nl" target="_blank" rel="noopener noreferrer">
            Kenney
          </a>{' '}
          (CC0). The Warlock is a recolor made for this game.
        </p>
      </section>
    </main>
  );
}
