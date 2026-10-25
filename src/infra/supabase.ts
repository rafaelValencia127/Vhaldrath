import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { RemoteEvents } from '../app/sync-engine';
import { eventSchema, type GameEvent } from '../domain/schema';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const EVIDENCE_BUCKET = 'evidence';
const PAGE = 1000;

export function remoteEventsFor(client: SupabaseClient, session: Session): RemoteEvents {
  const userId = session.user.id;
  return {
    async push(events) {
      for (let i = 0; i < events.length; i += PAGE) {
        const rows = events.slice(i, i + PAGE).map((e) => ({ id: e.id, user_id: userId, at: e.at, type: e.type, payload: e }));
        const { error } = await client.from('game_events').upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
    },
    async pullAll() {
      const out: GameEvent[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from('game_events')
          .select('id, payload')
          .order('at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) {
          const parsed = eventSchema.safeParse(row.payload);
          if (parsed.success && parsed.data.id === row.id) out.push(parsed.data);
        }
        if (!data || data.length < PAGE) return out;
      }
    },
  };
}

export async function signInWithGoogle(client: SupabaseClient) {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw new Error(error.message);
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function validateEvidenceFile(file: { size: number; type: string }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only PDF or image files (PNG, JPG, WEBP, GIF) can be attached.';
  if (file.size > MAX_FILE_BYTES) return 'Files must be 10 MB or smaller.';
  return null;
}

// Files live under <user id>/ so storage policies can restrict them to their owner.
export async function uploadEvidence(client: SupabaseClient, session: Session, file: File): Promise<string> {
  const problem = validateEvidenceFile(file);
  if (problem) throw new Error(problem);
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function evidenceUrl(client: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60 * 10);
  if (error || !data) throw new Error(error?.message ?? 'Could not open the file.');
  return data.signedUrl;
}
