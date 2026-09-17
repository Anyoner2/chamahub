create extension if not exists pgcrypto;

create table if not exists public.chamas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text default '',
  goal jsonb not null,
  members jsonb not null default '[]'::jsonb,
  contributions jsonb not null default '[]'::jsonb,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chamas enable row level security;

-- Temporary anonymous policies for the current MVP. Replace these with
-- authenticated, owner-scoped policies before production use.
create policy "Allow anonymous chama reads"
  on public.chamas for select
  to anon
  using (true);

create policy "Allow anonymous chama inserts"
  on public.chamas for insert
  to anon
  with check (true);

create policy "Allow anonymous chama updates"
  on public.chamas for update
  to anon
  using (true)
  with check (true);
