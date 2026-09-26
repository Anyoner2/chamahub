create extension if not exists pgcrypto;

create table if not exists public.chamas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  city text default '',
  goal jsonb not null,
  members jsonb not null default '[]'::jsonb,
  contributions jsonb not null default '[]'::jsonb,
  balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chamas add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create table if not exists public.chama_join_requests (
  id uuid primary key default gen_random_uuid(),
  chama_id uuid not null references public.chamas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null default 'New member',
  requester_email text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  unique (chama_id, user_id)
);

alter table public.chama_join_requests add column if not exists requester_name text not null default 'New member';
alter table public.chama_join_requests add column if not exists requester_email text not null default '';
alter table public.chama_join_requests add column if not exists requester_phone_number text not null default '';
alter table public.chama_join_requests add column if not exists requester_id_number text not null default '';

alter table public.chamas enable row level security;
alter table public.chama_join_requests enable row level security;

-- Chamas can be searched by signed-in users, but only their chairman can
-- create or update the chama record.
create policy "Allow anonymous chama reads"
  on public.chamas for select
  to anon
  using (true);

create policy "Allow signed-in chama reads"
  on public.chamas for select
  to authenticated
  using (true);

create policy "Allow signed-in chama inserts"
  on public.chamas for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Allow signed-in chama updates"
  on public.chamas for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Allow signed-in join request inserts"
  on public.chama_join_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Allow signed-in join request reads"
  on public.chama_join_requests for select
  to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.chamas where id = chama_id and owner_id = auth.uid()));

create policy "Allow chama owners to update join requests"
  on public.chama_join_requests for update
  to authenticated
  using (exists (select 1 from public.chamas where id = chama_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.chamas where id = chama_id and owner_id = auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chamas'
  ) then
    alter publication supabase_realtime add table public.chamas;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chama_join_requests'
  ) then
    alter publication supabase_realtime add table public.chama_join_requests;
  end if;
end $$;
