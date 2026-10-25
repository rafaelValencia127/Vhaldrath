import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { builtInClasses } from '../content/ai-engineer';
import type { CommandResult } from '../domain/commands';
import { newEventContext, type EventContext } from '../domain/events';
import type { GameEvent } from '../domain/schema';
import { evidenceUrl, remoteEventsFor, signInWithGoogle, supabase, uploadEvidence } from '../infra/supabase';
import { GameStore } from './store';
import { SyncEngine } from './sync-engine';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface Services {
  store: GameStore;
  sync: SyncEngine;
  session: Session | null;
  cloudAvailable: boolean;
  run: <T extends GameEvent>(build: (ctx: EventContext) => CommandResult<T>, success?: string) => T | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  uploadFile: (file: File) => Promise<string>;
  openFile: (path: string) => Promise<void>;
  toasts: Toast[];
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
}

const Ctx = createContext<Services | null>(null);
const MOTION_KEY = 'mlar:pref:reduce-motion';

function readMotionPref(): boolean {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    if (v !== null) return v === '1';
  } catch {
    // Storage blocked: fall back to the OS preference.
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ServicesProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new GameStore(builtInClasses, window.localStorage), []);
  const sync = useMemo(() => new SyncEngine(store, null, () => navigator.onLine), [store]);
  const [session, setSession] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reduceMotion, setMotion] = useState(readMotionPref);
  const nextToast = useRef(1);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextToast.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (store.loadWarning) toast('error', store.loadWarning);
  }, [store, toast]);

  // Auth: a session switches sync on; signing out keeps local progress in this browser.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase) return;
    if (session) {
      sync.setRemote(remoteEventsFor(supabase, session));
      void sync.syncNow();
    } else {
      sync.setRemote(null, 'signed-out');
    }
    // Re-bind only when the signed-in user changes, not on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sync]);

  // Sync shortly after each change, and again when the connection comes back.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = store.subscribe(() => {
      // markSynced also notifies; only real local changes should trigger another sync.
      if (store.getSnapshot().pendingCount === 0) return;
      clearTimeout(timer);
      timer = setTimeout(() => void sync.syncNow(), 1500);
    });
    const onOnline = () => void sync.syncNow();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, [store, sync]);

  const run = useCallback(
    <T extends GameEvent>(build: (ctx: EventContext) => CommandResult<T>, success?: string): T | null => {
      const r = build(newEventContext());
      if (!r.ok) {
        toast('error', r.error);
        return null;
      }
      store.append(r.event);
      if (success) toast('success', success);
      return r.event;
    },
    [store, toast],
  );

  const value: Services = {
    store,
    sync,
    session,
    cloudAvailable: !!supabase,
    run,
    toasts,
    toast,
    dismissToast,
    reduceMotion,
    setReduceMotion: (v) => {
      setMotion(v);
      try {
        localStorage.setItem(MOTION_KEY, v ? '1' : '0');
      } catch {
        // Preference just won't persist.
      }
    },
    signIn: async () => {
      if (!supabase) return toast('info', 'Cloud sync is not configured yet. See the README to connect Supabase.');
      try {
        await signInWithGoogle(supabase);
      } catch (e) {
        toast('error', `Could not sign in: ${(e as Error).message}`);
      }
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
      toast('info', 'Signed out. Your progress stays in this browser.');
    },
    uploadFile: async (file) => {
      if (!supabase || !session) throw new Error('Sign in with Google to attach files.');
      if (!navigator.onLine) throw new Error('Attaching files needs a connection. Add a link or a reflection for now.');
      return uploadEvidence(supabase, session, file);
    },
    openFile: async (path) => {
      if (!supabase || !session) return toast('error', 'Sign in to open attached files.');
      try {
        window.open(await evidenceUrl(supabase, path), '_blank', 'noopener');
      } catch (e) {
        toast('error', (e as Error).message);
      }
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServices(): Services {
  const s = useContext(Ctx);
  if (!s) throw new Error('useServices must be used inside ServicesProvider');
  return s;
}

export function useGame() {
  const { store } = useServices();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useSyncState() {
  const { sync } = useServices();
  return useSyncExternalStore(sync.subscribe, sync.getState);
}
