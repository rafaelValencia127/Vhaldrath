-- My Life as RPG: append-only event log per user + private evidence files.
-- Run once in Supabase → SQL Editor.

create table if not exists public.game_events (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists game_events_user_at on public.game_events (user_id, at, id);

alter table public.game_events enable row level security;

-- Each player reads and appends only their own events. No update or delete policy:
-- the log is append-only, so progress can never be silently rewritten.
drop policy if exists "read own events" on public.game_events;
create policy "read own events" on public.game_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "append own events" on public.game_events;
create policy "append own events" on public.game_events
  for insert to authenticated with check (auth.uid() = user_id);

-- Private bucket for evidence files (diplomas, screenshots), max 10 MB, PDF or images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "read own evidence" on storage.objects;
create policy "read own evidence" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "upload own evidence" on storage.objects;
create policy "upload own evidence" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
